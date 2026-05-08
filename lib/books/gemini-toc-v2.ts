import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { BookLessonPartRecord, BookLessonRecord } from '@/lib/books/types'
import { computeStructureTagFromTitleAndIndex } from '@/lib/books/part-structure-tag'
import type { TocUnitDraft } from '@/lib/books/toc-import'
import { formatLessonTitleWithNumber } from '@/lib/books/lesson-title'
import { normalizeNotCountedPdfPages } from '@/lib/books/page-alignment'
import { resolveGeminiApiKey } from '@/lib/gemini'

const MODEL_CANDIDATES = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-flash-latest',
] as const

const UNAVAILABLE_STATUS = 503
const MAX_UNAVAILABLE_RETRIES_PER_MODEL = 2
const RETRY_BACKOFF_MS = 2500

const PROMPT = `You extract textbook TOC structure from images.

Return only valid JSON with this shape:
{
  "units": [
    {
      "unitNumber": 1,
      "title": "Good Citizens",
      "lessons": [
        {
          "lessonNumber": 1,
          "title": "Lesson 1",
          "entries": [
            { "title": "Vocabulary in Context", "startPrintedPage": 10 },
            { "title": "Comprehension: Story Structure + Summarize", "startPrintedPage": 13 },
            { "title": "A Fine, Fine School", "startPrintedPage": 14 }
          ]
        }
      ],
      "specialSections": [
        { "title": "READING POWER", "startPrintedPage": 182 },
        { "title": "Unit Wrap-Up", "startPrintedPage": 184 },
        { "title": "Glossary", "startPrintedPage": null }
      ]
    }
  ]
}

Rules:
- Unit heading appears near top and each unit spans a 2-page TOC spread.
- Lessons are indicated by red shield lesson markers.
- Include only section rows that have dotted leaders to a page number, plus story/title rows with a page number.
- Ignore rows without usable page numbers.
- Keep exact visible order.
- Include unit special sections outside lessons: READING POWER and Unit Wrap-Up.
- If final unit has Glossary without number, set startPrintedPage null and include it anyway.
- Never invent printed page numbers.
`

const imageSchema = z.object({
  pdfPage: z.number().int().min(1),
  mimeType: z.string().min(3).max(64).optional(),
  base64: z.string().min(100),
})

const aiEntrySchema = z.object({
  title: z.string().min(1).max(220),
  startPrintedPage: z.number().int().min(1).nullable().optional(),
})

const aiLessonSchema = z.object({
  lessonNumber: z.number().int().min(1).nullable().optional(),
  title: z.string().min(1).max(220),
  entries: z.array(aiEntrySchema).default([]),
})

const aiSpecialSchema = z.object({
  title: z.string().min(1).max(220),
  startPrintedPage: z.number().int().min(1).nullable().optional(),
})

const aiUnitSchema = z.object({
  unitNumber: z.number().int().min(1).nullable().optional(),
  title: z.string().min(1).max(220),
  lessons: z.array(aiLessonSchema).default([]),
  specialSections: z.array(aiSpecialSchema).default([]),
})

const aiResponseSchema = z.object({
  units: z.array(aiUnitSchema).min(1).max(40),
})

export type TocV2ImagePart = z.infer<typeof imageSchema>

export type GeminiTocV2Result =
  | {
      ok: true
      drafts: TocUnitDraft[]
      lessonsByUnit: BookLessonRecord[][]
      diagnostics: { model: string; notCountedPdfPages: number[] }
    }
  | { ok: false; error: string; status?: number }

function parseJsonObject(raw: string): unknown {
  const trimmed = raw.trim()
  const withoutFence = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
    : trimmed
  const first = withoutFence.indexOf('{')
  const last = withoutFence.lastIndexOf('}')
  const candidate = first >= 0 && last > first ? withoutFence.slice(first, last + 1) : withoutFence
  return JSON.parse(candidate)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function callGemini(
  apiKey: string,
  model: string,
  userParts: unknown[],
): Promise<
  | { ok: true; text: string }
  | { ok: false; status: number; details?: string }
> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120_000)
  let res: Response
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: PROMPT }] },
          contents: [{ role: 'user', parts: userParts }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
            maxOutputTokens: 8192,
          },
        }),
        signal: controller.signal,
      },
    )
  } catch {
    clearTimeout(timeout)
    return { ok: false, status: 504 }
  } finally {
    clearTimeout(timeout)
  }
  if (!res.ok) {
    let details = ''
    try {
      const body = (await res.json()) as {
        error?: { message?: string; status?: string; code?: number }
      }
      const message = body?.error?.message?.trim()
      const statusText = body?.error?.status?.trim()
      details = [message, statusText].filter(Boolean).join(' | ')
    } catch {
      try {
        details = (await res.text()).slice(0, 400)
      } catch {
        details = ''
      }
    }
    return { ok: false, status: res.status, details: details || undefined }
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
  if (!text) return { ok: false, status: 204 }
  return { ok: true, text }
}

function lessonFromAi(
  lesson: z.infer<typeof aiLessonSchema>,
): BookLessonRecord {
  const parts: BookLessonPartRecord[] = lesson.entries.reduce<BookLessonPartRecord[]>((acc, entry, partIndex) => {
    const startPrinted = entry.startPrintedPage ?? null
    if (startPrinted == null) return acc
    const title = entry.title.trim()
    acc.push({
      id: `part-${randomUUID().slice(0, 8)}`,
      title,
      structureTag: computeStructureTagFromTitleAndIndex({ title }, partIndex),
      startPageHint: startPrinted,
      anchorSource: 'toc',
      anchorConfidence: 'high',
    })
    return acc
  }, [])

  for (let i = 0; i < parts.length; i++) {
    const current = parts[i]
    const next = parts[i + 1]
    if (!current?.startPageHint) continue
    if (next?.startPageHint) current.endPageHint = Math.max(current.startPageHint, next.startPageHint - 1)
  }

  const titleBase = lesson.title.trim()
  const lessonNumOneBased = Math.max(1, Math.floor(lesson.lessonNumber ?? 1))
  const finalTitle = formatLessonTitleWithNumber(lessonNumOneBased, titleBase)
  const startPageHint = parts[0]?.startPageHint
  return {
    id: `lesson-${randomUUID().slice(0, 8)}`,
    title: finalTitle,
    ...(startPageHint ? { startPageHint } : {}),
    ...(startPageHint ? { anchorSource: 'toc' as const } : {}),
    ...(startPageHint ? { anchorConfidence: 'high' as const } : {}),
    ...(parts.length ? { parts } : {}),
  }
}

export function normalizeTocV2ToDrafts(
  parsed: z.infer<typeof aiResponseSchema>,
): { drafts: TocUnitDraft[]; lessonsByUnit: BookLessonRecord[][] } {
  const drafts: TocUnitDraft[] = []
  const lessonsByUnit: BookLessonRecord[][] = []
  for (let unitIdx = 0; unitIdx < parsed.units.length; unitIdx++) {
    const unit = parsed.units[unitIdx]!
    const lessons = unit.lessons.map((lesson) => lessonFromAi(lesson))

    for (const special of unit.specialSections) {
      const specialStartPrinted = special.startPrintedPage ?? null
      let startPdf = specialStartPrinted
      if (startPdf == null && /glossary/i.test(special.title)) {
        const wrap = lessons.find((lesson) => /unit\s*wrap[\s-]*up/i.test(lesson.title))
        if (wrap?.startPageHint) startPdf = wrap.startPageHint + 1
      }
      if (startPdf == null) continue
      lessons.push({
        id: `lesson-${randomUUID().slice(0, 8)}`,
        title: special.title.trim(),
        startPageHint: startPdf,
        anchorSource: 'toc',
        anchorConfidence: 'high',
      })
    }

    lessons.sort((a, b) => (a.startPageHint ?? Number.MAX_SAFE_INTEGER) - (b.startPageHint ?? Number.MAX_SAFE_INTEGER))
    for (let i = 0; i < lessons.length; i++) {
      const current = lessons[i]
      const next = lessons[i + 1]
      if (!current?.startPageHint) continue
      if (/unit\s*wrap[\s-]*up/i.test(current.title)) {
        current.endPageHint = current.startPageHint
      } else if (next?.startPageHint) {
        current.endPageHint = Math.max(current.startPageHint, next.startPageHint - 1)
      }
    }

    const unitStart = lessons.find((lesson) => lesson.startPageHint != null)?.startPageHint
    const draft: TocUnitDraft = {
      id: `unit-${unitIdx + 1}-${randomUUID().slice(0, 8)}`,
      title: unit.title.trim(),
      needsReview: false,
      ...(unitStart ? { startPageHint: unitStart } : {}),
      ...(unitStart ? { anchorSource: 'toc' as const } : {}),
      ...(unitStart ? { anchorConfidence: 'high' as const } : {}),
    }
    drafts.push(draft)
    lessonsByUnit.push(lessons)
  }

  for (let i = 0; i < drafts.length; i++) {
    const current = drafts[i]
    const next = drafts[i + 1]
    if (!current?.startPageHint) continue
    if (next?.startPageHint) {
      current.endPageHint = Math.max(current.startPageHint, next.startPageHint - 1)
    } else {
      const lastLesson = lessonsByUnit[i]?.[lessonsByUnit[i]!.length - 1]
      if (lastLesson?.endPageHint) current.endPageHint = lastLesson.endPageHint
      else if (lastLesson?.startPageHint) current.endPageHint = lastLesson.startPageHint
    }
  }

  return { drafts, lessonsByUnit }
}

export async function extractTocWithGeminiV2(
  images: TocV2ImagePart[],
  totalPdfPages: number,
  notCountedPdfPagesInput: number[] = [],
): Promise<GeminiTocV2Result> {
  try {
    const key = await resolveGeminiApiKey()
    if (!key) return { ok: false, error: 'No GEMINI_API_KEY configured.', status: 503 }
    const notCountedPdfPages = normalizeNotCountedPdfPages(notCountedPdfPagesInput, totalPdfPages)
    const userParts: unknown[] = [
      { text: `These are consecutive TOC images from one book PDF. totalPdfPages=${totalPdfPages}.` },
      { text: `Globally not counted PDF pages: ${notCountedPdfPages.join(', ') || '(none)'}` },
    ]
    for (const image of images) {
      userParts.push({ text: `Image source PDF page ${image.pdfPage}:` })
      userParts.push({
        inline_data: {
          mime_type: image.mimeType ?? 'image/jpeg',
          data: image.base64,
        },
      })
    }

    let lastStatus = 502
    let lastErrorDetails = ''
    const failureMessages: string[] = []
    for (const model of MODEL_CANDIDATES) {
      let result = await callGemini(key, model, userParts)
      for (let retry = 0; retry < MAX_UNAVAILABLE_RETRIES_PER_MODEL && !result.ok && result.status === UNAVAILABLE_STATUS; retry++) {
        const waitMs = RETRY_BACKOFF_MS * (retry + 1)
        console.warn(`Gemini model ${model} unavailable (503). Retrying in ${waitMs}ms...`)
        await sleep(waitMs)
        result = await callGemini(key, model, userParts)
      }
      if (!result.ok) {
        lastStatus = result.status
        lastErrorDetails = result.details ?? ''
        const detailText = result.details ? ` (${result.details})` : ''
        failureMessages.push(`${model}: ${result.status}${detailText}`)
        continue
      }
      try {
        const raw = parseJsonObject(result.text)
        const parsed = aiResponseSchema.parse(raw)
        const normalized = normalizeTocV2ToDrafts(parsed)
        if (normalized.drafts.length === 0) {
          return { ok: false, error: 'No units were extracted from TOC.', status: 422 }
        }
        return {
          ok: true,
          drafts: normalized.drafts,
          lessonsByUnit: normalized.lessonsByUnit,
          diagnostics: { model, notCountedPdfPages },
        }
      } catch {
        lastStatus = 422
        continue
      }
    }
    const mappedStatus = lastStatus === 404 ? 502 : lastStatus
    if (failureMessages.length > 0) {
      console.error('Gemini TOC extraction failed for all candidate models', failureMessages)
    }
    const detailsSuffix = lastErrorDetails ? ` ${lastErrorDetails}` : ''
    return {
      ok: false,
      error: `TOC extraction failed (${lastStatus}).${detailsSuffix}`,
      status: mappedStatus,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected extraction error.'
    return { ok: false, error: `TOC extraction crashed: ${message}`, status: 500 }
  }
}

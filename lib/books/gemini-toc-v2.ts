import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { BookLessonPartRecord, BookLessonRecord } from '@/lib/books/types'
import { computeStructureTagsForParts } from '@/lib/books/part-structure-tag'
import type { TocUnitDraft } from '@/lib/books/toc-import'
import { formatTocChunkTitle } from '@/lib/books/lesson-title'
import { normalizeNotCountedPdfPages } from '@/lib/books/page-alignment'
import { polishTocLessonsForUnit } from '@/lib/books/polish-toc-lessons'
import { resolveGeminiApiKey } from '@/lib/gemini'
import {
  isTocExtractProfileId,
  tocChunkLabelStyleForProfile,
  tocExtractPromptForProfile,
  type TocExtractProfileId,
} from '@/lib/books/toc-extract-profile'

const MODEL_CANDIDATES = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-flash-latest',
] as const

const UNAVAILABLE_STATUS = 503
const MAX_UNAVAILABLE_RETRIES_PER_MODEL = 2
const RETRY_BACKOFF_MS = 2500

/** About the Illustrator + Respond to Text when TOC does not list them as separate rows. */
export const LITERATURE_POST_STORY_TRAILING_PAGES = 2

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
      diagnostics: { model: string; notCountedPdfPages: number[]; profile: TocExtractProfileId }
    }
  | { ok: false; error: string; status?: number }

export function normalizeTocExtractProfile(value: unknown): TocExtractProfileId {
  return isTocExtractProfileId(value) ? value : 'generic'
}

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
  systemPrompt: string,
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
          systemInstruction: { parts: [{ text: systemPrompt }] },
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

function isLiteratureStoryPartTag(tag: BookLessonPartRecord['structureTag']): boolean {
  return tag === 'main_story' || tag === 'paired_story'
}

/**
 * Fill missing part ends from next part / lesson end, then for Literature:
 * when a story is followed by another story, trim LITERATURE_POST_STORY_TRAILING_PAGES
 * and insert a synthetic "Respond to the Text" part in the gap.
 * Do **not** trim or insert after the last story in the week (paired selection usually
 * runs to the next week / lesson with no post-read pages after it).
 * Skip when the next part is already post-read (TOC-bounded).
 */
export function applyLiteratureStoryEndTrims(lesson: BookLessonRecord): void {
  const parts = lesson.parts
  if (!parts?.length) return

  for (let i = 0; i < parts.length; i++) {
    const current = parts[i]
    if (!current?.startPageHint) continue
    const next = parts[i + 1]
    if (current.endPageHint == null) {
      if (next?.startPageHint) {
        current.endPageHint = Math.max(current.startPageHint, next.startPageHint - 1)
      } else if (typeof lesson.endPageHint === 'number') {
        current.endPageHint = Math.max(current.startPageHint, lesson.endPageHint)
      }
    }
  }

  const nextParts: BookLessonPartRecord[] = []
  for (let i = 0; i < parts.length; i++) {
    const current = parts[i]!
    const next = parts[i + 1]

    if (
      current.startPageHint != null &&
      current.endPageHint != null &&
      isLiteratureStoryPartTag(current.structureTag) &&
      next != null &&
      isLiteratureStoryPartTag(next.structureTag)
    ) {
      const originalEnd = current.endPageHint
      const trimmedEnd = Math.max(
        current.startPageHint,
        originalEnd - LITERATURE_POST_STORY_TRAILING_PAGES,
      )
      current.endPageHint = trimmedEnd
      nextParts.push(current)
      if (trimmedEnd < originalEnd) {
        nextParts.push({
          id: `part-${randomUUID().slice(0, 8)}`,
          title: 'Respond to the Text',
          structureTag: 'your_turn',
          startPageHint: trimmedEnd + 1,
          endPageHint: originalEnd,
          anchorSource: 'toc',
          anchorConfidence: 'medium',
        })
      }
      continue
    }

    nextParts.push(current)
  }

  lesson.parts = nextParts
}

function lessonFromAi(
  lesson: z.infer<typeof aiLessonSchema>,
  profile: TocExtractProfileId,
): BookLessonRecord {
  const entries = lesson.entries.reduce<Array<{ title: string; startPageHint?: number }>>(
    (acc, entry) => {
      const title = entry.title.trim()
      if (!title) return acc
      const startPrinted = entry.startPrintedPage ?? null
      acc.push({
        title,
        ...(typeof startPrinted === 'number' ? { startPageHint: startPrinted } : {}),
      })
      return acc
    },
    [],
  )
  const tags = computeStructureTagsForParts(entries, profile)
  const parts: BookLessonPartRecord[] = entries.map((entry, partIndex) => ({
    id: `part-${randomUUID().slice(0, 8)}`,
    title: entry.title,
    structureTag: tags[partIndex]!,
    ...(typeof entry.startPageHint === 'number' ? { startPageHint: entry.startPageHint } : {}),
    ...(typeof entry.startPageHint === 'number'
      ? { anchorSource: 'toc' as const, anchorConfidence: 'high' as const }
      : {}),
  }))

  for (let i = 0; i < parts.length; i++) {
    const current = parts[i]
    const next = parts[i + 1]
    if (!current?.startPageHint) continue
    if (next?.startPageHint) current.endPageHint = Math.max(current.startPageHint, next.startPageHint - 1)
  }

  const titleBase = lesson.title.trim()
  const lessonNumOneBased = Math.max(1, Math.floor(lesson.lessonNumber ?? 1))
  const finalTitle = formatTocChunkTitle(
    lessonNumOneBased,
    titleBase,
    tocChunkLabelStyleForProfile(profile),
  )
  const startPageHint = parts.find((p) => typeof p.startPageHint === 'number')?.startPageHint
  return {
    id: `lesson-${randomUUID().slice(0, 8)}`,
    title: finalTitle,
    ...(startPageHint != null ? { startPageHint } : {}),
    ...(startPageHint != null ? { anchorSource: 'toc' as const } : {}),
    ...(startPageHint != null ? { anchorConfidence: 'high' as const } : {}),
    ...(parts.length ? { parts } : {}),
  }
}

export function normalizeTocV2ToDrafts(
  parsed: z.infer<typeof aiResponseSchema>,
  profile: TocExtractProfileId = 'generic',
): { drafts: TocUnitDraft[]; lessonsByUnit: BookLessonRecord[][] } {
  const drafts: TocUnitDraft[] = []
  const lessonsByUnit: BookLessonRecord[][] = []
  for (let unitIdx = 0; unitIdx < parsed.units.length; unitIdx++) {
    const unit = parsed.units[unitIdx]!
    const lessons = unit.lessons.map((lesson) => lessonFromAi(lesson, profile))

    for (const special of unit.specialSections) {
      const title = special.title.trim()
      if (!title) continue
      const specialStartPrinted = special.startPrintedPage ?? null
      lessons.push({
        id: `lesson-${randomUUID().slice(0, 8)}`,
        title,
        ...(typeof specialStartPrinted === 'number'
          ? {
              startPageHint: specialStartPrinted,
              anchorSource: 'toc' as const,
              anchorConfidence: 'high' as const,
            }
          : {}),
      })
    }

    const polished = polishTocLessonsForUnit(unit.title.trim(), lessons, profile)

    const unitStart = polished.find((lesson) => lesson.startPageHint != null)?.startPageHint
    const draft: TocUnitDraft = {
      id: `unit-${unitIdx + 1}-${randomUUID().slice(0, 8)}`,
      title: unit.title.trim(),
      needsReview: polished.length === 0,
      ...(unitStart ? { startPageHint: unitStart } : {}),
      ...(unitStart ? { anchorSource: 'toc' as const } : {}),
      ...(unitStart ? { anchorConfidence: 'high' as const } : {}),
    }
    drafts.push(draft)
    lessonsByUnit.push(polished)
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

  // Literature: week/unit ends must exist before we can attach Respond after the paired story.
  if (profile === 'wonders_literature') {
    for (let i = 0; i < lessonsByUnit.length; i++) {
      const unitEnd = drafts[i]?.endPageHint
      const lessons = lessonsByUnit[i] ?? []
      for (const lesson of lessons) {
        if (lesson.endPageHint == null && typeof unitEnd === 'number') {
          lesson.endPageHint = Math.max(lesson.startPageHint ?? unitEnd, unitEnd)
        }
        applyLiteratureStoryEndTrims(lesson)
      }
    }
  }

  return { drafts, lessonsByUnit }
}

export async function extractTocWithGeminiV2(
  images: TocV2ImagePart[],
  totalPdfPages: number,
  notCountedPdfPagesInput: number[] = [],
  profileInput: TocExtractProfileId | string = 'generic',
): Promise<GeminiTocV2Result> {
  try {
    const profile = normalizeTocExtractProfile(profileInput)
    const systemPrompt = tocExtractPromptForProfile(profile)
    const key = await resolveGeminiApiKey()
    if (!key) return { ok: false, error: 'No GEMINI_API_KEY configured.', status: 503 }
    const notCountedPdfPages = normalizeNotCountedPdfPages(notCountedPdfPagesInput, totalPdfPages)
    const userParts: unknown[] = [
      {
        text: `These are consecutive TOC images from one book PDF. totalPdfPages=${totalPdfPages}. extractProfile=${profile}.`,
      },
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
      let result = await callGemini(key, model, userParts, systemPrompt)
      for (
        let retry = 0;
        retry < MAX_UNAVAILABLE_RETRIES_PER_MODEL && !result.ok && result.status === UNAVAILABLE_STATUS;
        retry++
      ) {
        const waitMs = RETRY_BACKOFF_MS * (retry + 1)
        console.warn(`Gemini model ${model} unavailable (503). Retrying in ${waitMs}ms...`)
        await sleep(waitMs)
        result = await callGemini(key, model, userParts, systemPrompt)
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
        const normalized = normalizeTocV2ToDrafts(parsed, profile)
        if (normalized.drafts.length === 0) {
          return { ok: false, error: 'No units were extracted from TOC.', status: 422 }
        }
        return {
          ok: true,
          drafts: normalized.drafts,
          lessonsByUnit: normalized.lessonsByUnit,
          diagnostics: { model, notCountedPdfPages, profile },
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

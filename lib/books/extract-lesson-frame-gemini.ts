import 'server-only'

import { readFile } from 'node:fs/promises'
import { PDFDocument } from 'pdf-lib'
import {
  combineLessonFrameSectionPatches,
  lessonFrameHasContent,
  lessonFrameId,
  lessonFrameSectionPatchHasContent,
  mergeLessonFrameSection,
  sanitizeLessonFrameRecord,
  seedLessonFramePatchFromSectionTitle,
  type LessonFrameRecord,
  type LessonFrameSectionPatch,
} from '@/lib/books/lesson-frame'
import type { LessonFrameSection } from '@/lib/books/lesson-frame-pages'
import { extractPdfPageRangeText } from '@/lib/books/extract-story-pdf-text'
import { slicePdfToTwoPageBytes } from '@/lib/context/slice-pdf-two-pages'
import { resolveGeminiApiKey } from '@/lib/gemini'
import type { BookLessonPartTag } from '@/lib/books/types'

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'] as const
/** Vision OCR: one page at a time (smaller payloads, fewer timeouts). */
const VISION_CHUNK_PAGES = 1
/** Prefer vision OCR when embedded PDF text is thinner than this. */
const THIN_PDF_TEXT_CHARS = 80

const FRAME_PAGE_TRANSCRIBE_INSTRUCTION = `You are a careful transcription assistant for ESL teacher editions / reading workshop lesson pages.

The attached PDF is one or two instructional pages (vocabulary, comprehension skill, strategy, genre — NOT the main story).

Your job:
- Transcribe ALL useful teaching text in reading order: headings, Words to Know / vocabulary lists, definitions if short, skill names, strategy names, essential questions, teaching blurbs, directions to the teacher.
- KEEP vocabulary word lists and "Words to Know" boxes — list every headword you can read.
- Keep comprehension skill / strategy labels and short teaching notes.
- Skip decorative page chrome and tiny footer legalese when possible.
- Do not invent text. If a word is unreadable, use [?].
- Return plain text only — no JSON, no markdown fences, no commentary.`

const SYSTEM_INSTRUCTION = `You are helping an ESL teacher prep a Journeys / Wonders reading lesson.

Given a FULL page transcript from ONE lesson section (vocabulary, comprehension skill/strategy, genre, etc. — NOT the main story body), extract structured fields as JSON.

Return this shape (use "" or [] when missing):
{
  "comprehensionSkill": "string — week's comprehension skill if named on these pages",
  "readingStrategy": "string — reading strategy if named on these pages",
  "essentialQuestion": "string — essential question if present",
  "lessonGoals": ["short goal bullets if present"],
  "targetVocabulary": ["headwords only from Words to Know / target vocabulary on these pages"],
  "teachingNotes": "2–6 sentences from the skill teaching blurb on these pages, or \\"\\""
}

Rules:
- Prefer exact labels from the page (skill names, EQ wording, vocabulary headwords).
- For vocabulary pages: fill targetVocabulary with every Words to Know / target word you see (headwords only, not full definitions).
- Only fill fields that appear on THESE pages. Leave others "".
- Do not invent vocabulary not on the pages.
- Return ONLY JSON (no markdown fences).`

function sectionFocusHint(tag: BookLessonPartTag | 'fallback', title: string): string {
  switch (tag) {
    case 'vocabulary_in_context':
    case 'vocabulary_background':
      return 'Focus: extract EVERY Words to Know / vocabulary headword into targetVocabulary. Do not leave targetVocabulary empty if any word list is on the page.'
    case 'vocabulary_strategy':
      return 'Focus: vocabulary strategy name into teachingNotes (and readingStrategy only if clearly a reading strategy). Skip inventing skill/EQ.'
    case 'comprehension':
      return 'Focus: comprehension skill and/or reading strategy names, essential question if present, short teaching notes from the page body.'
    case 'genre':
    case 'literary_element':
      return 'Focus: genre or literary element label; light teaching notes from the page body.'
    default:
      return `Focus: extract skill, strategy, EQ, vocab, or notes relevant to "${title}" from the full transcript.`
  }
}

function isVocabSectionTag(tag: BookLessonPartTag | 'fallback'): boolean {
  return tag === 'vocabulary_in_context' || tag === 'vocabulary_background'
}

function parseJsonFromModelText(text: string): unknown {
  const trimmed = text.trim()
  const withoutFence = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
    : trimmed
  const first = withoutFence.indexOf('{')
  const last = withoutFence.lastIndexOf('}')
  const candidate = first >= 0 && last > first ? withoutFence.slice(first, last + 1) : withoutFence
  return JSON.parse(candidate) as unknown
}

async function callGeminiJson(
  userText: string,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const key = await resolveGeminiApiKey()
  if (!key) {
    return {
      ok: false,
      error: 'Gemini API key is not configured. Set GEMINI_API_KEY to scan the lesson frame.',
    }
  }
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
            contents: [{ role: 'user', parts: [{ text: userText }] }],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: 'application/json',
              maxOutputTokens: 4096,
            },
          }),
        },
      )
      if (!res.ok) continue
      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
      }
      const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim()
      if (text) return { ok: true, text }
    } catch {
      continue
    }
  }
  return { ok: false, error: 'Gemini could not build a lesson frame. Try again, or fill it by hand.' }
}

async function callGeminiWithPdf(
  userText: string,
  pdfBytes: Uint8Array,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const key = await resolveGeminiApiKey()
  if (!key) {
    return {
      ok: false,
      error: 'Gemini API key is not configured. Set GEMINI_API_KEY to scan the lesson frame.',
    }
  }
  const base64 = Buffer.from(pdfBytes).toString('base64')
  const failures: string[] = []
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: FRAME_PAGE_TRANSCRIBE_INSTRUCTION }] },
            contents: [
              {
                role: 'user',
                parts: [
                  { text: userText },
                  { inlineData: { mimeType: 'application/pdf', data: base64 } },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 8192,
            },
          }),
        },
      )
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        const snippet = body.replace(/\s+/g, ' ').trim().slice(0, 180)
        if (res.status === 429) {
          failures.push(`${model}: rate limited`)
        } else {
          failures.push(`${model}: HTTP ${res.status}${snippet ? ` (${snippet})` : ''}`)
        }
        continue
      }
      const data = (await res.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> }
          finishReason?: string
        }>
        promptFeedback?: { blockReason?: string }
      }
      const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim()
      if (text) return { ok: true, text }
      const block = data?.promptFeedback?.blockReason
      const finish = data?.candidates?.[0]?.finishReason
      failures.push(
        `${model}: empty${block ? ` (blocked: ${block})` : finish ? ` (${finish})` : ''}`,
      )
    } catch (err) {
      failures.push(`${model}: ${err instanceof Error ? err.message : 'network error'}`)
    }
  }
  const detail = failures[0] ?? 'unknown error'
  const rateLimited = failures.some((f) => /rate limited/i.test(f))
  return {
    ok: false,
    error: rateLimited
      ? 'Gemini is rate-limiting page reads right now. Wait a minute and retry, or Continue to skip this section.'
      : `Gemini could not read these lesson pages (${detail}). Try again, or fill the frame by hand.`,
  }
}

async function getPdfPageCount(absFilePath: string): Promise<number> {
  const bytes = await readFile(absFilePath)
  const src = await PDFDocument.load(bytes)
  return src.getPageCount()
}

/**
 * Vision OCR for lesson-frame pages (keeps vocab boxes — unlike story OCR).
 */
async function extractFramePageChunkWithGemini(
  absFilePath: string,
  chunkStartPdfPage: number,
  chunkEndPdfPage: number,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const start = Math.max(1, Math.floor(chunkStartPdfPage))
  const end = Math.max(start, Math.floor(chunkEndPdfPage))

  let filePageCount = 0
  try {
    filePageCount = await getPdfPageCount(absFilePath)
  } catch {
    return { ok: false, error: 'Could not open this unit’s PDF.' }
  }
  if (start > filePageCount) {
    return {
      ok: false,
      error: `Those pages aren’t in this PDF (file has ${filePageCount} pages).`,
    }
  }
  const chunkEnd = Math.min(end, filePageCount)
  const pdfBytes = await slicePdfToTwoPageBytes(absFilePath, start, chunkEnd)
  if (!pdfBytes?.length) {
    return { ok: false, error: `Could not cut PDF pages ${start}–${chunkEnd}.` }
  }

  const pageRangeLabel =
    start === chunkEnd
      ? `PDF page ${start} (1-based). The attachment contains ONLY this page.`
      : `PDF pages ${start}–${chunkEnd} (1-based, inclusive). The attachment contains ONLY these pages.`

  const gem = await callGeminiWithPdf(
    `${pageRangeLabel}\n\nTranscribe all teaching text on these pages, including Words to Know / vocabulary lists.`,
    pdfBytes,
  )
  if (!gem.ok) return gem
  const body = gem.text.trim()
  if (!body) return { ok: true, text: '' }
  const heading = start === chunkEnd ? `--- Page ${start} ---` : `--- Pages ${start}–${chunkEnd} ---`
  return { ok: true, text: `${heading}\n${body}` }
}

function pdfTextLooksUsefulForFrame(text: string, tag: BookLessonPartTag | 'fallback'): boolean {
  const t = text.trim()
  if (t.length < THIN_PDF_TEXT_CHARS) return false
  if (isVocabSectionTag(tag)) {
    // Embedded text often misses word-list art; require a vocab cue or force vision.
    return /\b(words?\s+to\s+know|vocabulary|word\s+bank)\b/i.test(t) && t.length >= 120
  }
  return true
}

async function transcriptPdfRange(
  absFilePath: string,
  startPdfPage: number,
  endPdfPage: number,
  options?: { forceVision?: boolean; tag?: BookLessonPartTag | 'fallback' },
): Promise<
  | { ok: true; transcript: string; usedGemini: boolean; visionFailed?: boolean }
  | { ok: false; error: string }
> {
  const start = Math.max(1, Math.floor(startPdfPage))
  const end = Math.max(start, Math.floor(endPdfPage))
  const tag = options?.tag ?? 'fallback'
  const preferVision = Boolean(options?.forceVision) || isVocabSectionTag(tag)

  // Always collect embedded PDF text as a safety net (survives vision rate limits).
  const pdfExtract = await extractPdfPageRangeText(absFilePath, start, end)
  const pdfText = pdfExtract.text.trim()
  const pdfUseful = pdfTextLooksUsefulForFrame(pdfText, tag)

  if (!preferVision && pdfUseful) {
    return {
      ok: true,
      transcript: `--- PDF pages ${start}–${end} ---\n${pdfText}`,
      usedGemini: false,
    }
  }

  // Try vision OCR (one page at a time).
  const visionParts: string[] = []
  let visionError: string | null = null
  for (let chunkStart = start; chunkStart <= end; chunkStart += VISION_CHUNK_PAGES) {
    const chunkEnd = Math.min(chunkStart + VISION_CHUNK_PAGES - 1, end)
    const gem = await extractFramePageChunkWithGemini(absFilePath, chunkStart, chunkEnd)
    if (!gem.ok) {
      visionError = gem.error
      break
    }
    if (gem.text.trim()) visionParts.push(gem.text.trim())
  }

  const visionTranscript = visionParts.join('\n\n').trim()
  if (visionTranscript) {
    return { ok: true, transcript: visionTranscript, usedGemini: true }
  }

  // Vision failed or empty — fall back to any embedded PDF text.
  if (pdfText) {
    return {
      ok: true,
      transcript: `--- PDF pages ${start}–${end} ---\n${pdfText}`,
      usedGemini: false,
      visionFailed: Boolean(visionError),
    }
  }

  return {
    ok: false,
    error:
      visionError ??
      'No text found on those lesson pages. Check the outline page range, or fill the frame by hand.',
  }
}

function patchFromModelRow(row: Record<string, unknown>): LessonFrameSectionPatch {
  return {
    comprehensionSkill: typeof row.comprehensionSkill === 'string' ? row.comprehensionSkill : '',
    readingStrategy: typeof row.readingStrategy === 'string' ? row.readingStrategy : '',
    essentialQuestion: typeof row.essentialQuestion === 'string' ? row.essentialQuestion : '',
    lessonGoals: Array.isArray(row.lessonGoals) ? row.lessonGoals.map(String) : [],
    targetVocabulary: Array.isArray(row.targetVocabulary) ? row.targetVocabulary.map(String) : [],
    teachingNotes: typeof row.teachingNotes === 'string' ? row.teachingNotes : '',
  }
}

/**
 * Transcribe one outline section and extract a partial frame patch.
 * Empty patches are ok (soft skip); hard errors return ok: false.
 * If page read fails but the outline title has skill/strategy labels, soft-succeed from the title.
 */
export async function extractLessonFrameSectionFromPdf(params: {
  absFilePath: string
  section: LessonFrameSection
  lessonTitle?: string
}): Promise<
  | { ok: true; patch: LessonFrameSectionPatch; usedGemini: boolean; empty: boolean }
  | { ok: false; error: string }
> {
  const { section } = params
  const fromTitle = seedLessonFramePatchFromSectionTitle(section.title, section.tag)

  const transcribed = await transcriptPdfRange(
    params.absFilePath,
    section.startPdfPage,
    section.endPdfPage,
    { tag: section.tag, forceVision: isVocabSectionTag(section.tag) },
  )

  if (!transcribed.ok) {
    // Don't hard-fail labeled skill/strategy/genre rows — keep title seed so the draft progresses.
    if (lessonFrameSectionPatchHasContent(fromTitle) && !isVocabSectionTag(section.tag)) {
      return { ok: true, patch: fromTitle, usedGemini: false, empty: false }
    }
    return transcribed
  }

  const userText = [
    `Lesson title: ${params.lessonTitle?.trim() || '(unknown)'}`,
    `Section title: ${section.title}`,
    `Section tag: ${section.tag}`,
    sectionFocusHint(section.tag, section.title),
    `Printed pages: ${section.startDisplayPage}–${section.endDisplayPage}`,
    `PDF pages: ${section.startPdfPage}–${section.endPdfPage}`,
    transcribed.visionFailed
      ? 'Note: page image OCR failed; transcript is from the PDF text layer only (may be incomplete).'
      : '',
    '',
    'Full page transcript (read carefully — extract from this text, not from the section title alone):',
    transcribed.transcript.slice(0, 40_000),
  ]
    .filter(Boolean)
    .join('\n')

  const gem = await callGeminiJson(userText)
  if (!gem.ok) {
    if (lessonFrameSectionPatchHasContent(fromTitle) && !isVocabSectionTag(section.tag)) {
      return { ok: true, patch: fromTitle, usedGemini: transcribed.usedGemini, empty: false }
    }
    return gem
  }

  let parsed: unknown
  try {
    parsed = parseJsonFromModelText(gem.text)
  } catch {
    if (lessonFrameSectionPatchHasContent(fromTitle) && !isVocabSectionTag(section.tag)) {
      return { ok: true, patch: fromTitle, usedGemini: transcribed.usedGemini, empty: false }
    }
    return { ok: false, error: 'AI returned an unreadable lesson frame. Try scan again.' }
  }

  const row = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>
  const fromModel = patchFromModelRow(row)
  // Title seed is backup only when the page model left skill/strategy labels empty.
  const patch = combineLessonFrameSectionPatches(fromModel, fromTitle)

  // Vocab pages: if still no words, soft skip (do not invent words from the title "Vocabulary").
  if (isVocabSectionTag(section.tag) && !(patch.targetVocabulary ?? []).some((w) => w.trim())) {
    return {
      ok: true,
      patch: { ...patch, targetVocabulary: [] },
      usedGemini: transcribed.usedGemini,
      empty: !lessonFrameSectionPatchHasContent({ ...patch, targetVocabulary: [] }),
    }
  }

  return {
    ok: true,
    patch,
    usedGemini: transcribed.usedGemini,
    empty: !lessonFrameSectionPatchHasContent(patch),
  }
}

/**
 * Transcribe lesson-frame PDF pages and structure them into a draft LessonFrameRecord.
 * @deprecated Prefer section-by-section extract + merge for Workshop layouts.
 */
export async function extractLessonFrameFromPdf(params: {
  absFilePath: string
  bookId: string
  unitId: string
  lessonId: string
  lessonTitle?: string
  startPdfPage: number
  endPdfPage: number
  startDisplayPage?: number | null
  endDisplayPage?: number | null
}): Promise<{ ok: true; frame: LessonFrameRecord } | { ok: false; error: string }> {
  const start = Math.max(1, Math.floor(params.startPdfPage))
  const end = Math.max(start, Math.floor(params.endPdfPage))

  const transcribed = await transcriptPdfRange(params.absFilePath, start, end, {
    forceVision: true,
    tag: 'fallback',
  })
  if (!transcribed.ok) return transcribed

  const userText = [
    `Lesson title: ${params.lessonTitle?.trim() || '(unknown)'}`,
    `Printed pages (hint): ${params.startDisplayPage ?? '?'}–${params.endDisplayPage ?? '?'}`,
    `PDF pages: ${start}–${end}`,
    '',
    'Full page transcript:',
    transcribed.transcript.slice(0, 40_000),
  ].join('\n')

  const gem = await callGeminiJson(userText)
  if (!gem.ok) return gem

  let parsed: unknown
  try {
    parsed = parseJsonFromModelText(gem.text)
  } catch {
    return { ok: false, error: 'AI returned an unreadable lesson frame. Try scan again.' }
  }

  const row = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>
  const frame = sanitizeLessonFrameRecord({
    id: lessonFrameId(params.bookId, params.unitId, params.lessonId),
    bookId: params.bookId,
    unitId: params.unitId,
    lessonId: params.lessonId,
    lessonTitle: params.lessonTitle,
    ...patchFromModelRow(row),
    sourcePageRange: { startPdfPage: start, endPdfPage: end },
    startDisplayPage: params.startDisplayPage ?? null,
    endDisplayPage: params.endDisplayPage ?? null,
    status: 'draft',
    source: transcribed.usedGemini ? 'gemini' : 'pdf',
  })

  if (!frame) {
    return { ok: false, error: 'Could not save lesson frame.' }
  }

  if (!lessonFrameHasContent(frame)) {
    return {
      ok: false,
      error:
        'AI found little lesson-frame content on those pages. Try a different range, or fill the frame by hand.',
    }
  }

  return { ok: true, frame }
}

export { mergeLessonFrameSection, lessonFrameHasContent }

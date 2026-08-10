import type { ReadingStoryTextRecord } from '@/lib/books/reading-story-text'
import { coveredPdfPagesFromStoryText } from '@/lib/books/reading-story-page-markers'

/** Default pages per scan step — matches server Gemini window. */
const DEFAULT_CHUNK_PAGES = 2

export type StoryScanPageStatus = 'pending' | 'active' | 'done' | 'failed'

export interface StoryScanPageProgress {
  pdfPage: number
  label: string
  status: StoryScanPageStatus
}

export interface StoryScanProgress {
  pages: StoryScanPageProgress[]
  doneCount: number
  totalCount: number
  percent: number
  /** Human label for the pages currently extracting, e.g. "12–13". */
  activeLabel: string | null
  message: string
}

export interface StoryScanPlanPage {
  pdfPage: number
  label: string
}

export interface StoryScanPlan {
  startPdfPage: number
  endPdfPage: number
  startDisplayPage: number | null
  endDisplayPage: number | null
  pageCount: number
  chunkPages: number
  pages: StoryScanPlanPage[]
}

export type ChunkedStoryScanResult =
  | { ok: true; text: ReadingStoryTextRecord; interrupted: false }
  | { ok: true; text: ReadingStoryTextRecord; interrupted: true }
  | { ok: false; error: string; text: ReadingStoryTextRecord | null }

export type StoryTextScanMode = 'full' | 'continue'

function buildProgress(
  pages: StoryScanPageProgress[],
  message: string,
  activeLabel: string | null = null,
): StoryScanProgress {
  const doneCount = pages.filter((p) => p.status === 'done').length
  const totalCount = pages.length
  const percent = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100)
  return { pages, doneCount, totalCount, percent, activeLabel, message }
}

function pageLabelRange(pages: StoryScanPageProgress[], from: number, to: number): string {
  const slice = pages.filter((p) => p.pdfPage >= from && p.pdfPage <= to)
  if (slice.length === 0) return `${from}–${to}`
  const first = slice[0]!.label
  const last = slice[slice.length - 1]!.label
  return first === last ? first : `${first}–${last}`
}

export interface RunChunkedStoryTextScanInput {
  storyId: string
  bookId: string
  unitId: string
  lessonId?: string | null
  partId?: string | null
  title?: string
  totalPdfPages?: number | null
  signal?: AbortSignal
  onProgress?: (progress: StoryScanProgress) => void
  onChunkSaved?: (text: ReadingStoryTextRecord) => void
  /** `full` wipes and rescans; `continue` skips pages already in existingText. */
  mode?: StoryTextScanMode
  /** Prior saved text when resuming (also used if stop before any new chunk). */
  existingText?: ReadingStoryTextRecord | null
}

/**
 * Scan story text one chunk at a time, saving after each success so a cancel
 * or network blip keeps finished pages.
 */
export async function runChunkedStoryTextScan(
  input: RunChunkedStoryTextScanInput,
): Promise<ChunkedStoryScanResult> {
  const {
    storyId,
    bookId,
    unitId,
    lessonId,
    partId,
    title,
    totalPdfPages,
    signal,
    onProgress,
    onChunkSaved,
    mode = 'full',
    existingText = null,
  } = input

  const baseBody = {
    storyId,
    bookId,
    unitId,
    lessonId: lessonId ?? undefined,
    partId: partId ?? undefined,
    title,
    totalPdfPages: typeof totalPdfPages === 'number' ? totalPdfPages : undefined,
  }

  onProgress?.(buildProgress([], 'Planning pages…'))

  let planRes: Response
  try {
    planRes = await fetch('/api/reading-stories/text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...baseBody, action: 'scan-plan' }),
      signal,
    })
  } catch (err) {
    if (signal?.aborted) {
      return { ok: false, error: 'Scan stopped.', text: existingText }
    }
    throw err
  }

  const planData = (await planRes.json()) as {
    ok?: boolean
    plan?: StoryScanPlan
    error?: string
  }
  if (!planData.ok || !planData.plan || planData.plan.pages.length === 0) {
    return {
      ok: false,
      error: planData.error ?? 'Could not plan story scan.',
      text: existingText,
    }
  }

  const plan = planData.plan
  const chunkSize = Math.max(1, plan.chunkPages || DEFAULT_CHUNK_PAGES)
  const resume = mode === 'continue'
  const covered = resume
    ? coveredPdfPagesFromStoryText(existingText?.text ?? '')
    : new Set<number>()

  let pages: StoryScanPageProgress[] = plan.pages.map((p) => ({
    pdfPage: p.pdfPage,
    label: p.label,
    status: covered.has(p.pdfPage) ? ('done' as const) : ('pending' as const),
  }))

  const pendingCount = pages.filter((p) => p.status === 'pending').length
  if (resume && pendingCount === 0) {
    onProgress?.(buildProgress(pages, `Done — all ${pages.length} pages already saved.`))
    if (existingText) {
      return { ok: true, text: existingText, interrupted: false }
    }
    return { ok: false, error: 'Story text is already complete for these pages.', text: null }
  }

  onProgress?.(
    buildProgress(
      pages,
      resume
        ? `Continuing — ${pages.filter((p) => p.status === 'done').length} of ${pages.length} pages already saved…`
        : 'Starting scan…',
    ),
  )

  let lastText: ReadingStoryTextRecord | null = resume ? existingText : null
  /** First chunk that actually hits the API: wipe only on full scan. */
  let resetNextChunk = !resume

  for (let i = 0; i < pages.length; i += chunkSize) {
    if (signal?.aborted) {
      onProgress?.(
        buildProgress(
          pages,
          lastText
            ? `Stopped — kept ${pages.filter((p) => p.status === 'done').length} of ${pages.length} pages.`
            : 'Scan stopped.',
        ),
      )
      return lastText
        ? { ok: true, text: lastText, interrupted: true }
        : { ok: false, error: 'Scan stopped.', text: null }
    }

    const chunkPages = pages.slice(i, i + chunkSize)
    const allDone = chunkPages.every((p) => p.status === 'done')
    if (allDone) continue

    // Only request pages still pending (partial chunk after a mid-chunk stop).
    const toScan = chunkPages.filter((p) => p.status !== 'done')
    const chunkStart = toScan[0]!.pdfPage
    const chunkEnd = toScan[toScan.length - 1]!.pdfPage
    const activeLabel = pageLabelRange(pages, chunkStart, chunkEnd)

    pages = pages.map((p) =>
      p.pdfPage >= chunkStart && p.pdfPage <= chunkEnd && p.status !== 'done'
        ? { ...p, status: 'active' }
        : p,
    )
    onProgress?.(
      buildProgress(
        pages,
        `Reading page${chunkStart === chunkEnd ? '' : 's'} ${activeLabel}…`,
        activeLabel,
      ),
    )

    const reset = resetNextChunk
    let chunkRes: Response
    try {
      chunkRes = await fetch('/api/reading-stories/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...baseBody,
          action: 'scan-chunk',
          chunkStartPdfPage: chunkStart,
          chunkEndPdfPage: chunkEnd,
          reset,
        }),
        signal,
      })
    } catch (err) {
      pages = pages.map((p) =>
        p.pdfPage >= chunkStart && p.pdfPage <= chunkEnd && p.status === 'active'
          ? { ...p, status: 'failed' }
          : p,
      )
      if (signal?.aborted) {
        onProgress?.(
          buildProgress(
            pages,
            lastText
              ? `Stopped — kept ${pages.filter((p) => p.status === 'done').length} of ${pages.length} pages.`
              : 'Scan stopped.',
          ),
        )
        return lastText
          ? { ok: true, text: lastText, interrupted: true }
          : { ok: false, error: 'Scan stopped.', text: null }
      }
      onProgress?.(buildProgress(pages, 'Could not finish this page group.'))
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Could not scan story text.',
        text: lastText,
      }
    }

    const chunkData = (await chunkRes.json()) as {
      ok?: boolean
      text?: ReadingStoryTextRecord
      error?: string
      emptyChunk?: boolean
    }

    if (!chunkData.ok || !chunkData.text) {
      pages = pages.map((p) =>
        p.pdfPage >= chunkStart && p.pdfPage <= chunkEnd && p.status === 'active'
          ? { ...p, status: 'failed' }
          : p,
      )
      onProgress?.(buildProgress(pages, chunkData.error ?? 'Scan failed on these pages.'))
      return {
        ok: false,
        error: chunkData.error ?? 'Could not scan story text.',
        text: lastText,
      }
    }

    resetNextChunk = false
    lastText = chunkData.text
    onChunkSaved?.(chunkData.text)

    pages = pages.map((p) =>
      p.pdfPage >= chunkStart && p.pdfPage <= chunkEnd ? { ...p, status: 'done' } : p,
    )
    onProgress?.(
      buildProgress(
        pages,
        `Saved page${chunkStart === chunkEnd ? '' : 's'} ${activeLabel}.`,
        null,
      ),
    )
  }

  onProgress?.(
    buildProgress(pages, `Done — ${pages.length} page${pages.length === 1 ? '' : 's'} saved.`),
  )

  if (!lastText) {
    return { ok: false, error: 'AI found no story text on those pages.', text: null }
  }

  return { ok: true, text: lastText, interrupted: false }
}

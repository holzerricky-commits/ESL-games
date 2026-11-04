import { notifySearchablePdfUpdated } from '@/lib/books/searchable-pdf-events'
import type { SearchablePagePlanItem } from '@/lib/books/searchable-pdf-types'

export type SearchablePdfProgress = {
  pages: Array<{ pdfPage: number; status: 'pending' | 'active' | 'done' | 'skipped' | 'failed' }>
  doneCount: number
  totalCount: number
  percent: number
  activeLabel: string | null
  /** `Date.now()` when the active page (or the save) started; null when nothing is in flight. */
  activeStartedAt: number | null
  /** `saving` while the finished pages are written into the book file in one pass. */
  phase: 'reading' | 'saving'
  message: string
}

export type SearchablePdfJobResult =
  | { ok: true; stamped: number; skipped: number; filePath: string }
  | { ok: false; error: string; filePath: string | null; stamped: number }

/** Prep UI status for Make pages selectable / Redo. */
export type SearchablePdfRangeStatus =
  | 'needs-ocr'
  | 'stamped'
  | 'native-text'
  | 'empty'
  | 'unknown'

/** `story` plans the story's pages; `lesson` plans every page of the lesson. */
export type SearchablePdfScope = 'story' | 'lesson'

export type SearchablePdfPlanSummary = {
  filePath: string | null
  pages: SearchablePagePlanItem[]
  needsOcr: number
  status: SearchablePdfRangeStatus
}

type PlanResponse = {
  ok?: boolean
  error?: string
  filePath?: string
  pages?: SearchablePagePlanItem[]
  needsOcr?: number
}

type PageResponse = {
  ok?: boolean
  error?: string
  status?: 'read' | 'skipped'
  pdfPage?: number
  filePath?: string
}

type FinalizeResponse = {
  ok?: boolean
  error?: string
  stamped?: number[]
  missing?: number[]
}

function buildProgress(
  pages: SearchablePdfProgress['pages'],
  message: string,
  options?: { activeLabel?: string | null; phase?: SearchablePdfProgress['phase'] },
): SearchablePdfProgress {
  const doneCount = pages.filter((p) => p.status === 'done' || p.status === 'skipped').length
  const totalCount = pages.length
  const percent = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100)
  const activeLabel = options?.activeLabel ?? null
  const phase = options?.phase ?? 'reading'
  const activeStartedAt = activeLabel || phase === 'saving' ? Date.now() : null
  return { pages, doneCount, totalCount, percent, activeLabel, activeStartedAt, phase, message }
}

function pagesLabel(n: number): string {
  return `${n} page${n === 1 ? '' : 's'}`
}

export function deriveSearchablePdfRangeStatus(
  pages: readonly SearchablePagePlanItem[],
): SearchablePdfRangeStatus {
  if (pages.length === 0) return 'empty'
  const needsOcr = pages.some((p) => p.action === 'ocr')
  if (needsOcr) return 'needs-ocr'
  const hasStamped = pages.some((p) => p.action === 'skip-done')
  const hasNative = pages.some((p) => p.action === 'skip-has-text')
  if (hasStamped) return 'stamped'
  if (hasNative) return 'native-text'
  return 'unknown'
}

export async function fetchSearchablePdfPlan(input: {
  bookId: string
  unitId: string
  storyId: string
  lessonId?: string | null
  partId?: string | null
  title?: string
  totalPdfPages?: number | null
  scope?: SearchablePdfScope
  signal?: AbortSignal
}): Promise<SearchablePdfPlanSummary> {
  const res = await fetch('/api/books/searchable-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'plan',
      scope: input.scope ?? 'story',
      bookId: input.bookId,
      unitId: input.unitId,
      storyId: input.storyId,
      lessonId: input.lessonId ?? undefined,
      partId: input.partId ?? undefined,
      title: input.title,
      totalPdfPages: typeof input.totalPdfPages === 'number' ? input.totalPdfPages : undefined,
    }),
    signal: input.signal,
  })
  const data = (await res.json()) as PlanResponse
  if (!data.ok || !data.pages) {
    throw new Error(data.error ?? 'Could not check selectable pages.')
  }
  return {
    filePath: data.filePath ?? null,
    pages: data.pages,
    needsOcr: data.pages.filter((p) => p.action === 'ocr').length,
    status: deriveSearchablePdfRangeStatus(data.pages),
  }
}

export async function runSearchablePdfForStory(input: {
  bookId: string
  unitId: string
  storyId: string
  lessonId?: string | null
  partId?: string | null
  title?: string
  totalPdfPages?: number | null
  scope?: SearchablePdfScope
  /** Restamp pages that already have our sidecar text. */
  force?: boolean
  signal?: AbortSignal
  onProgress?: (progress: SearchablePdfProgress) => void
}): Promise<SearchablePdfJobResult> {
  const force = Boolean(input.force)
  const baseBody = {
    scope: input.scope ?? 'story',
    bookId: input.bookId,
    unitId: input.unitId,
    storyId: input.storyId,
    lessonId: input.lessonId ?? undefined,
    partId: input.partId ?? undefined,
    title: input.title,
    totalPdfPages: typeof input.totalPdfPages === 'number' ? input.totalPdfPages : undefined,
  }

  input.onProgress?.(buildProgress([], force ? 'Preparing redo…' : 'Checking pages…'))

  let planRes: Response
  try {
    planRes = await fetch('/api/books/searchable-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...baseBody, action: 'plan' }),
      signal: input.signal,
    })
  } catch (err) {
    if (input.signal?.aborted) {
      return { ok: false, error: 'Stopped.', filePath: null, stamped: 0 }
    }
    throw err
  }

  const planData = (await planRes.json()) as PlanResponse
  if (!planData.ok || !planData.pages?.length) {
    return {
      ok: false,
      error: planData.error ?? 'Could not plan selectable pages.',
      filePath: planData.filePath ?? null,
      stamped: 0,
    }
  }

  const filePath = planData.filePath ?? null
  const toOcr = planData.pages.filter((p) =>
    force ? p.action === 'ocr' || p.action === 'skip-done' : p.action === 'ocr',
  )

  let pages: SearchablePdfProgress['pages'] = planData.pages.map((p) => ({
    pdfPage: p.pdfPage,
    status: toOcr.some((t) => t.pdfPage === p.pdfPage) ? 'pending' : 'skipped',
  }))

  if (toOcr.length === 0) {
    input.onProgress?.(
      buildProgress(
        pages,
        force
          ? 'Nothing to redo — these pages already have text in the book.'
          : 'These pages already have selectable text.',
      ),
    )
    // Refresh any open reader that may still hold a pre-sidecar PDF.
    if (filePath) notifySearchablePdfUpdated(filePath)
    return { ok: true, stamped: 0, skipped: pages.length, filePath: filePath ?? '' }
  }

  input.onProgress?.(
    buildProgress(
      pages,
      force
        ? `Redoing ${pagesLabel(toOcr.length)}…`
        : `Making ${pagesLabel(toOcr.length)} selectable…`,
    ),
  )

  const readPages: number[] = []
  let skipped = pages.filter((p) => p.status === 'skipped').length

  /**
   * Write every page read so far into the book file in one pass.
   * Runs after Stop and after a page failure too, so finished reads are kept.
   */
  const finalize = async (): Promise<{ ok: true; stamped: number } | { ok: false; error: string }> => {
    if (readPages.length === 0) return { ok: true, stamped: 0 }
    input.onProgress?.(
      buildProgress(pages, `Saving selectable text for ${pagesLabel(readPages.length)} into the book…`, {
        phase: 'saving',
      }),
    )
    try {
      const res = await fetch('/api/books/searchable-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: input.bookId,
          unitId: input.unitId,
          action: 'finalize',
          pdfPages: readPages,
          force,
        }),
      })
      const data = (await res.json()) as FinalizeResponse
      if (!data.ok) return { ok: false, error: data.error ?? 'Could not save the selectable text.' }
      if (filePath) notifySearchablePdfUpdated(filePath)
      return { ok: true, stamped: data.stamped?.length ?? 0 }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Could not save the selectable text.' }
    }
  }

  const stoppedResult = async (): Promise<SearchablePdfJobResult> => {
    const saved = await finalize()
    const stamped = saved.ok ? saved.stamped : 0
    input.onProgress?.(buildProgress(pages, `Stopped — ${pagesLabel(stamped)} done.`))
    return {
      ok: false,
      error: saved.ok
        ? stamped > 0
          ? 'Stopped. Finished pages were kept.'
          : 'Stopped.'
        : saved.error,
      filePath,
      stamped,
    }
  }

  const failedResult = async (error: string): Promise<SearchablePdfJobResult> => {
    const saved = await finalize()
    const stamped = saved.ok ? saved.stamped : 0
    input.onProgress?.(buildProgress(pages, error))
    return { ok: false, error, filePath, stamped }
  }

  for (const item of toOcr) {
    if (input.signal?.aborted) return stoppedResult()

    pages = pages.map((p) =>
      p.pdfPage === item.pdfPage ? { ...p, status: 'active' } : p,
    )
    input.onProgress?.(
      buildProgress(
        pages,
        force ? `Redoing page ${item.pdfPage}…` : `Reading page ${item.pdfPage}…`,
        { activeLabel: String(item.pdfPage) },
      ),
    )

    let pageRes: Response
    try {
      pageRes = await fetch('/api/books/searchable-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: input.bookId,
          unitId: input.unitId,
          action: 'page',
          pdfPage: item.pdfPage,
          force,
          planned: true,
        }),
        signal: input.signal,
      })
    } catch (err) {
      pages = pages.map((p) =>
        p.pdfPage === item.pdfPage && p.status === 'active' ? { ...p, status: 'failed' } : p,
      )
      if (input.signal?.aborted) return stoppedResult()
      return failedResult(err instanceof Error ? err.message : 'Could not make this page selectable.')
    }

    const pageData = (await pageRes.json()) as PageResponse
    if (!pageData.ok) {
      pages = pages.map((p) =>
        p.pdfPage === item.pdfPage ? { ...p, status: 'failed' } : p,
      )
      return failedResult(pageData.error ?? 'Could not make this page selectable.')
    }

    if (pageData.status === 'read') readPages.push(item.pdfPage)
    else skipped += 1

    pages = pages.map((p) =>
      p.pdfPage === item.pdfPage
        ? { ...p, status: pageData.status === 'skipped' ? 'skipped' : 'done' }
        : p,
    )
    input.onProgress?.(buildProgress(pages, `Read page ${item.pdfPage}.`))
  }

  const saved = await finalize()
  if (!saved.ok) {
    input.onProgress?.(buildProgress(pages, saved.error))
    return { ok: false, error: saved.error, filePath, stamped: 0 }
  }
  const stamped = saved.stamped

  input.onProgress?.(
    buildProgress(
      pages,
      stamped === 0
        ? force
          ? 'Nothing to redo — these pages already have text in the book.'
          : 'These pages already have selectable text.'
        : force
          ? `Done — ${pagesLabel(stamped)} redone.`
          : `Done — ${pagesLabel(stamped)} now selectable.`,
    ),
  )

  if (filePath) notifySearchablePdfUpdated(filePath)
  return { ok: true, stamped, skipped, filePath: filePath ?? '' }
}

import { notifySearchablePdfUpdated } from '@/lib/books/searchable-pdf-events'
import type { SearchablePagePlanItem } from '@/lib/books/searchable-pdf-types'

export type SearchablePdfProgress = {
  pages: Array<{ pdfPage: number; status: 'pending' | 'active' | 'done' | 'skipped' | 'failed' }>
  doneCount: number
  totalCount: number
  percent: number
  activeLabel: string | null
  /** `Date.now()` when the active page request started; null when no page is in flight. */
  activeStartedAt: number | null
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
  status?: 'stamped' | 'skipped'
  pdfPage?: number
  filePath?: string
}

function buildProgress(
  pages: SearchablePdfProgress['pages'],
  message: string,
  activeLabel: string | null = null,
): SearchablePdfProgress {
  const doneCount = pages.filter((p) => p.status === 'done' || p.status === 'skipped').length
  const totalCount = pages.length
  const percent = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100)
  const activeStartedAt = activeLabel ? Date.now() : null
  return { pages, doneCount, totalCount, percent, activeLabel, activeStartedAt, message }
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
  signal?: AbortSignal
}): Promise<SearchablePdfPlanSummary> {
  const res = await fetch('/api/books/searchable-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'plan',
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
  /** Restamp pages that already have our sidecar text. */
  force?: boolean
  signal?: AbortSignal
  onProgress?: (progress: SearchablePdfProgress) => void
}): Promise<SearchablePdfJobResult> {
  const force = Boolean(input.force)
  const baseBody = {
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
        ? `Redoing ${toOcr.length} page${toOcr.length === 1 ? '' : 's'}…`
        : `Making ${toOcr.length} page${toOcr.length === 1 ? '' : 's'} selectable…`,
    ),
  )

  let stamped = 0
  let skipped = pages.filter((p) => p.status === 'skipped').length

  for (const item of toOcr) {
    if (input.signal?.aborted) {
      input.onProgress?.(
        buildProgress(
          pages,
          `Stopped — ${stamped} page${stamped === 1 ? '' : 's'} done.`,
        ),
      )
      if (stamped > 0 && filePath) notifySearchablePdfUpdated(filePath)
      return {
        ok: false,
        error: stamped > 0 ? 'Stopped. Finished pages were kept.' : 'Stopped.',
        filePath,
        stamped,
      }
    }

    pages = pages.map((p) =>
      p.pdfPage === item.pdfPage ? { ...p, status: 'active' } : p,
    )
    input.onProgress?.(
      buildProgress(
        pages,
        force ? `Redoing page ${item.pdfPage}…` : `Reading page ${item.pdfPage}…`,
        String(item.pdfPage),
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
        }),
        signal: input.signal,
      })
    } catch (err) {
      pages = pages.map((p) =>
        p.pdfPage === item.pdfPage && p.status === 'active' ? { ...p, status: 'failed' } : p,
      )
      if (input.signal?.aborted) {
        if (stamped > 0 && filePath) notifySearchablePdfUpdated(filePath)
        return {
          ok: false,
          error: stamped > 0 ? 'Stopped. Finished pages were kept.' : 'Stopped.',
          filePath,
          stamped,
        }
      }
      input.onProgress?.(buildProgress(pages, 'Could not finish this page.'))
      if (stamped > 0 && filePath) notifySearchablePdfUpdated(filePath)
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Could not make this page selectable.',
        filePath,
        stamped,
      }
    }

    const pageData = (await pageRes.json()) as PageResponse
    if (!pageData.ok) {
      pages = pages.map((p) =>
        p.pdfPage === item.pdfPage ? { ...p, status: 'failed' } : p,
      )
      input.onProgress?.(buildProgress(pages, pageData.error ?? 'This page failed.'))
      if (stamped > 0 && filePath) notifySearchablePdfUpdated(filePath)
      return {
        ok: false,
        error: pageData.error ?? 'Could not make this page selectable.',
        filePath,
        stamped,
      }
    }

    if (pageData.status === 'stamped') stamped += 1
    else skipped += 1

    pages = pages.map((p) =>
      p.pdfPage === item.pdfPage
        ? { ...p, status: pageData.status === 'skipped' ? 'skipped' : 'done' }
        : p,
    )
    input.onProgress?.(
      buildProgress(pages, `Saved page ${item.pdfPage}.`),
    )
  }

  input.onProgress?.(
    buildProgress(
      pages,
      stamped === 0
        ? force
          ? 'Nothing to redo — these pages already have text in the book.'
          : 'These pages already have selectable text.'
        : force
          ? `Done — ${stamped} page${stamped === 1 ? '' : 's'} redone.`
          : `Done — ${stamped} page${stamped === 1 ? '' : 's'} now selectable.`,
    ),
  )

  if (filePath) notifySearchablePdfUpdated(filePath)
  return { ok: true, stamped, skipped, filePath: filePath ?? '' }
}

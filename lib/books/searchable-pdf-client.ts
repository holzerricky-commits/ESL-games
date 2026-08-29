import { notifySearchablePdfUpdated } from '@/lib/books/searchable-pdf-events'
import type { SearchablePagePlanItem } from '@/lib/books/searchable-pdf-types'

export type SearchablePdfProgress = {
  pages: Array<{ pdfPage: number; status: 'pending' | 'active' | 'done' | 'skipped' | 'failed' }>
  doneCount: number
  totalCount: number
  percent: number
  activeLabel: string | null
  message: string
}

export type SearchablePdfJobResult =
  | { ok: true; stamped: number; skipped: number; filePath: string }
  | { ok: false; error: string; filePath: string | null }

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
  return { pages, doneCount, totalCount, percent, activeLabel, message }
}

export async function runSearchablePdfForStory(input: {
  bookId: string
  unitId: string
  storyId: string
  lessonId?: string | null
  partId?: string | null
  title?: string
  totalPdfPages?: number | null
  signal?: AbortSignal
  onProgress?: (progress: SearchablePdfProgress) => void
}): Promise<SearchablePdfJobResult> {
  const baseBody = {
    bookId: input.bookId,
    unitId: input.unitId,
    storyId: input.storyId,
    lessonId: input.lessonId ?? undefined,
    partId: input.partId ?? undefined,
    title: input.title,
    totalPdfPages: typeof input.totalPdfPages === 'number' ? input.totalPdfPages : undefined,
  }

  input.onProgress?.(buildProgress([], 'Checking pages…'))

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
      return { ok: false, error: 'Stopped.', filePath: null }
    }
    throw err
  }

  const planData = (await planRes.json()) as PlanResponse
  if (!planData.ok || !planData.pages?.length) {
    return {
      ok: false,
      error: planData.error ?? 'Could not plan selectable pages.',
      filePath: planData.filePath ?? null,
    }
  }

  const filePath = planData.filePath ?? null
  let pages: SearchablePdfProgress['pages'] = planData.pages.map((p) => ({
    pdfPage: p.pdfPage,
    status: p.action === 'ocr' ? 'pending' : 'skipped',
  }))

  const toOcr = planData.pages.filter((p) => p.action === 'ocr')
  if (toOcr.length === 0) {
    input.onProgress?.(
      buildProgress(pages, 'These pages already have selectable text.'),
    )
    return { ok: true, stamped: 0, skipped: pages.length, filePath: filePath ?? '' }
  }

  input.onProgress?.(
    buildProgress(
      pages,
      `Making ${toOcr.length} page${toOcr.length === 1 ? '' : 's'} selectable…`,
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
      }
    }

    pages = pages.map((p) =>
      p.pdfPage === item.pdfPage ? { ...p, status: 'active' } : p,
    )
    input.onProgress?.(
      buildProgress(pages, `Reading page ${item.pdfPage}…`, String(item.pdfPage)),
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
        }
      }
      input.onProgress?.(buildProgress(pages, 'Could not finish this page.'))
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Could not make this page selectable.',
        filePath,
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
        ? 'These pages already have selectable text.'
        : `Done — ${stamped} page${stamped === 1 ? '' : 's'} now selectable.`,
    ),
  )

  if (filePath && stamped > 0) notifySearchablePdfUpdated(filePath)
  return { ok: true, stamped, skipped, filePath: filePath ?? '' }
}

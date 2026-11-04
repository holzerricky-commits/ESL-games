/**
 * Pure helpers for cutting a stacked (concatenated) PDF into volume page ranges.
 * Starts are 1-based PDF page indices. Ranges are inclusive.
 */

export interface StackedPdfCutInput {
  title: string
  /** 1-based PDF page where this volume starts. */
  startPage: number
}

export interface StackedPdfUnitRange {
  title: string
  startPage: number
  endPage: number
  /** Prefer volume-01.pdf style names from order. */
  index: number
}

export type StackedPdfRangesResult =
  | { ok: true; ranges: StackedPdfUnitRange[] }
  | { ok: false; error: string }

function normalizeTitle(raw: string, index: number): string {
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : `Volume ${index + 1}`
}

/**
 * Convert ordered volume start pages into inclusive PDF ranges.
 * Volume 1 must start at page 1. Starts must be strictly increasing and within [1, pageCount].
 */
export function buildStackedPdfUnitRanges(
  cuts: StackedPdfCutInput[],
  pageCount: number,
): StackedPdfRangesResult {
  if (!Number.isFinite(pageCount) || pageCount < 1) {
    return { ok: false, error: 'PDF must have at least one page.' }
  }
  const total = Math.floor(pageCount)
  if (!Array.isArray(cuts) || cuts.length === 0) {
    return { ok: false, error: 'Add at least one volume cut.' }
  }

  const starts: number[] = []
  for (let i = 0; i < cuts.length; i++) {
    const raw = cuts[i]!
    const start = Math.floor(Number(raw.startPage))
    if (!Number.isFinite(start) || start < 1) {
      return { ok: false, error: `Volume ${i + 1} has an invalid start page.` }
    }
    if (start > total) {
      return { ok: false, error: `Volume ${i + 1} starts past the end of the PDF (${total} pages).` }
    }
    starts.push(start)
  }

  if (starts[0] !== 1) {
    return { ok: false, error: 'Volume 1 must start on PDF page 1.' }
  }

  for (let i = 1; i < starts.length; i++) {
    if (starts[i]! <= starts[i - 1]!) {
      return { ok: false, error: 'Volume starts must be in order with no duplicates.' }
    }
  }

  const ranges: StackedPdfUnitRange[] = cuts.map((cut, i) => {
    const startPage = starts[i]!
    const endPage = i + 1 < starts.length ? starts[i + 1]! - 1 : total
    return {
      title: normalizeTitle(cut.title, i),
      startPage,
      endPage,
      index: i,
    }
  })

  return { ok: true, ranges }
}

/** True when the book still has a single shared PDF (candidate for cutting). */
export function bookHasSingleSharedPdf(book: {
  units: Array<{ filePath?: string | null }>
}): boolean {
  const paths = [
    ...new Set(
      book.units
        .map((u) => (typeof u.filePath === 'string' ? u.filePath.trim() : ''))
        .filter(Boolean),
    ),
  ]
  return paths.length === 1
}

/** True when the book has two or more distinct unit PDF files. */
export function bookHasDistinctUnitFiles(book: {
  units: Array<{ filePath?: string | null }>
}): boolean {
  const paths = [
    ...new Set(
      book.units
        .map((u) => (typeof u.filePath === 'string' ? u.filePath.trim() : ''))
        .filter(Boolean),
    ),
  ]
  return paths.length >= 2
}

/** Preferred filename for a newly cut volume PDF (does not rename existing files). */
export function volumePdfFileName(index: number): string {
  const n = Math.max(0, Math.floor(index)) + 1
  return `volume-${String(n).padStart(2, '0')}.pdf`
}

/** @deprecated Prefer volumePdfFileName — same volume-01.pdf naming. */
export function unitPdfFileName(index: number): string {
  return volumePdfFileName(index)
}

/** Hidden folder name for the original stacked PDF after a successful cut. */
export const STACKED_SOURCE_DIR = '.stacked-source'

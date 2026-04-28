export function normalizeNotCountedPdfPages(
  pages: number[] | undefined,
  totalPdfPages?: number,
): number[] {
  if (!pages?.length) return []
  const max = totalPdfPages && Number.isFinite(totalPdfPages) ? Math.max(1, Math.floor(totalPdfPages)) : null
  const out = new Set<number>()
  for (const page of pages) {
    if (!Number.isFinite(page)) continue
    const rounded = Math.floor(page)
    if (rounded < 1) continue
    if (max != null && rounded > max) continue
    out.add(rounded)
  }
  return [...out].sort((a, b) => a - b)
}

export function isCountedPdfPage(pdfPage: number, notCountedPdfPages: number[]): boolean {
  const rounded = Math.floor(pdfPage)
  if (!Number.isFinite(rounded) || rounded < 1) return false
  if (rounded === 1) return false // PDF cover page is always non-counted.
  return !new Set(notCountedPdfPages).has(rounded)
}

export function printedPageToPdfPage(
  printedPage: number,
  notCountedPdfPages: number[],
  totalPdfPages?: number,
): number | null {
  const targetPrinted = Math.floor(printedPage)
  if (!Number.isFinite(targetPrinted) || targetPrinted < 1) return null
  const ignored = new Set(normalizeNotCountedPdfPages(notCountedPdfPages, totalPdfPages))
  const max = totalPdfPages && Number.isFinite(totalPdfPages) ? Math.max(1, Math.floor(totalPdfPages)) : null
  let countedIndex = 0
  for (let pdfPage = 2; max == null || pdfPage <= max; pdfPage++) {
    if (ignored.has(pdfPage)) continue
    countedIndex += 1
    if (countedIndex === targetPrinted) return pdfPage
    if (max == null && countedIndex > targetPrinted + ignored.size + 10) break
  }
  return null
}

export function pdfPageToPrintedPage(pdfPage: number, notCountedPdfPages: number[]): number | null {
  const targetPdf = Math.floor(pdfPage)
  if (!Number.isFinite(targetPdf) || targetPdf < 2) return null
  const ignored = new Set(normalizeNotCountedPdfPages(notCountedPdfPages))
  if (ignored.has(targetPdf)) return null
  let countedIndex = 0
  for (let p = 2; p <= targetPdf; p++) {
    if (ignored.has(p)) continue
    countedIndex += 1
  }
  return countedIndex > 0 ? countedIndex : null
}

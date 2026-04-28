export interface PageAlignmentRuntime {
  effectivePageByPdf: Map<number, number | null>
  pdfPageByEffective: Map<number, number>
  visiblePdfPages: number[]
  effectiveTotal: number
}

function normalizeUniquePages(pages: number[] | undefined): number[] {
  if (!pages?.length) return []
  const out = new Set<number>()
  for (const page of pages) {
    if (!Number.isFinite(page)) continue
    const rounded = Math.floor(page)
    if (rounded < 1) continue
    out.add(rounded)
  }
  return [...out].sort((a, b) => a - b)
}

/**
 * Ensures PDF page 1 is listed as hidden for **spread / reader navigation** only.
 * Thumbnails may still render page 1 by PDF index. This does not remove page 1 from the
 * effective-page numbering chain (see `buildPageAlignmentRuntime`).
 */
export function mergeCoverIntoHiddenPages(hiddenPagesInput: number[] | undefined): number[] {
  const hiddenPages = new Set(normalizeUniquePages(hiddenPagesInput))
  hiddenPages.add(1)
  return [...hiddenPages].sort((a, b) => a - b)
}

export function buildPageAlignmentRuntime(
  totalPages: number | null,
  hiddenPagesInput: number[],
  ghostPagesInput: number[],
): PageAlignmentRuntime {
  const effectivePageByPdf = new Map<number, number | null>()
  const pdfPageByEffective = new Map<number, number>()
  if (totalPages == null || totalPages < 1) {
    return { effectivePageByPdf, pdfPageByEffective, visiblePdfPages: [], effectiveTotal: 0 }
  }

  const hiddenPages = new Set(normalizeUniquePages(hiddenPagesInput))
  hiddenPages.delete(1)
  const ghostPages = new Set(normalizeUniquePages(ghostPagesInput))
  ghostPages.delete(1)
  const visiblePdfPages: number[] = []
  let effective = 0

  for (let page = 1; page <= totalPages; page++) {
    if (hiddenPages.has(page)) continue
    if (page !== 1) visiblePdfPages.push(page)
    if (ghostPages.has(page)) {
      effectivePageByPdf.set(page, null)
      continue
    }
    effective += 1
    effectivePageByPdf.set(page, effective)
    if (!pdfPageByEffective.has(effective)) pdfPageByEffective.set(effective, page)
  }

  return { effectivePageByPdf, pdfPageByEffective, visiblePdfPages, effectiveTotal: effective }
}

export function resolveEffectiveAnchorToPdfPage(
  anchorPage: number | null | undefined,
  runtime: PageAlignmentRuntime,
): number | null {
  if (typeof anchorPage !== 'number' || !Number.isFinite(anchorPage)) return null
  const rounded = Math.max(1, Math.round(anchorPage))
  return runtime.pdfPageByEffective.get(rounded) ?? rounded
}

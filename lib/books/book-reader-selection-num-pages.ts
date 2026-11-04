/** When switching units, restore a known page count or leave numPages alone (never force null). */
export function nextNumPagesAfterSelectionChange(
  nextUnitId: string | null,
  getCachedNumPages?: (unitId: string) => number | null | undefined,
): number | 'keep' {
  const uid = nextUnitId?.trim() ?? ''
  if (!uid || !getCachedNumPages) return 'keep'
  const cached = getCachedNumPages(uid)
  if (cached == null || !Number.isFinite(cached) || cached < 1) return 'keep'
  return Math.floor(cached)
}

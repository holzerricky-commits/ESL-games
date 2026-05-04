/**
 * TOC-style inclusive page span from `startPageHint` / `endPageHint` on sibling items.
 * Hints are **printed (effective)** page numbers when the book uses alignment + TOC mapping.
 */
export function pageRangeForIndex<T extends { startPageHint?: number; endPageHint?: number }>(
  items: T[],
  index: number,
  fallbackStart?: number | null,
  fallbackEnd?: number | null,
): { start: number | null; end: number | null } {
  const current = items[index]
  const start =
    typeof current?.startPageHint === 'number' ? Math.round(current.startPageHint) : (fallbackStart ?? null)
  const explicitEnd = typeof current?.endPageHint === 'number' ? Math.round(current.endPageHint) : null
  if (explicitEnd != null) return { start, end: explicitEnd }
  const next = items
    .slice(index + 1)
    .find((item) => typeof item.startPageHint === 'number' && Number.isFinite(item.startPageHint))
  const nextStart = typeof next?.startPageHint === 'number' ? Math.round(next.startPageHint) : null
  return {
    start,
    end: nextStart != null ? Math.max(start ?? 1, nextStart - 1) : (fallbackEnd ?? null),
  }
}

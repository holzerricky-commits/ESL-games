import type { ClassSourceBookChip } from '@/lib/books/class-source-strip'

/** Unit PDFs to keep warm while the class overlay stays open (assigned strip books). */
export function classSourceRetainUnitIds(
  books: readonly ClassSourceBookChip[],
): string[] {
  const ids: string[] = []
  const seen = new Set<string>()
  for (const book of books) {
    const unitId = book.unitId.trim()
    if (!unitId || seen.has(unitId)) continue
    seen.add(unitId)
    ids.push(unitId)
  }
  return ids
}

/**
 * Strip swaps must not dump the book we just left.
 * Evict only when the previous unit is not one of the assigned chips.
 */
export function shouldEvictParkedReaderUnitCache(args: {
  previousUnitId: string
  retainUnitIds: readonly string[]
}): boolean {
  const previousUnitId = args.previousUnitId.trim()
  if (!previousUnitId) return false
  if (args.retainUnitIds.length === 0) return true
  return !args.retainUnitIds.includes(previousUnitId)
}

/** Assigned books that are not Focus — last spread should stay prefetched. */
export function listParkedClassSourceWarmTargets(
  chips: readonly ClassSourceBookChip[],
  focusedBookId: string | null,
): ClassSourceBookChip[] {
  const focus = focusedBookId?.trim() || null
  return chips.filter((chip) => chip.bookId !== focus)
}

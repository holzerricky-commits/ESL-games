import { clampPdfPageToVisible, getUnitReaderBounds, type UnitPageBounds } from '@/lib/books/page-range'
import type { BookLibraryPayload } from '@/lib/books/types'

export interface NormalizePageTurnTargetArgs {
  nextPage: number
  visiblePages: number[]
  readerBounds: UnitPageBounds
}

/** Same normalization as `useBookNavigation` / arrow-key turns before committing a spread. */
export function normalizePageTurnTarget(args: NormalizePageTurnTargetArgs): number {
  const { nextPage, visiblePages, readerBounds } = args
  let normalized = clampPdfPageToVisible(nextPage, visiblePages, readerBounds)
  const idx = visiblePages.indexOf(normalized)
  normalized = idx >= 0 ? visiblePages[Math.max(0, idx - (idx % 2))] ?? normalized : normalized
  return normalized
}

export function resolveSpreadAnchorPages(
  anchorPage: number,
  visiblePages: number[],
): { left: number; right: number | null } {
  const left = normalizePageTurnTarget({
    nextPage: anchorPage,
    visiblePages,
    readerBounds: { min: 1, max: Number.MAX_SAFE_INTEGER },
  })
  const leftIdx = visiblePages.indexOf(left)
  const right = leftIdx >= 0 ? (visiblePages[leftIdx + 1] ?? null) : null
  return { left, right }
}

export function readerBoundsForUnit(
  selectedUnit: BookLibraryPayload['books'][number]['units'][number] | null,
  numPages: number | null,
  selectedBook: BookLibraryPayload['books'][number] | null | undefined,
): UnitPageBounds {
  if (!selectedUnit) return { min: 1, max: Number.MAX_SAFE_INTEGER }
  return getUnitReaderBounds(selectedUnit, numPages, selectedBook ?? undefined)
}

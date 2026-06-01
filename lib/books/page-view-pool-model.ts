/**
 * Phase 2 stable pages — sliding window of mounted page views (±N PDF indices).
 *
 * @see docs/FULLSCREEN_BOOK_STABLE_PAGES_PLAN.md — Phase 2
 */

import { clampPdfPage, clampPdfPageToVisible, type UnitPageBounds } from '@/lib/books/page-range'

/** Default ±8 PDF indices kept mounted in the page view pool. */
export const PAGE_VIEW_POOL_RADIUS = 8

export type PageViewSlotRole = 'left' | 'right' | 'hidden' | 'single'

export interface PageViewLayoutSpec {
  role: PageViewSlotRole
  /** Whether this page is part of the currently displayed spread. */
  isActiveSpread: boolean
}

export function getActiveSpreadPageNumbers(args: {
  anchorPage: number
  spreadRightPage: number | null
  isSinglePageMode: boolean
}): number[] {
  const { anchorPage, spreadRightPage, isSinglePageMode } = args
  if (isSinglePageMode) return [anchorPage]
  if (spreadRightPage != null) return [anchorPage, spreadRightPage]
  return [anchorPage]
}

/**
 * Sorted PDF page indices to keep mounted around the anchor.
 * Intersects `[anchor ± poolRadius]` with the reader visible list.
 */
export function computePooledPageIndices(args: {
  anchorPage: number
  visiblePages: number[]
  readerBounds: UnitPageBounds
  poolRadius?: number
}): number[] {
  const { anchorPage, visiblePages, readerBounds, poolRadius = PAGE_VIEW_POOL_RADIUS } = args

  if (!visiblePages.length) {
    return [clampPdfPage(anchorPage, readerBounds)]
  }

  const clampedAnchor = clampPdfPageToVisible(anchorPage, visiblePages, readerBounds)
  const minPage = clampedAnchor - poolRadius
  const maxPage = clampedAnchor + poolRadius

  return visiblePages.filter((p) => p >= minPage && p <= maxPage)
}

export function resolvePageViewSlotRole(
  pageNumber: number,
  anchorPage: number,
  spreadRightPage: number | null,
  isSinglePageMode: boolean,
): PageViewLayoutSpec {
  if (isSinglePageMode) {
    const active = pageNumber === anchorPage
    return { role: active ? 'single' : 'hidden', isActiveSpread: active }
  }
  if (pageNumber === anchorPage) {
    return { role: 'left', isActiveSpread: true }
  }
  if (spreadRightPage != null && pageNumber === spreadRightPage) {
    return { role: 'right', isActiveSpread: true }
  }
  return { role: 'hidden', isActiveSpread: false }
}

/** Pages entering or leaving the pool when the anchor window shifts. */
export function diffPageViewPool(
  prev: number[],
  next: number[],
): { added: number[]; removed: number[] } {
  const prevSet = new Set(prev)
  const nextSet = new Set(next)
  return {
    added: next.filter((p) => !prevSet.has(p)),
    removed: prev.filter((p) => !nextSet.has(p)),
  }
}

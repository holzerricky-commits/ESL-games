/**
 * R2 / R5 — P0 immediate vs P1 idle page lists for reader prefetch.
 *
 * Routine forward: current + 3 spreads ahead + 1 back.
 * Routine backward (R5.1): current + 3 back + 1 ahead, back-first after current.
 * Jump (R5.2): target ±1 spread immediate.
 * Map warm (R5.3): current + 2 spreads ahead at heuristic width.
 */

import { clampPdfPageToVisible, type UnitPageBounds } from '@/lib/books/page-range'
import { resolveAdjacentAnchorPage } from '@/lib/books/reader-adjacent-turn-step'
import type { ReaderPrefetchDirectionBias } from '@/lib/books/reader-prefetch-direction-bias'
import { getReaderPrefetchVisiblePageIndices } from '@/lib/books/reader-prefetch-window'
import { spreadPdfPagesForAnchor } from '@/lib/books/reader-spread-prefetch-ready'
import { resolveSpreadAnchorPages } from '@/lib/books/reader-spread-navigation'

/** Spreads ahead of the anchor included in P0 (routine forward / neutral). */
export const READER_PREFETCH_P0_FORWARD_SPREADS = 3

/** Spreads behind the anchor included in P0 (routine forward / neutral). */
export const READER_PREFETCH_P0_BACK_SPREADS = 1

/** Map idle warm: current + this many spreads forward (R5.3). */
export const READER_MAP_WARM_P0_FORWARD_SPREADS = 2

export type ReaderPrefetchP0Intent = 'routine' | 'jump' | 'map-warm'

export interface ReaderPrefetchP0SpreadCounts {
  forwardSpreads: number
  backSpreads: number
  /** After current anchor, which neighbour spreads to queue first. */
  neighboursFirst: 'forward' | 'back'
}

export function resolveReaderPrefetchP0SpreadCounts(args: {
  directionBias?: ReaderPrefetchDirectionBias
  intent?: ReaderPrefetchP0Intent
}): ReaderPrefetchP0SpreadCounts {
  const directionBias = args.directionBias ?? 'neutral'
  const intent = args.intent ?? 'routine'

  if (intent === 'jump') {
    return { forwardSpreads: 1, backSpreads: 1, neighboursFirst: 'forward' }
  }
  if (intent === 'map-warm') {
    return {
      forwardSpreads: READER_MAP_WARM_P0_FORWARD_SPREADS,
      backSpreads: READER_PREFETCH_P0_BACK_SPREADS,
      neighboursFirst: 'forward',
    }
  }
  if (directionBias === 'backward') {
    return {
      forwardSpreads: READER_PREFETCH_P0_BACK_SPREADS,
      backSpreads: READER_PREFETCH_P0_FORWARD_SPREADS,
      neighboursFirst: 'back',
    }
  }
  return {
    forwardSpreads: READER_PREFETCH_P0_FORWARD_SPREADS,
    backSpreads: READER_PREFETCH_P0_BACK_SPREADS,
    neighboursFirst: 'forward',
  }
}

export interface SplitReaderPrefetchPagesArgs {
  anchorPage: number
  visiblePages: number[]
  isSinglePageMode: boolean
  readerBounds: UnitPageBounds
  directionBias?: ReaderPrefetchDirectionBias
  intent?: ReaderPrefetchP0Intent
}

export interface SplitReaderPrefetchPagesResult {
  immediate: number[]
  idle: number[]
}

function canonicalSpreadAnchor(
  page: number,
  visiblePages: number[],
  isSinglePageMode: boolean,
): number {
  const { left } = resolveSpreadAnchorPages(page, visiblePages, isSinglePageMode)
  return left
}

function appendSpreadPdfPages(
  ordered: number[],
  seen: Set<number>,
  anchor: number,
  visiblePages: number[],
  isSinglePageMode: boolean,
): void {
  for (const p of spreadPdfPagesForAnchor(anchor, visiblePages, isSinglePageMode)) {
    if (seen.has(p)) continue
    seen.add(p)
    ordered.push(p)
  }
}

function collectAdjacentSpreadAnchors(args: {
  startAnchor: number
  direction: -1 | 1
  count: number
  visiblePages: number[]
  isSinglePageMode: boolean
}): number[] {
  const anchors: number[] = []
  let walk = args.startAnchor
  for (let i = 0; i < args.count; i++) {
    const next = resolveAdjacentAnchorPage({
      anchorPage: walk,
      direction: args.direction,
      visiblePages: args.visiblePages,
      isSinglePageMode: args.isSinglePageMode,
    })
    if (next == null) break
    anchors.push(canonicalSpreadAnchor(next, args.visiblePages, args.isSinglePageMode))
    walk = next
  }
  return anchors
}

/**
 * Splits the reader prefetch window into P0 immediate and P1 idle pages.
 */
export function splitReaderPrefetchPages(
  args: SplitReaderPrefetchPagesArgs,
): SplitReaderPrefetchPagesResult {
  const {
    anchorPage,
    visiblePages,
    isSinglePageMode,
    readerBounds,
    directionBias = 'neutral',
    intent = 'routine',
  } = args

  const windowPages = getReaderPrefetchVisiblePageIndices({
    anchorPage,
    visiblePages,
    readerBounds,
  })

  if (!visiblePages.length) {
    const clamped = clampPdfPageToVisible(anchorPage, visiblePages, readerBounds)
    return { immediate: [clamped], idle: [] }
  }

  const p0 = resolveReaderPrefetchP0SpreadCounts({ directionBias, intent })
  const clampedAnchor = clampPdfPageToVisible(anchorPage, visiblePages, readerBounds)
  const currentAnchor = canonicalSpreadAnchor(clampedAnchor, visiblePages, isSinglePageMode)

  const forwardAnchors = collectAdjacentSpreadAnchors({
    startAnchor: clampedAnchor,
    direction: 1,
    count: p0.forwardSpreads,
    visiblePages,
    isSinglePageMode,
  })

  const backAnchors = collectAdjacentSpreadAnchors({
    startAnchor: clampedAnchor,
    direction: -1,
    count: p0.backSpreads,
    visiblePages,
    isSinglePageMode,
  })

  const neighbourAnchors =
    p0.neighboursFirst === 'back'
      ? [...backAnchors, ...forwardAnchors]
      : [...forwardAnchors, ...backAnchors]

  const orderedAnchors = [currentAnchor, ...neighbourAnchors]
  const immediate: number[] = []
  const immediateSet = new Set<number>()
  for (const anchor of orderedAnchors) {
    appendSpreadPdfPages(immediate, immediateSet, anchor, visiblePages, isSinglePageMode)
  }

  const idle = windowPages.filter((p) => !immediateSet.has(p))
  return { immediate, idle }
}

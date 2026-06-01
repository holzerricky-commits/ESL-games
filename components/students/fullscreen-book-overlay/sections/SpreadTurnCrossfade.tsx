'use client'

import { useMemo } from 'react'
import { getPageRenderCacheBitmap } from '@/lib/books/page-render-cache'
import { SPREAD_CROSSFADE_MS } from '@/lib/books/spread-crossfade-config'
import { SPREAD_TURN_SLIDE_MS } from '@/lib/books/spread-turn-slide-config'
import { CachedPageCanvas } from '@/components/students/fullscreen-book-overlay/sections/CachedPageCanvas'
import type { OutgoingSpreadSnapshot } from '@/components/students/fullscreen-book-overlay/hooks/useSpreadCrossfade'

export interface SpreadTurnCrossfadeProps {
  unitId: string
  outgoing: OutgoingSpreadSnapshot
  spreadPageWidth: number
  pageCanvasHeightPx: number
  gutterPullPx: number
  prefetchRevision: number
  opacity: number
  spreadOverlayWidthPx: number
  /** Phase 4b — slide off-screen instead of crossfade when capture unavailable. */
  translateXPercent?: number
  slideTransitionActive?: boolean
}

/**
 * Phase 4 — frozen outgoing spread from PageRenderCache during turn crossfade.
 */
export function SpreadTurnCrossfade({
  unitId,
  outgoing,
  spreadPageWidth,
  pageCanvasHeightPx,
  gutterPullPx,
  prefetchRevision,
  opacity,
  spreadOverlayWidthPx,
  translateXPercent,
  slideTransitionActive = false,
}: SpreadTurnCrossfadeProps) {
  const leftBmp = useMemo(
    () => getPageRenderCacheBitmap(unitId, outgoing.left, spreadPageWidth),
    [unitId, outgoing.left, spreadPageWidth, prefetchRevision],
  )
  const rightBmp = useMemo(
    () =>
      outgoing.right != null
        ? getPageRenderCacheBitmap(unitId, outgoing.right, spreadPageWidth)
        : undefined,
    [unitId, outgoing.right, spreadPageWidth, prefetchRevision],
  )

  if (!leftBmp) return null

  const slideMode = translateXPercent != null
  const transitionMs = slideMode ? SPREAD_TURN_SLIDE_MS : SPREAD_CROSSFADE_MS

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[6] inline-flex items-start leading-none motion-reduce:transition-none"
      style={{
        width: spreadOverlayWidthPx,
        minHeight: pageCanvasHeightPx,
        opacity: slideMode ? 1 : opacity,
        transform: slideMode ? `translateX(${translateXPercent}%)` : undefined,
        transition: slideMode
          ? slideTransitionActive
            ? `transform ${transitionMs}ms cubic-bezier(0.22, 1, 0.36, 1)`
            : 'none'
          : `opacity ${transitionMs}ms ease-out`,
      }}
      aria-hidden
    >
      <CachedPageCanvas
        bitmap={leftBmp}
        cssWidth={spreadPageWidth}
        cssHeight={pageCanvasHeightPx}
      />
      {outgoing.right != null && rightBmp ? (
        <div className="relative shrink-0" style={{ marginLeft: -gutterPullPx }}>
          <CachedPageCanvas
            bitmap={rightBmp}
            cssWidth={spreadPageWidth}
            cssHeight={pageCanvasHeightPx}
            clipLeftPx={gutterPullPx}
          />
        </div>
      ) : null}
    </div>
  )
}

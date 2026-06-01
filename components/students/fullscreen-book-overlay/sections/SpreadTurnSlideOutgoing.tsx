'use client'

import { SPREAD_TURN_SLIDE_MS } from '@/lib/books/spread-turn-slide-config'

export interface SpreadTurnSlideOutgoingProps {
  captureUrl: string
  spreadOverlayWidthPx: number
  pageCanvasHeightPx: number
  translateXPercent: number
  slideTransitionActive?: boolean
}

/**
 * Phase 4b — pre-turn spread snapshot (pages + annotations) sliding off-screen.
 */
export function SpreadTurnSlideOutgoing({
  captureUrl,
  spreadOverlayWidthPx,
  pageCanvasHeightPx,
  translateXPercent,
  slideTransitionActive = false,
}: SpreadTurnSlideOutgoingProps) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[6] overflow-hidden motion-reduce:transition-none"
      style={{
        width: spreadOverlayWidthPx,
        minHeight: pageCanvasHeightPx,
        transform: `translateX(${translateXPercent}%)`,
        transition: slideTransitionActive
          ? `transform ${SPREAD_TURN_SLIDE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
          : 'none',
      }}
      aria-hidden
    >
      <img
        src={captureUrl}
        alt=""
        draggable={false}
        className="block h-auto max-w-none select-none"
        style={{ width: spreadOverlayWidthPx, height: pageCanvasHeightPx, objectFit: 'fill' }}
      />
    </div>
  )
}

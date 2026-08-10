'use client'

import type { CSSProperties } from 'react'
import { SpreadTurnFoldLightingOverlay } from '@/components/students/fullscreen-book-overlay/sections/SpreadTurnFoldLightingOverlay'
import {
  spreadTurnFoldEndTransform,
  spreadTurnFoldPageSurfaceStyle,
  spreadTurnFoldStartTransform,
  spreadTurnFoldTransformOrigin,
  spreadTurnFoldTransitionActive,
  spreadTurnFoldTransitionNone,
  spreadTurnFoldingPageSide,
} from '@/lib/books/spread-turn-fold'
import { SPREAD_TURN_SLIDE_MS, type SpreadTurnDirection } from '@/lib/books/spread-turn-slide-config'

export interface SpreadTurnSlideOutgoingProps {
  captureUrl: string
  spreadOverlayWidthPx: number
  spreadPageWidthPx: number
  pageCanvasHeightPx: number
  hasRightPage: boolean
  foldDirection: SpreadTurnDirection
  foldTransitionActive?: boolean
}

function flippingPageFoldStyle(args: {
  pageSide: 'left' | 'right'
  foldDirection: SpreadTurnDirection
  foldTransitionActive: boolean
  isFoldingPage: boolean
}): CSSProperties {
  const surface = spreadTurnFoldPageSurfaceStyle()
  if (!args.isFoldingPage) {
    return surface
  }

  return {
    ...surface,
    transformOrigin: spreadTurnFoldTransformOrigin(args.pageSide),
    transform: args.foldTransitionActive
      ? spreadTurnFoldEndTransform(args.foldDirection)
      : spreadTurnFoldStartTransform(),
    willChange: args.foldTransitionActive ? 'transform' : undefined,
    transition: args.foldTransitionActive
      ? spreadTurnFoldTransitionActive(SPREAD_TURN_SLIDE_MS)
      : spreadTurnFoldTransitionNone(),
  }
}

/**
 * Pre-turn spread snapshot — rigid overlay shell; only the flipping page slot curls.
 */
export function SpreadTurnSlideOutgoing({
  captureUrl,
  spreadOverlayWidthPx,
  spreadPageWidthPx,
  pageCanvasHeightPx,
  hasRightPage,
  foldDirection,
  foldTransitionActive = false,
}: SpreadTurnSlideOutgoingProps) {
  const surface = spreadTurnFoldPageSurfaceStyle()
  const foldingPageSide = spreadTurnFoldingPageSide(foldDirection)
  const twoPage = hasRightPage

  const renderPageSlot = (side: 'left' | 'right', clipOffsetPx: number) => (
    <div
      className="relative shrink-0 grow-0 overflow-hidden"
      style={{
        boxSizing: 'border-box',
        width: spreadPageWidthPx,
        minWidth: spreadPageWidthPx,
        maxWidth: spreadPageWidthPx,
        height: pageCanvasHeightPx,
        flexShrink: 0,
        flexGrow: 0,
        ...flippingPageFoldStyle({
          pageSide: side,
          foldDirection,
          foldTransitionActive,
          isFoldingPage: foldingPageSide === side,
        }),
      }}
    >
      <img
        src={captureUrl}
        alt=""
        draggable={false}
        className="pointer-events-none absolute top-0 block max-w-none select-none"
        style={{
          left: -clipOffsetPx,
          width: spreadOverlayWidthPx,
          height: pageCanvasHeightPx,
          objectFit: 'fill',
        }}
      />
      {foldingPageSide === side ? (
        <SpreadTurnFoldLightingOverlay
          foldDirection={foldDirection}
          foldTransitionActive={foldTransitionActive}
        />
      ) : null}
    </div>
  )

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[6] motion-reduce:transition-none"
      style={{
        boxSizing: 'border-box',
        width: spreadOverlayWidthPx,
        minWidth: spreadOverlayWidthPx,
        maxWidth: spreadOverlayWidthPx,
        height: pageCanvasHeightPx,
        minHeight: pageCanvasHeightPx,
        overflow: 'hidden',
        ...surface,
      }}
      aria-hidden
    >
      <div
        className="relative flex shrink-0 grow-0 items-start justify-start leading-none"
        style={{ width: spreadOverlayWidthPx, height: pageCanvasHeightPx }}
      >
        {twoPage ? (
          <>
            {renderPageSlot('left', 0)}
            {renderPageSlot('right', spreadPageWidthPx)}
          </>
        ) : (
          renderPageSlot('left', 0)
        )}
      </div>
    </div>
  )
}

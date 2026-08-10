'use client'

import type { CSSProperties } from 'react'
import { useMemo } from 'react'
import { getPageRenderCacheBitmap } from '@/lib/books/page-render-cache'
import { SPREAD_CROSSFADE_MS } from '@/lib/books/spread-crossfade-config'
import {
  spreadTurnFoldEndTransform,
  spreadTurnFoldPageSurfaceStyle,
  spreadTurnFoldStartTransform,
  spreadTurnFoldTransformOrigin,
  spreadTurnFoldTransitionActive,
  spreadTurnFoldTransitionNone,
  spreadTurnFoldingPageSide,
  type SpreadTurnFoldPageSide,
} from '@/lib/books/spread-turn-fold'
import { SPREAD_TURN_SLIDE_MS } from '@/lib/books/spread-turn-slide-config'
import type { SpreadTurnDirection } from '@/lib/books/spread-turn-slide-config'
import { CachedPageCanvas } from '@/components/students/fullscreen-book-overlay/sections/CachedPageCanvas'
import { SpreadTurnFoldLightingOverlay } from '@/components/students/fullscreen-book-overlay/sections/SpreadTurnFoldLightingOverlay'
import { SpreadCanvasWrapper } from '@/components/books/spread-canvas-wrapper'
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
  /** Phase 2 — 2.5D fold instead of flat translateX when set. */
  foldDirection?: SpreadTurnDirection
  foldTransitionActive?: boolean
}

function foldPageStyle(args: {
  pageSide: SpreadTurnFoldPageSide
  foldDirection: SpreadTurnDirection
  foldTransitionActive: boolean
  isFoldingPage: boolean
}): CSSProperties {
  const { pageSide, foldDirection, foldTransitionActive, isFoldingPage } = args
  const surface = spreadTurnFoldPageSurfaceStyle()

  if (!isFoldingPage) {
    return surface
  }

  const transition = foldTransitionActive
    ? spreadTurnFoldTransitionActive(SPREAD_TURN_SLIDE_MS)
    : spreadTurnFoldTransitionNone()

  return {
    ...surface,
    transformOrigin: spreadTurnFoldTransformOrigin(pageSide),
    transform: foldTransitionActive
      ? spreadTurnFoldEndTransform(foldDirection)
      : spreadTurnFoldStartTransform(),
    willChange: foldTransitionActive ? 'transform' : undefined,
    transition,
  }
}

/**
 * Phase 4 — frozen outgoing spread from PageRenderCache during turn crossfade / fold.
 */
export function SpreadTurnCrossfade({
  unitId,
  outgoing,
  spreadPageWidth,
  pageCanvasHeightPx,
  gutterPullPx: _gutterPullPx,
  prefetchRevision,
  opacity,
  spreadOverlayWidthPx,
  foldDirection,
  foldTransitionActive = false,
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

  const foldMode = foldDirection != null
  const transitionMs = foldMode ? SPREAD_TURN_SLIDE_MS : SPREAD_CROSSFADE_MS
  const foldingPageSide = foldMode ? spreadTurnFoldingPageSide(foldDirection) : null
  const foldSurface = foldMode ? spreadTurnFoldPageSurfaceStyle() : undefined

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[6] motion-reduce:transition-none"
      style={{
        boxSizing: 'border-box',
        width: spreadOverlayWidthPx,
        minWidth: spreadOverlayWidthPx,
        maxWidth: spreadOverlayWidthPx,
        minHeight: pageCanvasHeightPx,
        height: pageCanvasHeightPx,
        opacity: foldMode ? 1 : opacity,
        transition: foldMode ? 'none' : `opacity ${transitionMs}ms ease-out`,
      }}
      aria-hidden
    >
      <SpreadCanvasWrapper
        spreadOverlayWidthPx={spreadOverlayWidthPx}
        pageCanvasHeightPx={pageCanvasHeightPx}
      >
        <div
          className="relative shrink-0 grow-0 overflow-hidden"
          style={{
            boxSizing: 'border-box',
            width: spreadPageWidth,
            minWidth: spreadPageWidth,
            maxWidth: spreadPageWidth,
            flexShrink: 0,
            flexGrow: 0,
            ...foldSurface,
            ...(foldMode && foldingPageSide
              ? foldPageStyle({
                  pageSide: 'left',
                  foldDirection,
                  foldTransitionActive,
                  isFoldingPage: foldingPageSide === 'left',
                })
              : undefined),
          }}
        >
          <CachedPageCanvas
            bitmap={leftBmp}
            cssWidth={spreadPageWidth}
            cssHeight={pageCanvasHeightPx}
          />
          {foldMode && foldingPageSide === 'left' ? (
            <SpreadTurnFoldLightingOverlay
              foldDirection={foldDirection}
              foldTransitionActive={foldTransitionActive}
            />
          ) : null}
        </div>
        {outgoing.right != null && rightBmp ? (
          <div
            className="relative shrink-0 grow-0 overflow-hidden"
            style={{
              boxSizing: 'border-box',
              width: spreadPageWidth,
              minWidth: spreadPageWidth,
              maxWidth: spreadPageWidth,
              flexShrink: 0,
              flexGrow: 0,
              ...foldSurface,
              ...(foldMode && foldingPageSide
                ? foldPageStyle({
                    pageSide: 'right',
                    foldDirection,
                    foldTransitionActive,
                    isFoldingPage: foldingPageSide === 'right',
                  })
                : undefined),
            }}
          >
            <CachedPageCanvas
              bitmap={rightBmp}
              cssWidth={spreadPageWidth}
              cssHeight={pageCanvasHeightPx}
            />
            {foldMode && foldingPageSide === 'right' ? (
              <SpreadTurnFoldLightingOverlay
                foldDirection={foldDirection}
                foldTransitionActive={foldTransitionActive}
              />
            ) : null}
          </div>
        ) : null}
      </SpreadCanvasWrapper>
    </div>
  )
}

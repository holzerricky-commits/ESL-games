'use client'

import type { ReactNode, RefObject } from 'react'
import { PageViewPool, type PageViewPoolProps } from '@/components/students/fullscreen-book-overlay/sections/PageViewPool'
import { SpreadTurnCrossfade } from '@/components/students/fullscreen-book-overlay/sections/SpreadTurnCrossfade'
import { SpreadTurnSlideOutgoing } from '@/components/students/fullscreen-book-overlay/sections/SpreadTurnSlideOutgoing'
import { useSpreadCrossfade } from '@/components/students/fullscreen-book-overlay/hooks/useSpreadCrossfade'
import {
  useSpreadTurnSlide,
  type SpreadTurnSlidePayload,
} from '@/components/students/fullscreen-book-overlay/hooks/useSpreadTurnSlide'
import { BookSpreadFrame } from '@/components/books/book-spread-frame'
import { spreadCrossfadeEnabled, spreadSlideEnabled } from '@/lib/books/feature-flags'
import { cn } from '@/lib/utils'

export interface SpreadStageProps extends PageViewPoolProps {
  gridRef?: RefObject<HTMLDivElement | null>
  spreadOverlayWidthPx: number
  showSpreadRightPage: boolean
  showBookFrame?: boolean
  /** Dim cover + stacks + pages (Full board). Desk stays bright. */
  dimBook?: boolean
  children?: ReactNode
  turnSlide?: SpreadTurnSlidePayload | null
  onTurnSlideComplete?: () => void
}

/**
 * Phase 2 spread layout: inline-flex cluster with pooled page views; turn updates visibility only.
 * Phase 4b: 2.5D page fold at the spine (incoming pool visible underneath).
 */
export function SpreadStage({
  gridRef,
  spreadOverlayWidthPx,
  pageCanvasHeightPx,
  spreadPageWidth,
  gutterPullPx,
  showSpreadRightPage,
  showBookFrame = true,
  dimBook = false,
  spreadRightPage,
  children,
  anchorPage,
  visiblePages,
  unitId,
  prefetchRevision,
  turnSlide = null,
  onTurnSlideComplete,
  ...poolProps
}: SpreadStageProps) {
  const crossfade = useSpreadCrossfade({
    anchorPage,
    visiblePages,
    enabled: spreadCrossfadeEnabled && !spreadSlideEnabled,
  })

  const slide = useSpreadTurnSlide({
    turnSlide: spreadSlideEnabled ? turnSlide : null,
    onTurnSlideComplete,
  })

  const useSlide = spreadSlideEnabled && turnSlide != null

  const incomingLayerStyle = useSlide
    ? undefined
    : crossfade.isAnimating
      ? {
          opacity: crossfade.incomingOpacity,
          transitionDuration: `${crossfade.crossfadeMs}ms`,
        }
      : undefined

  const renderOutgoing = () => {
    if (useSlide && turnSlide) {
      if (slide.useCaptureOutgoing && slide.outgoingCaptureUrl) {
        return (
          <SpreadTurnSlideOutgoing
            captureUrl={slide.outgoingCaptureUrl}
            spreadOverlayWidthPx={spreadOverlayWidthPx}
            spreadPageWidthPx={spreadPageWidth}
            pageCanvasHeightPx={pageCanvasHeightPx}
            hasRightPage={turnSlide.outgoing.right != null}
            foldDirection={slide.direction}
            foldTransitionActive={slide.transitionActive}
          />
        )
      }
      if (slide.fallbackOutgoing) {
        return (
          <SpreadTurnCrossfade
            unitId={unitId}
            outgoing={turnSlide.outgoing}
            spreadPageWidth={spreadPageWidth}
            pageCanvasHeightPx={pageCanvasHeightPx}
            gutterPullPx={gutterPullPx}
            prefetchRevision={prefetchRevision}
            opacity={1}
            spreadOverlayWidthPx={spreadOverlayWidthPx}
            foldDirection={slide.direction}
            foldTransitionActive={slide.transitionActive}
          />
        )
      }
      return null
    }

    if (!crossfade.outgoing) return null
    return (
      <SpreadTurnCrossfade
        unitId={unitId}
        outgoing={crossfade.outgoing}
        spreadPageWidth={spreadPageWidth}
        pageCanvasHeightPx={pageCanvasHeightPx}
        gutterPullPx={gutterPullPx}
        prefetchRevision={prefetchRevision}
        opacity={crossfade.outgoingOpacity}
        spreadOverlayWidthPx={spreadOverlayWidthPx}
      />
    )
  }

  const effectiveSpreadRight =
    showSpreadRightPage && spreadRightPage != null ? spreadRightPage : null
  const twoPageSpread = showSpreadRightPage && spreadRightPage != null

  const stage = (
    <div
      ref={gridRef}
      className={cn(
        'relative shrink-0 grow-0 leading-none',
        twoPageSpread && 'overflow-visible',
      )}
      style={{
        boxSizing: 'border-box',
        position: 'relative',
        width: spreadOverlayWidthPx,
        minWidth: spreadOverlayWidthPx,
        maxWidth: spreadOverlayWidthPx,
        minHeight: pageCanvasHeightPx,
        height: pageCanvasHeightPx,
        flexShrink: 0,
        flexGrow: 0,
      }}
    >
      {renderOutgoing()}
      <div
        className={cn(
          'relative motion-reduce:transition-none',
          !useSlide && crossfade.isAnimating && 'transition-opacity ease-out',
        )}
        style={incomingLayerStyle}
      >
        <PageViewPool
          {...poolProps}
          unitId={unitId}
          prefetchRevision={prefetchRevision}
          anchorPage={anchorPage}
          spreadRightPage={effectiveSpreadRight}
          visiblePages={visiblePages}
          pageCanvasHeightPx={pageCanvasHeightPx}
          gutterPullPx={gutterPullPx}
          spreadPageWidth={spreadPageWidth}
          spreadOverlayWidthPx={spreadOverlayWidthPx}
          showBookFrame={showBookFrame}
        />
      </div>
      {!showSpreadRightPage || spreadRightPage == null ? (
        <div
          aria-hidden
          className="shrink-0 grow-0"
          style={{
            boxSizing: 'border-box',
            width: spreadPageWidth,
            minWidth: spreadPageWidth,
            maxWidth: spreadPageWidth,
            height: pageCanvasHeightPx,
            flexShrink: 0,
            flexGrow: 0,
          }}
        />
      ) : null}
      {!showBookFrame && children ? (
        <div
          className="pointer-events-none absolute inset-0 z-[36]"
          style={{ width: spreadOverlayWidthPx, height: pageCanvasHeightPx }}
        >
          {children}
        </div>
      ) : null}
    </div>
  )

  if (!showBookFrame) return stage

  return (
    <BookSpreadFrame
      contentWidthPx={spreadOverlayWidthPx}
      contentHeightPx={pageCanvasHeightPx}
      spreadPageWidthPx={spreadPageWidth}
      twoPage={twoPageSpread}
      dimBook={dimBook}
      overlayChildren={children}
    >
      {stage}
    </BookSpreadFrame>
  )
}

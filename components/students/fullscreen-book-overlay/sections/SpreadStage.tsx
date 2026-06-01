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
import { spreadCrossfadeEnabled, spreadSlideEnabled } from '@/lib/books/feature-flags'
import { cn } from '@/lib/utils'

export interface SpreadStageProps extends PageViewPoolProps {
  gridRef?: RefObject<HTMLDivElement | null>
  spreadOverlayWidthPx: number
  showSpreadRightPage: boolean
  children?: ReactNode
  turnSlide?: SpreadTurnSlidePayload | null
  onTurnSlideComplete?: () => void
}

/**
 * Phase 2 spread layout: inline-flex cluster with pooled page views; turn updates visibility only.
 * Phase 4b: directional spread slide (incoming pool + annotations move together).
 */
export function SpreadStage({
  gridRef,
  spreadOverlayWidthPx,
  pageCanvasHeightPx,
  spreadPageWidth,
  gutterPullPx,
  showSpreadRightPage,
  spreadRightPage,
  children,
  isSinglePageMode,
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
    isSinglePageMode,
    enabled: spreadCrossfadeEnabled && !spreadSlideEnabled,
  })

  const slide = useSpreadTurnSlide({
    turnSlide: spreadSlideEnabled ? turnSlide : null,
    onTurnSlideComplete,
  })

  const useSlide = spreadSlideEnabled && turnSlide != null

  const incomingLayerStyle = useSlide
    ? {
        transform: `translateX(${slide.incomingTranslateX}%)`,
        transition: slide.transitionActive
          ? `transform ${slide.slideMs}ms cubic-bezier(0.22, 1, 0.36, 1)`
          : 'none',
      }
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
            spreadOverlayWidthPx={isSinglePageMode ? spreadPageWidth : spreadOverlayWidthPx}
            pageCanvasHeightPx={pageCanvasHeightPx}
            translateXPercent={slide.outgoingTranslateX}
            slideTransitionActive={slide.transitionActive}
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
            spreadOverlayWidthPx={isSinglePageMode ? spreadPageWidth : spreadOverlayWidthPx}
            translateXPercent={slide.outgoingTranslateX}
            slideTransitionActive={slide.transitionActive}
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
        spreadOverlayWidthPx={isSinglePageMode ? spreadPageWidth : spreadOverlayWidthPx}
      />
    )
  }

  if (isSinglePageMode) {
    return (
      <div
        ref={gridRef}
        className="relative flex w-max max-w-full items-start justify-center overflow-hidden leading-none"
        style={{ minHeight: pageCanvasHeightPx }}
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
            spreadRightPage={null}
            isSinglePageMode
            visiblePages={visiblePages}
            pageCanvasHeightPx={pageCanvasHeightPx}
            gutterPullPx={gutterPullPx}
            spreadPageWidth={spreadPageWidth}
          />
        </div>
      </div>
    )
  }

  const effectiveSpreadRight =
    showSpreadRightPage && spreadRightPage != null ? spreadRightPage : null

  return (
    <div
      ref={gridRef}
      className="relative inline-flex w-max max-w-full items-start overflow-hidden leading-none"
      style={{
        minHeight: pageCanvasHeightPx,
        height: pageCanvasHeightPx,
        width: spreadOverlayWidthPx,
      }}
    >
      {renderOutgoing()}
      <div
        className={cn(
          'relative inline-flex w-full items-start leading-none motion-reduce:transition-none',
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
          isSinglePageMode={false}
          visiblePages={visiblePages}
          pageCanvasHeightPx={pageCanvasHeightPx}
          gutterPullPx={gutterPullPx}
          spreadPageWidth={spreadPageWidth}
        >
          {children}
        </PageViewPool>
      </div>
      {!showSpreadRightPage || spreadRightPage == null ? (
        <div aria-hidden className="shrink-0" style={{ width: spreadPageWidth, height: pageCanvasHeightPx }} />
      ) : null}
    </div>
  )
}

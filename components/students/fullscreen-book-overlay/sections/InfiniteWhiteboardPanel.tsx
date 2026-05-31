'use client'

import type { CSSProperties, MutableRefObject } from 'react'
import { useEffect, useRef } from 'react'
import {
  BookPageAnnotationLayer,
  type AnnotationCapabilities,
  type BookPageAnnotationHandle,
} from '@/components/students/book-page-annotation-layer'
import type { BookPageAnnotationLayerProps } from '@/components/students/book-page-annotation-layer'
import { WHITEBOARD_EYEDROPER_PAGE } from '@/lib/books/whiteboard-storage'
import { cn } from '@/lib/utils'
import {
  WHITEBOARD_HEADER_HEIGHT_PX,
  WHITEBOARD_PANEL_CHROME,
} from '../constants'
import type { WhiteboardLayoutMode, WhiteboardSlotSide } from '../hooks/useWhiteboardPlacement'
import { useWhiteboardSlotMotion } from '../hooks/useWhiteboardSlotMotion'
import type { WhiteboardSlotMotionApi } from '../hooks/useWhiteboardSlotMotion'
import { WhiteboardHeader } from './WhiteboardChrome'

const SCROLLBAR_HIDDEN =
  'overflow-y-auto overscroll-y-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'

type LayerProps = Pick<
  BookPageAnnotationLayerProps,
  | 'studentId'
  | 'bookId'
  | 'unitId'
  | 'mode'
  | 'eyedropperVariant'
  | 'stampVariant'
  | 'stampQuestionColor'
  | 'strokeWidthScale'
  | 'eraserLineStrokeWidthScale'
  | 'penStrokeWidthScale'
  | 'shapeStrokeWidthScale'
  | 'stampScale'
  | 'strokeColor'
  | 'penInkColor'
  | 'penInkStyle'
  | 'penStrokeProfile'
  | 'strokeLineDashStyle'
  | 'markerStraightStroke'
  | 'markerDecoratedEdge'
  | 'penAutoGroupConnected'
  | 'marqueeSelectRule'
  | 'shapeColor'
  | 'textColor'
  | 'shapeLineDashStyle'
  | 'shapeStrokeEnabled'
  | 'shapeFillMode'
  | 'shapeFillColor'
  | 'textFontSizeNorm'
  | 'textVisualStyle'
  | 'textFillColor'
  | 'stickyFillColor'
  | 'stickyFontSizeNorm'
  | 'defaultStickyWNorm'
  | 'defaultStickyHNorm'
>

export interface InfiniteWhiteboardPanelProps extends LayerProps {
  widthPx: number
  viewportHeightPx: number
  contentHeightPx: number
  storagePageKey: string
  surfaceStyle: Pick<CSSProperties, 'backgroundColor' | 'backgroundImage' | 'backgroundSize'>
  layoutMode: WhiteboardLayoutMode
  slotSide: WhiteboardSlotSide
  setSlotSide: (side: WhiteboardSlotSide) => void
  slotTravelPx: number
  registerSlotMotion?: (api: WhiteboardSlotMotionApi | null) => void
  toggleFullscreen: () => void
  onMinimize: () => void
  suppressChrome?: boolean
  fullscreenWidthPx?: number
  wbAnnRef: MutableRefObject<BookPageAnnotationHandle | null>
  captureRootRef: MutableRefObject<HTMLDivElement | null>
  onCapabilitiesChange: (caps: AnnotationCapabilities) => void
  onEyedropperPick: (clientX: number, clientY: number) => void
  onExtendRunway?: () => void
  className?: string
}

export function InfiniteWhiteboardPanel({
  widthPx,
  viewportHeightPx,
  contentHeightPx,
  storagePageKey,
  surfaceStyle,
  layoutMode,
  slotSide,
  setSlotSide,
  slotTravelPx,
  registerSlotMotion,
  toggleFullscreen,
  onMinimize,
  suppressChrome = false,
  fullscreenWidthPx,
  wbAnnRef,
  captureRootRef,
  onCapabilitiesChange,
  onEyedropperPick,
  onExtendRunway,
  className,
  ...layerProps
}: InfiniteWhiteboardPanelProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const panelWidthPx = layoutMode === 'fullscreen' && fullscreenWidthPx != null ? fullscreenWidthPx : widthPx
  const slotDragEnabled = layoutMode === 'slot'
  const canvasViewportHeightPx = viewportHeightPx - WHITEBOARD_HEADER_HEIGHT_PX

  const {
    panelRef,
    panelMotionStyle,
    onSlotDragPointerDown,
    onSlotDragPointerMove,
    onSlotDragPointerUp,
    onSlotDragPointerCancel,
    moveTo,
  } = useWhiteboardSlotMotion({
    slotSide,
    commitSlotSide: setSlotSide,
    slotTravelPx,
    enabled: slotDragEnabled,
    registerMotionApi: registerSlotMotion,
  })

  useEffect(() => {
    const el = scrollRef.current
    if (!el || !onExtendRunway) return
    const onScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - canvasViewportHeightPx * 0.12) {
        onExtendRunway()
      }
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [canvasViewportHeightPx, onExtendRunway])

  return (
    <div
      ref={panelRef}
      className={cn(
        'group relative z-10 flex shrink-0 flex-col',
        WHITEBOARD_PANEL_CHROME,
        layoutMode === 'slot' && 'isolate',
        className,
      )}
      style={{
        width: panelWidthPx,
        height: viewportHeightPx,
        ...panelMotionStyle,
      }}
      data-whiteboard-slot={slotSide}
      data-whiteboard-layout={layoutMode}
    >
      <WhiteboardHeader
        suppressChrome={suppressChrome}
        layoutMode={layoutMode}
        swapSlotSide={() => moveTo(slotSide === 'left' ? 'right' : 'left')}
        toggleFullscreen={toggleFullscreen}
        onMinimize={onMinimize}
        onClearBoard={() => wbAnnRef.current?.clear()}
        slotDragEnabled={slotDragEnabled}
        onSlotDragPointerDown={onSlotDragPointerDown}
        onSlotDragPointerMove={onSlotDragPointerMove}
        onSlotDragPointerUp={onSlotDragPointerUp}
        onSlotDragPointerCancel={onSlotDragPointerCancel}
      />

      <div
        ref={(node) => {
          scrollRef.current = node
          captureRootRef.current = node
        }}
        className={cn('relative z-0 min-h-0 flex-1', SCROLLBAR_HIDDEN)}
        style={{ height: canvasViewportHeightPx, ...surfaceStyle }}
      >
        <div className="relative" style={{ width: panelWidthPx, height: contentHeightPx, ...surfaceStyle }}>
          <BookPageAnnotationLayer
            ref={wbAnnRef}
            {...layerProps}
            pageNumber={WHITEBOARD_EYEDROPER_PAGE}
            storageChannel="whiteboard"
            storagePageKey={storagePageKey}
            widthPx={panelWidthPx}
            heightPx={contentHeightPx}
            onEyedropperPick={onEyedropperPick}
            onCapabilitiesChange={onCapabilitiesChange}
          />
        </div>
      </div>
    </div>
  )
}

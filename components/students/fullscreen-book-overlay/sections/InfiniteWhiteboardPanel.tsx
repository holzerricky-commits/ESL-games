'use client'

import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import type { CSSProperties, MutableRefObject } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LiveEraserLineDraft } from '@/components/students/book-page-annotation-layer'
import { BookSpreadSessionLayer } from '@/components/students/book-spread-session-layer'
import { BookSpreadStrokeOverlay } from '@/components/students/book-spread-stroke-overlay'
import {
  BookPageAnnotationLayer,
  type AnnotationCapabilities,
  type BookPageAnnotationHandle,
} from '@/components/students/book-page-annotation-layer'
import type { BookPageAnnotationLayerProps } from '@/components/students/book-page-annotation-layer'
import { whiteboardInkSessionEnabled } from '@/lib/books/feature-flags'
import type { WhiteboardSessionDocument } from '@/lib/books/whiteboard-session-types'
import type { WhiteboardSessionStore } from '@/lib/books/whiteboard-session-store'
import { WHITEBOARD_EYEDROPER_PAGE } from '@/lib/books/whiteboard-storage'
import type { WhiteboardViewportInkConfig } from '@/lib/books/whiteboard-viewport-ink'
import { isWhiteboardViewportInkActive } from '@/lib/books/whiteboard-viewport-ink'
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
  wbStrokeOverlayRef?: MutableRefObject<BookPageAnnotationHandle | null>
  whiteboardSessionStoreRef?: MutableRefObject<WhiteboardSessionStore | null>
  whiteboardSessionDoc?: WhiteboardSessionDocument | null
  appendWhiteboardSessionCommand?: (cmd: AnnotationCommand) => void
  whiteboardSessionUndo?: () => boolean
  whiteboardSessionRedo?: () => boolean
  whiteboardSessionClear?: () => void
  wbStrokeCaptureEnabled?: boolean
  onWhiteboardOverlayCaps?: (caps: AnnotationCapabilities) => void
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
  wbStrokeOverlayRef,
  whiteboardSessionStoreRef,
  whiteboardSessionDoc = null,
  appendWhiteboardSessionCommand,
  whiteboardSessionUndo,
  whiteboardSessionRedo,
  whiteboardSessionClear,
  wbStrokeCaptureEnabled = false,
  onWhiteboardOverlayCaps,
  captureRootRef,
  onCapabilitiesChange,
  onEyedropperPick,
  onExtendRunway,
  className,
  studentId,
  bookId,
  unitId,
  mode,
  shapeColor,
  ...layerProps
}: InfiniteWhiteboardPanelProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const wbViewportInkRef = useRef<HTMLDivElement | null>(null)
  const wbContentCaptureRef = useRef<HTMLDivElement | null>(null)
  const [scrollTopPx, setScrollTopPx] = useState(0)
  const [wbEraserLineDraft, setWbEraserLineDraft] = useState<LiveEraserLineDraft | null>(null)
  const [wbSessionSelectedIds, setWbSessionSelectedIds] = useState<string[]>([])

  const setWbSessionSelected = useCallback(
    (ids: string[]) => {
      whiteboardSessionStoreRef?.current?.setSelectedIds(ids)
      setWbSessionSelectedIds(ids)
    },
    [whiteboardSessionStoreRef],
  )

  const moveWbSessionSelected = useCallback(
    (dx: number, dy: number) => {
      whiteboardSessionStoreRef?.current?.moveSelectedBy(dx, dy)
    },
    [whiteboardSessionStoreRef],
  )

  const panelWidthPx = layoutMode === 'fullscreen' && fullscreenWidthPx != null ? fullscreenWidthPx : widthPx
  const slotDragEnabled = layoutMode === 'slot'
  const canvasViewportHeightPx = viewportHeightPx - WHITEBOARD_HEADER_HEIGHT_PX

  const whiteboardSessionActive = Boolean(whiteboardInkSessionEnabled && whiteboardSessionDoc)

  const whiteboardInkDelegated = whiteboardSessionActive

  const viewportInk: WhiteboardViewportInkConfig | undefined = useMemo(() => {
    if (!whiteboardSessionActive) return undefined
    return {
      contentHeightPx,
      viewportHeightPx: canvasViewportHeightPx,
      scrollTopPx,
    }
  }, [canvasViewportHeightPx, contentHeightPx, scrollTopPx, whiteboardSessionActive])

  const useViewportInk =
    whiteboardSessionActive &&
    viewportInk != null &&
    isWhiteboardViewportInkActive(viewportInk)

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
    if (!el) return
    const onScroll = () => {
      setScrollTopPx(el.scrollTop)
      if (onExtendRunway && el.scrollTop + el.clientHeight >= el.scrollHeight - canvasViewportHeightPx * 0.12) {
        onExtendRunway()
      }
    }
    onScroll()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [canvasViewportHeightPx, onExtendRunway])

  const handleClearBoard = () => {
    whiteboardSessionClear?.()
    wbAnnRef.current?.clear()
  }

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
        onClearBoard={handleClearBoard}
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
        <div
          ref={wbContentCaptureRef}
          className="relative"
          style={{
            width: panelWidthPx,
            height: contentHeightPx,
            ...surfaceStyle,
          }}
        >
          {useViewportInk && whiteboardSessionDoc ? (
            <div
              ref={wbViewportInkRef}
              className={cn(
                'sticky top-0 z-[25]',
                wbStrokeCaptureEnabled ? 'touch-none' : 'pointer-events-none',
              )}
              style={{
                width: panelWidthPx,
                height: canvasViewportHeightPx,
                touchAction: wbStrokeCaptureEnabled ? 'none' : undefined,
              }}
            >
              <BookSpreadSessionLayer
                widthPx={panelWidthPx}
                heightPx={canvasViewportHeightPx}
                commands={whiteboardSessionDoc.commands}
                viewportInk={viewportInk}
                trailingEraserLineDraft={wbEraserLineDraft}
                selectEnabled={mode === 'select'}
                selectedIds={wbSessionSelectedIds}
                onSelectedIdsChange={setWbSessionSelected}
                onMoveSelectedBy={moveWbSessionSelected}
              />
              <BookSpreadStrokeOverlay
                ref={wbStrokeOverlayRef}
                leftPageCaptureRef={wbViewportInkRef}
                rightPageCaptureRef={wbViewportInkRef}
                leftAnnRef={wbAnnRef}
                rightAnnRef={wbAnnRef}
                annotationMode={mode}
                strokeWidthScale={layerProps.strokeWidthScale}
                eraserLineStrokeWidthScale={layerProps.eraserLineStrokeWidthScale}
                penStrokeWidthScale={layerProps.penStrokeWidthScale}
                strokeColor={layerProps.strokeColor}
                penInkColor={layerProps.penInkColor}
                penInkStyle={layerProps.penInkStyle}
                penStrokeProfile={layerProps.penStrokeProfile}
                strokeLineDashStyle={layerProps.strokeLineDashStyle}
                markerStraightStroke={layerProps.markerStraightStroke}
                markerDecoratedEdge={layerProps.markerDecoratedEdge}
                shapeColor={shapeColor}
                shapeStrokeWidthScale={layerProps.shapeStrokeWidthScale}
                shapeLineDashStyle={layerProps.shapeLineDashStyle}
                shapeStrokeEnabled={layerProps.shapeStrokeEnabled}
                shapeFillMode={layerProps.shapeFillMode}
                shapeFillColor={layerProps.shapeFillColor}
                pageNumberLeft={WHITEBOARD_EYEDROPER_PAGE}
                pageNumberRight={WHITEBOARD_EYEDROPER_PAGE}
                annotationTargetPage={WHITEBOARD_EYEDROPER_PAGE}
                setAnnotationTargetPage={() => {}}
                onCapabilitiesChange={onWhiteboardOverlayCaps ?? onCapabilitiesChange}
                captureEnabled={wbStrokeCaptureEnabled}
                spreadOverlayWidthPx={panelWidthPx}
                spreadOverlayHeightPx={contentHeightPx}
                spreadCanvasHeightPx={canvasViewportHeightPx}
                whiteboardViewportInk={viewportInk}
                spreadPageWidthPx={panelWidthPx}
                leftPenInkPatternOriginXPx={0}
                rightPenInkPatternOriginXPx={0}
                spreadSeamNormX={1}
                spreadSessionMode
                onSpreadSessionAppendCommand={appendWhiteboardSessionCommand}
                spreadSessionUndo={whiteboardSessionUndo}
                spreadSessionRedo={whiteboardSessionRedo}
                spreadSessionClear={whiteboardSessionClear}
                onSpreadEraserLineDraftChange={setWbEraserLineDraft}
              />
            </div>
          ) : null}
          <div className={useViewportInk ? 'absolute inset-0 z-[20]' : 'relative h-full w-full'}>
            <BookPageAnnotationLayer
              ref={wbAnnRef}
              {...layerProps}
              studentId={studentId}
              bookId={bookId}
              unitId={unitId}
              mode={mode}
              shapeColor={shapeColor}
              pageNumber={WHITEBOARD_EYEDROPER_PAGE}
              storageChannel="whiteboard"
              storagePageKey={storagePageKey}
              widthPx={panelWidthPx}
              heightPx={contentHeightPx}
              delegatePointerToWhiteboardPen={wbStrokeCaptureEnabled}
              whiteboardInkDelegated={whiteboardInkDelegated}
              whiteboardSessionStoreRef={whiteboardSessionStoreRef}
              onEyedropperPick={onEyedropperPick}
              onCapabilitiesChange={onCapabilitiesChange}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

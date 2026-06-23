'use client'

import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import type { CSSProperties, MutableRefObject } from 'react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { LiveEraserLineDraft, LiveStrokeDraft } from '@/components/students/book-page-annotation-layer'
import { BookSpreadSessionLayer } from '@/components/students/book-spread-session-layer'
import { BookSpreadStrokeOverlay } from '@/components/students/book-spread-stroke-overlay'
import {
  BookPageAnnotationLayer,
  type AnnotationCapabilities,
  type BookPageAnnotationHandle,
} from '@/components/students/book-page-annotation-layer'
import type { BookPageAnnotationLayerProps } from '@/components/students/book-page-annotation-layer'
import { whiteboardInkSessionEnabled } from '@/lib/books/feature-flags'
import { lessonBoardAllowsRunwayGrowth, type LessonBoardPageOrientation } from '@/lib/books/lesson-board-types'
import type { WhiteboardSessionDocument } from '@/lib/books/whiteboard-session-types'
import type { WhiteboardSessionStore } from '@/lib/books/whiteboard-session-store'
import {
  lessonBoardActivePageSummary,
  lessonBoardPageStorageKey,
} from '@/lib/books/lesson-board-session-ops'
import { WHITEBOARD_EYEDROPER_PAGE } from '@/lib/books/whiteboard-storage'
import {
  buildWhiteboardViewportInkConfig,
  resolveLessonBoardPaintHeightPx,
} from '@/lib/books/lesson-board-ink-layout'
import {
  isWhiteboardViewportInkActive,
  type WhiteboardViewportInkConfig,
} from '@/lib/books/whiteboard-viewport-ink'
import { appendCommandWithPenAutoGroup } from '@/lib/books/annotation-pen-auto-group'
import { isWritableStickerInteraction } from '@/lib/books/sticker-tool'
import { commitRotatedAnnotationCommands } from '@/lib/books/annotation-rotation'
import { scaleAnnotationCommandsFromOrientedFrames } from '@/lib/books/annotation-scale'
import type { NormRect, OrientedSelectionFrame } from '@/lib/books/annotation-select'
import type { SelectionMoveClampContext } from '@/lib/books/annotation-scale'
import { cn } from '@/lib/utils'
import {
  WHITEBOARD_HEADER_HEIGHT_PX,
  WHITEBOARD_PANEL_CHROME,
} from '../constants'
import type { WhiteboardLayoutMode, WhiteboardSlotSide } from '../hooks/useWhiteboardPlacement'
import { useWhiteboardSlotMotion } from '../hooks/useWhiteboardSlotMotion'
import type { WhiteboardSlotMotionApi } from '../hooks/useWhiteboardSlotMotion'
import { WhiteboardHeader } from './WhiteboardChrome'
import type { SpreadSessionDomConfig } from '@/components/students/fullscreen-book-overlay/hooks/useSpreadSessionDomInteraction'
import type {
  StickyAnnotationCommand,
  TextAnnotationCommand,
} from '@/lib/books/annotation-command-types'

const SCROLLBAR_HIDDEN =
  'overflow-y-auto overscroll-y-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'

type LayerProps = Pick<
  BookPageAnnotationLayerProps,
  | 'studentId'
  | 'bookId'
  | 'unitId'
  | 'mode'
  | 'eyedropperVariant'
  | 'stickerKind'
  | 'writableStickerVariant'
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
  | 'shapeRoundedCorners'
  | 'textFontSizeNorm'
  | 'textFontId'
  | 'textVisualStyle'
  | 'textFillColor'
  | 'stickyFillColor'
  | 'stickyFontSizeNorm'
  | 'defaultStickyWNorm'
  | 'defaultStickyHNorm'
>

export interface InfiniteWhiteboardPanelProps extends LayerProps {
  widthPx: number
  /** Ink coordinate width; defaults to panel width when omitted. */
  logicalCanvasWidthPx?: number
  viewportHeightPx: number
  contentHeightPx: number
  storagePageKey: string
  surfaceStyle: Pick<CSSProperties, 'backgroundColor' | 'backgroundImage' | 'backgroundSize'>
  slotSide: WhiteboardSlotSide
  layoutMode?: WhiteboardLayoutMode
  /** Scaled content height for ink paint when floating. */
  floatDisplayContentHeightPx?: number
  onFloat?: () => void
  onDock?: () => void
  onFloatDragPointerDown?: (e: React.PointerEvent) => void
  onFloatDragPointerMove?: (e: React.PointerEvent) => void
  onFloatDragPointerUp?: (e: React.PointerEvent) => void
  onFloatDragPointerCancel?: () => void
  onFloatResizePointerDown?: (e: React.PointerEvent) => void
  onFloatResizePointerMove?: (e: React.PointerEvent) => void
  onFloatResizePointerUp?: (e: React.PointerEvent) => void
  onFloatResizePointerCancel?: () => void
  setSlotSide: (side: WhiteboardSlotSide) => void
  slotTravelPx: number
  registerSlotMotion?: (api: WhiteboardSlotMotionApi | null) => void
  onMinimize: () => void
  suppressChrome?: boolean
  /** Hide header controls until open flight finishes (bar stays full height). */
  deferHeaderChromeActions?: boolean
  wbAnnRef: MutableRefObject<BookPageAnnotationHandle | null>
  wbStrokeOverlayRef?: MutableRefObject<BookPageAnnotationHandle | null>
  whiteboardSessionStoreRef?: MutableRefObject<WhiteboardSessionStore | null>
  selectionMoveClampRef?: MutableRefObject<SelectionMoveClampContext | null>
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
  onNewLessonBoardPage?: (orientation: LessonBoardPageOrientation) => void
  className?: string
}

export function InfiniteWhiteboardPanel({
  widthPx,
  logicalCanvasWidthPx: logicalCanvasWidthPxProp,
  viewportHeightPx,
  contentHeightPx,
  storagePageKey,
  surfaceStyle,
  slotSide,
  layoutMode = 'slot',
  floatDisplayContentHeightPx,
  onFloat,
  onDock,
  onFloatDragPointerDown,
  onFloatDragPointerMove,
  onFloatDragPointerUp,
  onFloatDragPointerCancel,
  onFloatResizePointerDown,
  onFloatResizePointerMove,
  onFloatResizePointerUp,
  onFloatResizePointerCancel,
  setSlotSide,
  slotTravelPx,
  registerSlotMotion,
  onMinimize,
  suppressChrome = false,
  deferHeaderChromeActions = false,
  wbAnnRef,
  wbStrokeOverlayRef,
  whiteboardSessionStoreRef,
  selectionMoveClampRef,
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
  onNewLessonBoardPage,
  className,
  studentId,
  bookId,
  unitId,
  mode,
  shapeColor,
  ...layerProps
}: InfiniteWhiteboardPanelProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const wbInkLayerRef = useRef<HTMLDivElement | null>(null)
  const wbContentCaptureRef = useRef<HTMLDivElement | null>(null)
  const [scrollTopPx, setScrollTopPx] = useState(0)
  const [wbEraserLineDraft, setWbEraserLineDraft] = useState<LiveEraserLineDraft | null>(null)
  const [wbMarkerStrokeDraft, setWbMarkerStrokeDraft] = useState<LiveStrokeDraft | null>(null)
  const [wbSessionSelectedIds, setWbSessionSelectedIds] = useState<string[]>([])
  const [wbSessionNudgePreview, setWbSessionNudgePreview] = useState<{
    dx: number
    dy: number
  } | null>(null)

  const setWbSessionSelected = useCallback(
    (ids: string[]) => {
      whiteboardSessionStoreRef?.current?.setSelectedIds(ids)
    },
    [whiteboardSessionStoreRef],
  )

  const moveWbSessionSelected = useCallback(
    (dx: number, dy: number) => {
      whiteboardSessionStoreRef?.current?.moveSelectedBy(dx, dy)
      wbAnnRef.current?.moveSelectedBy?.(dx, dy)
    },
    [wbAnnRef, whiteboardSessionStoreRef],
  )

  const panelWidthPx = widthPx
  const canvasViewportHeightPx = viewportHeightPx - WHITEBOARD_HEADER_HEIGHT_PX
  const isFloatingLayout = layoutMode === 'floating'
  const paintWidthPx = panelWidthPx
  const paintContentHeightPx =
    isFloatingLayout && floatDisplayContentHeightPx != null
      ? floatDisplayContentHeightPx
      : contentHeightPx

  const whiteboardSessionActive = Boolean(whiteboardInkSessionEnabled && whiteboardSessionDoc)
  const lessonBoardActivePageId = whiteboardSessionDoc?.activePageId ?? ''

  useEffect(() => {
    if (!whiteboardSessionActive) {
      setWbSessionSelectedIds([])
      setWbSessionNudgePreview(null)
      return
    }
    const store = whiteboardSessionStoreRef?.current
    if (!store) return
    const initial = store.getState()
    setWbSessionSelectedIds(initial.selectedIds)
    setWbSessionNudgePreview(initial.nudgePreview)
    return store.subscribe((state) => {
      setWbSessionSelectedIds(state.selectedIds)
      setWbSessionNudgePreview(state.nudgePreview)
    })
  }, [
    whiteboardSessionActive,
    whiteboardSessionStoreRef,
    lessonBoardActivePageId,
    whiteboardSessionDoc?.meta.revision,
  ])

  const [measuredContentHeightPx, setMeasuredContentHeightPx] = useState<number | null>(null)

  useLayoutEffect(() => {
    setMeasuredContentHeightPx(null)
  }, [lessonBoardActivePageId, paintContentHeightPx, paintWidthPx, layoutMode])

  useLayoutEffect(() => {
    const el = wbContentCaptureRef.current
    if (!el) return
    const measure = () => {
      const next = el.offsetHeight
      if (next > 0) setMeasuredContentHeightPx(next)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [lessonBoardActivePageId, paintContentHeightPx, paintWidthPx, layoutMode])

  const effectivePaintContentHeightPx = resolveLessonBoardPaintHeightPx(
    paintContentHeightPx,
    measuredContentHeightPx,
  )

  useLayoutEffect(() => {
    if (!selectionMoveClampRef) return
    if (!(paintWidthPx > 0) || !(effectivePaintContentHeightPx > 0)) {
      selectionMoveClampRef.current = null
      return
    }
    selectionMoveClampRef.current = {
      widthPx: paintWidthPx,
      heightPx: effectivePaintContentHeightPx,
    }
  }, [selectionMoveClampRef, paintWidthPx, effectivePaintContentHeightPx])

  const rotateWbSessionSelected = useCallback(
    (
      pivot: [number, number],
      deltaRad: number,
      ids: string[],
      previewBase?: readonly AnnotationCommand[] | null,
      groupRotationFrame?: OrientedSelectionFrame | null,
    ) => {
      const store = whiteboardSessionStoreRef?.current
      if (!store || ids.length === 0 || Math.abs(deltaRad) < 1e-6) return
      const layout = { widthPx: paintWidthPx, heightPx: effectivePaintContentHeightPx }
      store.patchCommands((cmds) =>
        commitRotatedAnnotationCommands(
          cmds,
          new Set(ids),
          pivot,
          deltaRad,
          layout,
          previewBase,
          groupRotationFrame,
        ),
      )
    },
    [effectivePaintContentHeightPx, paintWidthPx, whiteboardSessionStoreRef],
  )

  const scaleWbSessionSelected = useCallback(
    (startFrame: OrientedSelectionFrame, newFrame: OrientedSelectionFrame) => {
      const store = whiteboardSessionStoreRef?.current
      if (!store) return
      const ids = new Set(store.getState().selectedIds)
      if (ids.size === 0) return
      store.patchCommands((cmds) =>
        scaleAnnotationCommandsFromOrientedFrames(
          cmds,
          ids,
          startFrame,
          newFrame,
          paintWidthPx,
          effectivePaintContentHeightPx,
        ),
      )
    },
    [effectivePaintContentHeightPx, paintWidthPx, whiteboardSessionStoreRef],
  )

  const penAutoGroupConnected = layerProps.penAutoGroupConnected !== false

  const appendWhiteboardSessionCommandWithAutoGroup = useCallback(
    (cmd: AnnotationCommand) => {
      const store = whiteboardSessionStoreRef?.current
      if (!store) return
      if (penAutoGroupConnected && cmd.kind === 'stroke' && cmd.tool === 'pen') {
        store.patchCommands((commands) =>
          appendCommandWithPenAutoGroup(commands, cmd, {
            penAutoGroupConnected: true,
            widthPx: paintWidthPx,
            heightPx: effectivePaintContentHeightPx,
          }),
        )
        return
      }
      store.appendCommand(cmd)
    },
    [
      effectivePaintContentHeightPx,
      paintWidthPx,
      penAutoGroupConnected,
      whiteboardSessionStoreRef,
    ],
  )

  const lessonBoardPageNav = whiteboardSessionDoc
    ? lessonBoardActivePageSummary(whiteboardSessionDoc)
    : { index: 0, total: 1, page: null }
  const resolvedPageStorageKey = lessonBoardActivePageId
    ? lessonBoardPageStorageKey(storagePageKey, lessonBoardActivePageId)
    : storagePageKey

  const whiteboardInkDelegated = whiteboardSessionActive
  const wbDomToolsActive =
    whiteboardInkDelegated &&
    (mode === 'text' || isWritableStickerInteraction(mode, layerProps.stickerKind ?? 'quick'))

  const patchWhiteboardSessionDomCommand = useCallback(
    (id: string, partial: Partial<TextAnnotationCommand | StickyAnnotationCommand>) => {
      whiteboardSessionStoreRef?.current?.patchCommands((cmds) =>
        cmds.map((c) => (c.id === id ? ({ ...c, ...partial } as AnnotationCommand) : c)),
      )
    },
    [whiteboardSessionStoreRef],
  )

  const deleteWhiteboardSessionDomCommand = useCallback(
    (id: string) => {
      const store = whiteboardSessionStoreRef?.current
      if (!store) return
      store.patchCommands((cmds) => cmds.filter((c) => c.id !== id))
      const remaining = store.getState().selectedIds.filter((sid) => sid !== id)
      if (remaining.length !== store.getState().selectedIds.length) {
        store.setSelectedIds(remaining)
      }
    },
    [whiteboardSessionStoreRef],
  )

  const whiteboardDomConfig = useMemo((): SpreadSessionDomConfig | null => {
    if (!whiteboardInkDelegated || !whiteboardSessionDoc) return null
    return {
      enabled: true,
      mode,
      stickerKind: layerProps.stickerKind ?? 'quick',
      writableStickerVariant: layerProps.writableStickerVariant ?? 'note',
      textColor: layerProps.textColor ?? '#111827',
      textFontSizeNorm: layerProps.textFontSizeNorm,
      textFontId: layerProps.textFontId,
      textVisualStyle: layerProps.textVisualStyle ?? 'plain',
      textFillColor: layerProps.textFillColor ?? '#ffffff',
      stickyFillColor: layerProps.stickyFillColor ?? '#fef3c7',
      stickyFontSizeNorm: layerProps.stickyFontSizeNorm,
      defaultStickyWNorm: layerProps.defaultStickyWNorm ?? 0.22,
      defaultStickyHNorm: layerProps.defaultStickyHNorm ?? 0.11,
      commands: whiteboardSessionDoc.commands,
      widthPx: paintWidthPx,
      heightPx: effectivePaintContentHeightPx,
      selectEnabled: mode === 'select',
      selectedIds: wbSessionSelectedIds,
      onAppendCommand: appendWhiteboardSessionCommandWithAutoGroup,
      onPatchCommand: patchWhiteboardSessionDomCommand,
      onDeleteText: deleteWhiteboardSessionDomCommand,
      onDeleteSticky: deleteWhiteboardSessionDomCommand,
      onSelectedIdsChange: setWbSessionSelected,
    }
  }, [
    appendWhiteboardSessionCommandWithAutoGroup,
    deleteWhiteboardSessionDomCommand,
    effectivePaintContentHeightPx,
    layerProps.defaultStickyHNorm,
    layerProps.defaultStickyWNorm,
    layerProps.stickyFillColor,
    layerProps.stickyFontSizeNorm,
    layerProps.textColor,
    layerProps.textFillColor,
    layerProps.textFontId,
    layerProps.textFontSizeNorm,
    layerProps.textVisualStyle,
    mode,
    paintWidthPx,
    patchWhiteboardSessionDomCommand,
    setWbSessionSelected,
    wbSessionSelectedIds,
    whiteboardInkDelegated,
    whiteboardSessionDoc,
  ])

  const activePageOrientation = lessonBoardPageNav.page?.orientation ?? 'standard'
  const slotDragEnabled = layoutMode === 'slot' && activePageOrientation !== 'wide'
  const floatDragEnabled = layoutMode === 'floating' && activePageOrientation !== 'wide'
  const handlePrevLessonBoardPage = useCallback(() => {
    whiteboardSessionStoreRef?.current?.goToAdjacentLessonBoardPage(-1)
  }, [whiteboardSessionStoreRef])

  const handleNextLessonBoardPage = useCallback(() => {
    whiteboardSessionStoreRef?.current?.goToAdjacentLessonBoardPage(1)
  }, [whiteboardSessionStoreRef])

  const viewportInk: WhiteboardViewportInkConfig | undefined = useMemo(() => {
    if (!whiteboardSessionActive) return undefined
    return buildWhiteboardViewportInkConfig(
      effectivePaintContentHeightPx,
      canvasViewportHeightPx,
      scrollTopPx,
    )
  }, [
    canvasViewportHeightPx,
    effectivePaintContentHeightPx,
    scrollTopPx,
    whiteboardSessionActive,
  ])

  /** Session ink stack (spread overlay + session layer) — always on for lesson board pages. */
  const useLessonBoardSessionInk = whiteboardSessionActive && viewportInk != null
  const boardScrollable =
    viewportInk != null && isWhiteboardViewportInkActive(viewportInk)
  const wideFixedCanvas = activePageOrientation === 'wide'

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
    el.scrollTop = 0
    setScrollTopPx(0)
  }, [lessonBoardActivePageId])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      setScrollTopPx(el.scrollTop)
      const scrollable = el.scrollHeight > el.clientHeight + 1
      if (
        onExtendRunway &&
        lessonBoardAllowsRunwayGrowth(activePageOrientation) &&
        scrollable &&
        el.scrollTop + el.clientHeight >= el.scrollHeight - canvasViewportHeightPx * 0.12
      ) {
        onExtendRunway()
      }
    }
    onScroll()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [activePageOrientation, canvasViewportHeightPx, lessonBoardActivePageId, onExtendRunway])

  return (
    <div
      ref={panelRef}
      className={cn(
        'group relative z-10 flex shrink-0 flex-col',
        WHITEBOARD_PANEL_CHROME,
        'isolate',
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
        deferChromeActions={deferHeaderChromeActions}
        layoutMode={layoutMode}
        onFloat={onFloat}
        onDock={onDock}
        swapSlotSide={() => moveTo(slotSide === 'left' ? 'right' : 'left')}
        onMinimize={onMinimize}
        slotDragEnabled={slotDragEnabled}
        floatDragEnabled={floatDragEnabled}
        onSlotDragPointerDown={onSlotDragPointerDown}
        onSlotDragPointerMove={onSlotDragPointerMove}
        onSlotDragPointerUp={onSlotDragPointerUp}
        onSlotDragPointerCancel={onSlotDragPointerCancel}
        onFloatDragPointerDown={onFloatDragPointerDown}
        onFloatDragPointerMove={onFloatDragPointerMove}
        onFloatDragPointerUp={onFloatDragPointerUp}
        onFloatDragPointerCancel={onFloatDragPointerCancel}
        lessonBoardPageIndex={lessonBoardPageNav.index}
        lessonBoardPageCount={lessonBoardPageNav.total}
        onNewLessonBoardPage={whiteboardSessionActive ? onNewLessonBoardPage : undefined}
        onPrevLessonBoardPage={whiteboardSessionActive ? handlePrevLessonBoardPage : undefined}
        onNextLessonBoardPage={whiteboardSessionActive ? handleNextLessonBoardPage : undefined}
      />

      <div
        ref={(node) => {
          scrollRef.current = node
          captureRootRef.current = node
        }}
        className={cn(
          'relative z-0 min-h-0 flex-1 overflow-x-hidden',
          wideFixedCanvas || !boardScrollable ? 'overflow-y-hidden' : SCROLLBAR_HIDDEN,
        )}
        style={{
          height: canvasViewportHeightPx,
          backgroundColor: surfaceStyle.backgroundColor,
        }}
      >
        <div
          ref={wbContentCaptureRef}
          className="relative"
          style={{
            width: paintWidthPx,
            minHeight: paintContentHeightPx,
            height: paintContentHeightPx,
            ...surfaceStyle,
          }}
          data-lesson-board-orientation={activePageOrientation}
        >
          {useLessonBoardSessionInk && whiteboardSessionDoc ? (
            <div
              ref={wbInkLayerRef}
              className={cn(
                'absolute inset-0',
                mode === 'select' || wbDomToolsActive ? 'z-[40]' : 'z-[25]',
                wbStrokeCaptureEnabled
                  ? 'touch-none pointer-events-auto'
                  : mode === 'select' || wbDomToolsActive
                    ? 'pointer-events-auto'
                    : 'pointer-events-none',
              )}
              style={{
                touchAction: wbStrokeCaptureEnabled ? 'none' : undefined,
              }}
            >
              <BookSpreadSessionLayer
                widthPx={paintWidthPx}
                heightPx={effectivePaintContentHeightPx}
                commands={whiteboardSessionDoc.commands}
                viewportInk={viewportInk}
                scrollportRef={scrollRef}
                contentCaptureRef={wbContentCaptureRef}
                trailingEraserLineDraft={wbEraserLineDraft}
                trailingMarkerStrokeDraft={wbMarkerStrokeDraft}
                selectEnabled={mode === 'select'}
                selectedIds={wbSessionSelectedIds}
                nudgePreview={wbSessionNudgePreview}
                onSelectedIdsChange={setWbSessionSelected}
                onMoveSelectedBy={moveWbSessionSelected}
                onScaleSelectedBy={scaleWbSessionSelected}
                onRotateSelectedBy={rotateWbSessionSelected}
                domConfig={whiteboardDomConfig}
              />
              <BookSpreadStrokeOverlay
                ref={wbStrokeOverlayRef}
                leftPageCaptureRef={wbInkLayerRef}
                rightPageCaptureRef={wbInkLayerRef}
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
                shapeRoundedCorners={layerProps.shapeRoundedCorners}
                pageNumberLeft={WHITEBOARD_EYEDROPER_PAGE}
                pageNumberRight={WHITEBOARD_EYEDROPER_PAGE}
                annotationTargetPage={WHITEBOARD_EYEDROPER_PAGE}
                setAnnotationTargetPage={() => {}}
                onCapabilitiesChange={onWhiteboardOverlayCaps ?? onCapabilitiesChange}
                captureEnabled={wbStrokeCaptureEnabled}
                spreadOverlayWidthPx={paintWidthPx}
                spreadOverlayHeightPx={effectivePaintContentHeightPx}
                spreadCanvasHeightPx={effectivePaintContentHeightPx}
                whiteboardViewportInk={viewportInk}
                whiteboardScrollportRef={scrollRef}
                whiteboardContentCaptureRef={wbContentCaptureRef}
                spreadPageWidthPx={panelWidthPx}
                leftPenInkPatternOriginXPx={0}
                rightPenInkPatternOriginXPx={0}
                spreadSeamNormX={1}
                spreadSessionMode
                spreadSessionCommands={whiteboardSessionDoc.commands}
                onSpreadSessionAppendCommand={appendWhiteboardSessionCommandWithAutoGroup}
                spreadSessionUndo={whiteboardSessionUndo}
                spreadSessionRedo={whiteboardSessionRedo}
                spreadSessionClear={whiteboardSessionClear}
                onSpreadEraserLineDraftChange={setWbEraserLineDraft}
                onSpreadMarkerStrokeDraftChange={setWbMarkerStrokeDraft}
              />
            </div>
          ) : null}
          <div
            className={
              useLessonBoardSessionInk && whiteboardInkDelegated
                ? 'pointer-events-none absolute inset-0 z-[32]'
                : useLessonBoardSessionInk
                  ? 'absolute inset-0 z-[20]'
                  : 'relative h-full w-full'
            }
          >
            <BookPageAnnotationLayer
              key={lessonBoardActivePageId || 'wb-page-default'}
              ref={wbAnnRef}
              {...layerProps}
              studentId={studentId}
              bookId={bookId}
              unitId={unitId}
              mode={mode}
              shapeColor={shapeColor}
              pageNumber={WHITEBOARD_EYEDROPER_PAGE}
              storageChannel="whiteboard"
              storagePageKey={resolvedPageStorageKey}
              widthPx={paintWidthPx}
              heightPx={effectivePaintContentHeightPx}
              delegatePointerToWhiteboardPen={wbStrokeCaptureEnabled}
              whiteboardInkDelegated={whiteboardInkDelegated}
              whiteboardSessionStoreRef={whiteboardSessionStoreRef}
              onEyedropperPick={onEyedropperPick}
              onCapabilitiesChange={onCapabilitiesChange}
            />
          </div>
        </div>
      </div>
      {layoutMode === 'floating' && floatDragEnabled ? (
        <div
          role="separator"
          aria-label="Resize floating board"
          title="Resize board"
          className={cn(
            'absolute bottom-0 right-0 z-30 h-4 w-4 cursor-nwse-resize touch-none',
            'rounded-br-lg border-b-[3px] border-r-[3px] border-[#D1D5DB]',
          )}
          onPointerDown={onFloatResizePointerDown}
          onPointerMove={onFloatResizePointerMove}
          onPointerUp={onFloatResizePointerUp}
          onPointerCancel={onFloatResizePointerCancel}
        />
      ) : null}
    </div>
  )
}

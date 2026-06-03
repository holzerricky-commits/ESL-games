'use client'

import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import type { ComponentType, CSSProperties, MutableRefObject, RefObject } from 'react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { BookCaptureRegionOverlay } from '@/components/students/book-capture-region-overlay'
import {
  BookPageAnnotationLayer,
  type AnnotationCapabilities,
  type BookPageAnnotationHandle,
  type LiveEraserLineDraft,
} from '@/components/students/book-page-annotation-layer'
import { BookSpreadStrokeOverlay } from '@/components/students/book-spread-stroke-overlay'
import { BookSpreadSessionLayer } from '@/components/students/book-spread-session-layer'
import type { AnnotationLineDashStyle, ShapeFillMode } from '@/lib/books/annotation-command-types'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import { Button } from '@/components/ui/button'
import type { BookReaderDocumentReadyMeta } from '@/components/students/fullscreen-book-overlay/types'
import { useReaderPrefetchCacheRevision } from '@/components/students/fullscreen-book-overlay/hooks/useReaderPrefetchCacheRevision'
import { ReaderPageSlot } from '@/components/students/fullscreen-book-overlay/sections/ReaderPageSlot'
import { SpreadStage } from '@/components/students/fullscreen-book-overlay/sections/SpreadStage'
import type { SpreadTurnSlidePayload } from '@/components/students/fullscreen-book-overlay/hooks/useSpreadTurnSlide'
import type { PageViewPoolRenderContext } from '@/components/students/fullscreen-book-overlay/sections/PageViewPool'
import { preloadAllEffectPenResources } from '@/lib/books/effect-pen-preload'
import { DEFAULT_TEXT_FILL_COLOR } from '@/lib/books/annotation-palettes'
import { spreadSidePullPx } from '@/lib/books/spread-gutter'
import { SpreadPageCluster } from '@/components/books/spread-page-cluster'
import { seamClientX } from '@/lib/books/spread-stroke-split'
import { loadCachedPdfDocument } from '@/lib/books/pdf-thumbnail-cache'
import { spreadSessionEditingEnabled, pageViewPoolEnabled } from '@/lib/books/feature-flags'
import type { UnitPageBounds } from '@/lib/books/page-range'
import { createSpreadSessionStore } from '@/lib/books/spread-session-store'
import type { SpreadSessionDocument } from '@/lib/books/spread-session-types'
import { hydrateSpreadSessionFromOwnerPages } from '@/lib/books/spread-session-commit'
import { getAnnotationsForPage } from '@/lib/books/annotation-storage'
import { SPREAD_SESSION_FLUSH_EVENT } from '@/lib/books/spread-session-events'
import { INK_SESSION_AUTOSAVE_MS } from '@/lib/books/ink-session-persist-config'
import { flushSpreadSessionDocumentToPageStorage } from '@/lib/books/spread-session-persist'
import type { SpreadInkLayout } from '@/lib/books/spread-stroke-split'
import { useSpreadSessionPersistGuards } from '@/components/students/fullscreen-book-overlay/hooks/useSpreadSessionPersistGuards'
import { isBookOverlayKeyboardTypingTarget } from '@/lib/books/book-overlay-keyboard-guards'
import { cn } from '@/lib/utils'
import { InfiniteWhiteboardPanel } from '@/components/students/fullscreen-book-overlay/sections/InfiniteWhiteboardPanel'
import { WhiteboardCollapsedTab } from '@/components/students/fullscreen-book-overlay/sections/WhiteboardCollapsedTab'
import { WHITEBOARD_EYEDROPER_PAGE } from '@/lib/books/whiteboard-storage'
import { WHITEBOARD_SLOT_INSET_PX } from '@/components/students/fullscreen-book-overlay/constants'
import type { WhiteboardSlotMotionApi } from '@/components/students/fullscreen-book-overlay/hooks/useWhiteboardSlotMotion'
import type { WhiteboardLayoutMode, WhiteboardSlotSide } from '@/components/students/fullscreen-book-overlay/hooks/useWhiteboardPlacement'

interface BookCanvasStageProps {
  pageAreaRef: MutableRefObject<HTMLDivElement | null>
  hasCurriculumOrHistory: boolean
  studentId: string
  loading: boolean
  error: string | null
  hasResolvedUnit: boolean
  pdfReady: boolean
  spreadDisplayScale: number
  ANIMATION_MS: number
  PdfPage: ComponentType<any>
  selectedUnitFilePath: string
  makeUnitFileUrl: (filePath: string) => string
  onDocumentLoadSuccess: (doc: BookReaderDocumentReadyMeta) => void
  isWhiteboardOpen: boolean
  isWhiteboardMinimized: boolean
  onExpandWhiteboard: () => void
  onMinimizeWhiteboard: () => void
  whiteboardPanelAnchorRef: RefObject<HTMLDivElement | null>
  whiteboardPanelObscured: boolean
  suppressChrome: boolean
  swapWhiteboardSlotSide: () => void
  toggleWhiteboardFullscreen: () => void
  setWhiteboardSlotSide: (side: WhiteboardSlotSide) => void
  applyWhiteboardSlotSide: (side: WhiteboardSlotSide) => void
  registerWhiteboardSlotMotion: (api: WhiteboardSlotMotionApi | null) => void
  isSinglePageMode: boolean
  leftPageCaptureRef: MutableRefObject<HTMLDivElement | null>
  pageNumber: number
  spreadPageWidth: number
  /** Resolved spread seam overlap (file override → book default → 0.018). */
  spreadGutterPullRatio: number
  onPdfPageLoadSuccess: (page: { originalWidth?: number; originalHeight?: number; width: number; height: number }) => void
  selectedBookId: string | null
  selectedUnitId?: string
  pageCanvasHeightPx: number
  annotationMode: any
  eyedropperVariant?: import('@/lib/books/eyedropper-variant').EyedropperVariant
  stampVariant: any
  stampQuestionColor: string
  strokeWidthScale: number
  eraserLineStrokeWidthScale: number
  penStrokeWidthScale: number
  shapeStrokeWidthScale: number
  stampScale: number
  strokeColor: string | undefined
  penInkColor: string
  penInkStyle?: import('@/lib/books/pen-ink').PenInkStyle
  penStrokeProfile?: import('@/lib/books/pen-stroke-profile').PenStrokeProfile
  shapeColor: string | undefined
  textColor: string | undefined
  stickyFillColor?: string
  strokeLineDashStyle?: AnnotationLineDashStyle
  markerStraightStroke?: boolean
  markerDecoratedEdge?: boolean
  penAutoGroupConnected?: boolean
  marqueeSelectRule?: import('@/lib/books/annotation-select').MarqueeSelectRule
  shapeLineDashStyle?: AnnotationLineDashStyle
  shapeStrokeEnabled?: boolean
  shapeFillMode?: ShapeFillMode
  shapeFillColor?: string
  textFontSizeNorm: number
  textVisualStyle?: 'plain' | 'filled'
  textFillColor?: string
  stickyFontSizeNorm: number
  annotationTargetPage: number
  setAnnotationTargetPage: (page: number) => void
  onLeftAnnotationCaps: (caps: AnnotationCapabilities) => void
  leftAnnRef: MutableRefObject<BookPageAnnotationHandle | null>
  showSpreadRightPage: boolean
  rightPageCaptureRef: MutableRefObject<HTMLDivElement | null>
  spreadRightPage: number | null
  onRightAnnotationCaps: (caps: AnnotationCapabilities) => void
  rightAnnRef: MutableRefObject<BookPageAnnotationHandle | null>
  wbCaptureRootRef: MutableRefObject<HTMLDivElement | null>
  WHITEBOARD_NOTEBOOK_SURFACE: Pick<CSSProperties, 'backgroundColor' | 'backgroundImage' | 'backgroundSize'>
  whiteboardStorageKey: string | null
  whiteboardLayoutMode: WhiteboardLayoutMode
  whiteboardSlotSide: WhiteboardSlotSide
  whiteboardContentHeightPx: number
  extendWhiteboardRunway: () => void
  wbAnnRef: MutableRefObject<BookPageAnnotationHandle | null>
  onWhiteboardCaps: (caps: AnnotationCapabilities) => void
  regionSelectOpen: boolean
  setRegionSelectOpen: (v: boolean) => void
  runImageCapture: (args: {
    kind: 'full' | 'page' | 'region'
    regionCss?: DOMRect | Pick<DOMRect, 'x' | 'y' | 'width' | 'height'>
  }) => Promise<void>
  pdfExporting: boolean
  pdfProgressLabel: string | null
  numPages: number | null
  /** Sorted visible PDF indices for reader prefetch / page view pool. */
  visiblePages: number[]
  /** Inclusive reader bounds for pool window clamping. */
  readerBounds: UnitPageBounds
  /** Phase 3: spinner over spread until drawable-ready (cache + layout or slot pixels). */
  showSpreadLoadingHold: boolean
  /** Resets slot pixel reporting when open / unit / width bucket / page changes. */
  spreadReportEpoch: number
  /** All visible spread slots reported pixel-ready for the current anchor. */
  onSpreadSlotsPixelsReady?: () => void
  /** When false, slots warm silently and only confirm pixels after the overlay is presented. */
  confirmSpreadSlotPixels?: boolean
  spreadStrokeOverlayRef: MutableRefObject<BookPageAnnotationHandle | null>
  onSpreadOverlayCaps: (caps: AnnotationCapabilities) => void
  spreadStrokeCaptureEnabled: boolean
  onEyedropperPick?: (
    pageNumber: number,
    clientX: number,
    clientY: number,
  ) => void
  spreadTurnGridRef?: MutableRefObject<HTMLDivElement | null>
  turnSlide?: SpreadTurnSlidePayload | null
  onTurnSlideComplete?: () => void
  spreadSessionStoreRef?: MutableRefObject<ReturnType<typeof createSpreadSessionStore> | null>
  wbStrokeOverlayRef?: MutableRefObject<BookPageAnnotationHandle | null>
  whiteboardStrokeCaptureEnabled?: boolean
  whiteboardSessionStoreRef?: MutableRefObject<import('@/lib/books/whiteboard-session-store').WhiteboardSessionStore | null>
  whiteboardSessionDoc?: import('@/lib/books/whiteboard-session-types').WhiteboardSessionDocument | null
  appendWhiteboardSessionCommand?: (cmd: import('@/lib/books/annotation-command-types').AnnotationCommand) => void
  whiteboardSessionUndo?: () => boolean
  whiteboardSessionRedo?: () => boolean
  whiteboardSessionClear?: () => void
  onWhiteboardOverlayCaps?: (caps: AnnotationCapabilities) => void
}

export function BookCanvasStage({
  pageAreaRef,
  hasCurriculumOrHistory,
  studentId,
  loading,
  error,
  hasResolvedUnit,
  pdfReady,
  spreadDisplayScale,
  ANIMATION_MS,
  PdfPage,
  selectedUnitFilePath,
  makeUnitFileUrl,
  onDocumentLoadSuccess,
  isWhiteboardOpen,
  isWhiteboardMinimized,
  onExpandWhiteboard,
  onMinimizeWhiteboard,
  whiteboardPanelAnchorRef,
  whiteboardPanelObscured,
  suppressChrome,
  swapWhiteboardSlotSide,
  toggleWhiteboardFullscreen,
  setWhiteboardSlotSide,
  applyWhiteboardSlotSide,
  registerWhiteboardSlotMotion,
  isSinglePageMode,
  leftPageCaptureRef,
  pageNumber,
  spreadPageWidth,
  spreadGutterPullRatio,
  onPdfPageLoadSuccess,
  selectedBookId,
  selectedUnitId,
  pageCanvasHeightPx,
  annotationMode,
  eyedropperVariant = 'sample',
  stampVariant,
  stampQuestionColor,
  strokeWidthScale,
  eraserLineStrokeWidthScale,
  penStrokeWidthScale,
  shapeStrokeWidthScale,
  stampScale,
  strokeColor,
  penInkColor,
  penInkStyle,
  penStrokeProfile,
  shapeColor,
  textColor,
  stickyFillColor = '#fef3c7',
  strokeLineDashStyle = 'solid',
  markerStraightStroke = false,
  markerDecoratedEdge = false,
  penAutoGroupConnected = true,
  marqueeSelectRule = 'follow-drag',
  shapeLineDashStyle = 'solid',
  shapeStrokeEnabled = true,
  shapeFillMode = 'none',
  shapeFillColor = '#eab308',
  textFontSizeNorm,
  textVisualStyle = 'plain',
  textFillColor = DEFAULT_TEXT_FILL_COLOR,
  stickyFontSizeNorm,
  annotationTargetPage,
  setAnnotationTargetPage,
  onLeftAnnotationCaps,
  leftAnnRef,
  showSpreadRightPage,
  rightPageCaptureRef,
  spreadRightPage,
  onRightAnnotationCaps,
  rightAnnRef,
  wbCaptureRootRef,
  WHITEBOARD_NOTEBOOK_SURFACE,
  whiteboardStorageKey,
  whiteboardLayoutMode,
  whiteboardSlotSide,
  whiteboardContentHeightPx,
  extendWhiteboardRunway,
  wbAnnRef,
  onWhiteboardCaps,
  regionSelectOpen,
  setRegionSelectOpen,
  runImageCapture,
  pdfExporting,
  pdfProgressLabel,
  numPages,
  visiblePages,
  readerBounds,
  showSpreadLoadingHold,
  spreadReportEpoch,
  onSpreadSlotsPixelsReady,
  confirmSpreadSlotPixels = true,
  spreadStrokeOverlayRef,
  onSpreadOverlayCaps,
  spreadStrokeCaptureEnabled,
  onEyedropperPick,
  spreadTurnGridRef,
  turnSlide = null,
  onTurnSlideComplete,
  spreadSessionStoreRef: spreadSessionStoreRefProp,
  wbStrokeOverlayRef,
  whiteboardStrokeCaptureEnabled = false,
  whiteboardSessionStoreRef,
  whiteboardSessionDoc = null,
  appendWhiteboardSessionCommand,
  whiteboardSessionUndo,
  whiteboardSessionRedo,
  whiteboardSessionClear,
  onWhiteboardOverlayCaps,
}: BookCanvasStageProps) {
  const spreadSessionModeEnabled = spreadSessionEditingEnabled
  const shapeColorResolved = shapeColor ?? '#111827'

  const eyedropperForPage = useCallback(
    (targetPage: number) =>
      onEyedropperPick
        ? (clientX: number, clientY: number) => onEyedropperPick(targetPage, clientX, clientY)
        : undefined,
    [onEyedropperPick],
  )

  const textColorResolved = textColor ?? '#111827'
  const prefetchRevision = useReaderPrefetchCacheRevision()
  /** Phase 3 — see `lib/books/spread-drawable-ready.ts`. */
  const leftSlotPixelsReadyRef = useRef(false)
  const rightSlotPixelsReadyRef = useRef(false)
  const spreadSlotsReportedRef = useRef(false)
  const [spreadSlotsPixelsReady, setSpreadSlotsPixelsReady] = useState(false)

  const tryReportSpreadSlotsPixelsReady = useCallback(() => {
    if (spreadSlotsReportedRef.current) return
    if (isSinglePageMode) {
      if (!leftSlotPixelsReadyRef.current) return
      spreadSlotsReportedRef.current = true
      setSpreadSlotsPixelsReady(true)
      onSpreadSlotsPixelsReady?.()
      return
    }
    if (!showSpreadRightPage || spreadRightPage == null) {
      if (!leftSlotPixelsReadyRef.current) return
      spreadSlotsReportedRef.current = true
      setSpreadSlotsPixelsReady(true)
      onSpreadSlotsPixelsReady?.()
      return
    }
    if (leftSlotPixelsReadyRef.current && rightSlotPixelsReadyRef.current) {
      spreadSlotsReportedRef.current = true
      setSpreadSlotsPixelsReady(true)
      onSpreadSlotsPixelsReady?.()
    }
  }, [isSinglePageMode, showSpreadRightPage, spreadRightPage, onSpreadSlotsPixelsReady])

  const handleLeftSlotPixelsReady = useCallback(() => {
    leftSlotPixelsReadyRef.current = true
    tryReportSpreadSlotsPixelsReady()
  }, [tryReportSpreadSlotsPixelsReady])

  const handleRightSlotPixelsReady = useCallback(() => {
    rightSlotPixelsReadyRef.current = true
    tryReportSpreadSlotsPixelsReady()
  }, [tryReportSpreadSlotsPixelsReady])

  useEffect(() => {
    leftSlotPixelsReadyRef.current = false
    rightSlotPixelsReadyRef.current = false
    spreadSlotsReportedRef.current = false
    setSpreadSlotsPixelsReady(false)
  }, [spreadReportEpoch, isSinglePageMode, pageNumber, spreadRightPage])

  const useStablePageViewPool = pageViewPoolEnabled && selectedUnitId != null

  const handlePoolSlotPixelsReady = useCallback(
    (_readyPage: number, side: 'left' | 'right' | 'single') => {
      if (side === 'left' || side === 'single') {
        leftSlotPixelsReadyRef.current = true
      } else {
        rightSlotPixelsReadyRef.current = true
      }
      tryReportSpreadSlotsPixelsReady()
    },
    [tryReportSpreadSlotsPixelsReady],
  )

  /** Spread pages overlap slightly at the seam (pen-ink cluster width). */
  const gutterPullPx = spreadSidePullPx(spreadPageWidth, spreadGutterPullRatio)
  /** Two pages minus one overlap — must match spread grid width. */
  const spreadOverlayWidthPx = Math.max(0, Math.round(spreadPageWidth * 2 - gutterPullPx))
  const spreadOverlayHeightPx = pageCanvasHeightPx

  const whiteboardSessionOpen = isWhiteboardOpen && whiteboardStorageKey != null
  const whiteboardActive = whiteboardSessionOpen && !isWhiteboardMinimized
  const whiteboardMinimizedVisible = whiteboardSessionOpen && isWhiteboardMinimized
  const whiteboardInSlot = whiteboardActive && whiteboardLayoutMode === 'slot'
  const boardOnLeft = whiteboardSlotSide === 'left'
  const whiteboardSlotPanelWidthPx = Math.max(1, spreadPageWidth - WHITEBOARD_SLOT_INSET_PX * 2)
  const whiteboardSlotPanelHeightPx = Math.max(1, pageCanvasHeightPx - WHITEBOARD_SLOT_INSET_PX * 2)

  const renderWhiteboardPanel = () => {
    if (!whiteboardStorageKey || !selectedBookId || !selectedUnitId) return null
    const panelWidthPx =
      whiteboardLayoutMode === 'slot' ? whiteboardSlotPanelWidthPx : spreadPageWidth
    const panelViewportHeightPx =
      whiteboardLayoutMode === 'slot' ? whiteboardSlotPanelHeightPx : pageCanvasHeightPx
    return (
      <InfiniteWhiteboardPanel
        key="lesson-session-whiteboard"
        studentId={studentId}
        bookId={selectedBookId}
        unitId={selectedUnitId}
        widthPx={panelWidthPx}
        viewportHeightPx={panelViewportHeightPx}
        contentHeightPx={whiteboardContentHeightPx}
        storagePageKey={whiteboardStorageKey}
        surfaceStyle={WHITEBOARD_NOTEBOOK_SURFACE}
        layoutMode={whiteboardLayoutMode}
        slotSide={whiteboardSlotSide}
        fullscreenWidthPx={spreadOverlayWidthPx}
        wbAnnRef={wbAnnRef}
        wbStrokeOverlayRef={wbStrokeOverlayRef}
        whiteboardSessionStoreRef={whiteboardSessionStoreRef}
        whiteboardSessionDoc={whiteboardSessionDoc}
        appendWhiteboardSessionCommand={appendWhiteboardSessionCommand}
        whiteboardSessionUndo={whiteboardSessionUndo}
        whiteboardSessionRedo={whiteboardSessionRedo}
        whiteboardSessionClear={whiteboardSessionClear}
        wbStrokeCaptureEnabled={whiteboardStrokeCaptureEnabled}
        onWhiteboardOverlayCaps={onWhiteboardOverlayCaps}
        captureRootRef={wbCaptureRootRef}
        onCapabilitiesChange={onWhiteboardCaps}
        onExtendRunway={extendWhiteboardRunway}
        setSlotSide={applyWhiteboardSlotSide}
        slotTravelPx={Math.max(0, Math.round(spreadPageWidth - gutterPullPx))}
        registerSlotMotion={registerWhiteboardSlotMotion}
        toggleFullscreen={toggleWhiteboardFullscreen}
        onMinimize={onMinimizeWhiteboard}
        suppressChrome={suppressChrome}
        mode={annotationMode}
        eyedropperVariant={eyedropperVariant}
        stampVariant={stampVariant}
        stampQuestionColor={stampQuestionColor}
        strokeWidthScale={strokeWidthScale}
        eraserLineStrokeWidthScale={eraserLineStrokeWidthScale}
        penStrokeWidthScale={penStrokeWidthScale}
        shapeStrokeWidthScale={shapeStrokeWidthScale}
        stampScale={stampScale}
        strokeColor={strokeColor}
        penInkColor={penInkColor}
        penInkStyle={penInkStyle}
        penStrokeProfile={penStrokeProfile}
        strokeLineDashStyle={strokeLineDashStyle}
        markerStraightStroke={markerStraightStroke}
        markerDecoratedEdge={markerDecoratedEdge}
        penAutoGroupConnected={penAutoGroupConnected}
        marqueeSelectRule={marqueeSelectRule}
        shapeColor={shapeColorResolved}
        textColor={textColorResolved}
        shapeLineDashStyle={shapeLineDashStyle}
        shapeStrokeEnabled={shapeStrokeEnabled}
        shapeFillMode={shapeFillMode}
        shapeFillColor={shapeFillColor}
        textFontSizeNorm={textFontSizeNorm}
        textVisualStyle={textVisualStyle}
        textFillColor={textFillColor}
        stickyFillColor={stickyFillColor}
        stickyFontSizeNorm={stickyFontSizeNorm}
        defaultStickyWNorm={0.22}
        defaultStickyHNorm={0.11}
        onEyedropperPick={(clientX, clientY) =>
          onEyedropperPick?.(WHITEBOARD_EYEDROPER_PAGE, clientX, clientY)
        }
      />
    )
  }

  const boardSlotLeftPx = boardOnLeft ? 0 : Math.max(0, Math.round(spreadPageWidth - gutterPullPx))

  const localSpreadGridRef = useRef<HTMLDivElement | null>(null)
  const spreadGridRef = spreadTurnGridRef ?? localSpreadGridRef
  const [leftPenInkPatternOriginXPx, setLeftPenInkPatternOriginXPx] = useState(0)
  const [rightPenInkPatternOriginXPx, setRightPenInkPatternOriginXPx] = useState(0)
  const [spreadSeamNormX, setSpreadSeamNormX] = useState(0.5)
  const localSpreadSessionStoreRef = useRef<ReturnType<typeof createSpreadSessionStore> | null>(null)
  const spreadSessionStoreRef = spreadSessionStoreRefProp ?? localSpreadSessionStoreRef
  const [spreadEraserLineDraft, setSpreadEraserLineDraft] = useState<LiveEraserLineDraft | null>(null)
  const [spreadSessionDoc, setSpreadSessionDoc] = useState<SpreadSessionDocument | null>(null)
  const spreadSessionDocRef = useRef<SpreadSessionDocument | null>(null)
  const [spreadSessionSelectedIds, setSpreadSessionSelectedIds] = useState<string[]>([])
  const spreadSessionKeyRef = useRef<{ leftPage: number; rightPage: number } | null>(null)
  const spreadInkLayoutRef = useRef<SpreadInkLayout>({
    spreadOverlayWidthPx: 0,
    spreadPageWidthPx: 0,
    leftPageOriginXPx: 0,
    rightPageOriginXPx: 0,
    seamNormX: 0.5,
  })
  spreadInkLayoutRef.current = {
    spreadOverlayWidthPx,
    spreadPageWidthPx: spreadPageWidth,
    leftPageOriginXPx: leftPenInkPatternOriginXPx,
    rightPageOriginXPx: rightPenInkPatternOriginXPx,
    seamNormX: spreadSeamNormX,
  }

  const spreadSessionActive = useMemo(
    () =>
      Boolean(
        spreadSessionModeEnabled &&
          !isSinglePageMode &&
          selectedBookId &&
          selectedUnitId &&
          spreadRightPage != null,
      ),
    [isSinglePageMode, selectedBookId, selectedUnitId, spreadRightPage, spreadSessionModeEnabled],
  )

  const measurePenInkPatternOrigins = useCallback(() => {
    const spread = spreadGridRef.current?.getBoundingClientRect()
    const left = leftPageCaptureRef.current?.getBoundingClientRect()
    const right = rightPageCaptureRef.current?.getBoundingClientRect()
    if (!spread || !(spreadOverlayWidthPx > 0)) return
    const scale = spreadDisplayScale > 0 ? spreadDisplayScale : 1
    if (left) setLeftPenInkPatternOriginXPx((left.left - spread.left) / scale)
    if (right) setRightPenInkPatternOriginXPx((right.left - spread.left) / scale)
    if (left && right) {
      const seamClient = seamClientX(left, right)
      setSpreadSeamNormX((seamClient - spread.left) / scale / spreadOverlayWidthPx)
    }
  }, [leftPageCaptureRef, rightPageCaptureRef, spreadDisplayScale, spreadOverlayWidthPx])

  useLayoutEffect(() => {
    if (isSinglePageMode) {
      setLeftPenInkPatternOriginXPx(0)
      setRightPenInkPatternOriginXPx(0)
      setSpreadSeamNormX(0.5)
      return
    }
    measurePenInkPatternOrigins()
    const grid = spreadGridRef.current
    if (!grid) return
    const ro = new ResizeObserver(() => measurePenInkPatternOrigins())
    ro.observe(grid)
    window.addEventListener('resize', measurePenInkPatternOrigins)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measurePenInkPatternOrigins)
    }
  }, [
    isSinglePageMode,
    measurePenInkPatternOrigins,
    spreadPageWidth,
    pageCanvasHeightPx,
    spreadDisplayScale,
    showSpreadRightPage,
    spreadRightPage,
    pageNumber,
  ])

  const flushSpreadSessionToPageStorage = useCallback(
    (overridePages?: { leftPage: number; rightPage: number }) => {
      const store = spreadSessionStoreRef.current
      const doc = spreadSessionDocRef.current
      const pages =
        overridePages ??
        spreadSessionKeyRef.current ??
        (spreadRightPage != null ? { leftPage: pageNumber, rightPage: spreadRightPage } : null)
      if (!doc || !selectedBookId || !selectedUnitId || !pages) return
      flushSpreadSessionDocumentToPageStorage({
        doc,
        key: pages,
        layout: spreadInkLayoutRef.current,
        studentId,
        bookId: selectedBookId,
        unitId: selectedUnitId,
      })
      store?.markClean()
      store?.checkpointNow()
    },
    [pageNumber, selectedBookId, selectedUnitId, spreadRightPage, studentId],
  )

  const checkpointSpreadSession = useCallback(() => {
    spreadSessionStoreRef.current?.checkpointNow()
  }, [])

  useEffect(() => {
    const onFlush = () => flushSpreadSessionToPageStorage()
    window.addEventListener(SPREAD_SESSION_FLUSH_EVENT, onFlush)
    return () => window.removeEventListener(SPREAD_SESSION_FLUSH_EVENT, onFlush)
  }, [flushSpreadSessionToPageStorage])

  useSpreadSessionPersistGuards({
    enabled: spreadSessionActive,
    checkpointSpreadSession,
    flushSpreadSessionToPages: flushSpreadSessionToPageStorage,
  })

  useEffect(() => {
    if (!spreadSessionActive || !selectedBookId || !selectedUnitId || spreadRightPage == null) {
      setSpreadSessionDoc(null)
      spreadSessionDocRef.current = null
      setSpreadSessionSelectedIds([])
      spreadSessionKeyRef.current = null
      return
    }

    const store = createSpreadSessionStore(
      {
        studentId,
        bookId: selectedBookId,
        unitId: selectedUnitId,
        leftPage: pageNumber,
        rightPage: spreadRightPage,
      },
      { autosaveMs: INK_SESSION_AUTOSAVE_MS },
    )
    spreadSessionStoreRef.current = store
    spreadSessionKeyRef.current = { leftPage: pageNumber, rightPage: spreadRightPage }

    const layout = spreadInkLayoutRef.current
    const initialCommands = store.getState().doc.commands
    let commands = initialCommands
    if (initialCommands.length === 0) {
      const leftStored = getAnnotationsForPage(studentId, selectedBookId, selectedUnitId, pageNumber, 'pdf')
      const rightStored = getAnnotationsForPage(
        studentId,
        selectedBookId,
        selectedUnitId,
        spreadRightPage,
        'pdf',
      )
      commands = hydrateSpreadSessionFromOwnerPages(leftStored, rightStored, layout)
    }
    store.syncCommands(commands)
    store.markClean()
    store.checkpointNow()
    const initialState = store.getState()
    setSpreadSessionDoc(initialState.doc)
    spreadSessionDocRef.current = initialState.doc
    setSpreadSessionSelectedIds(initialState.selectedIds)
    const unsub = store.subscribe((state) => {
      setSpreadSessionDoc(state.doc)
      spreadSessionDocRef.current = state.doc
      setSpreadSessionSelectedIds(state.selectedIds)
      onSpreadOverlayCaps({
        canUndo: state.canUndo,
        canRedo: state.canRedo,
      })
    })
    return () => {
      unsub()
      const doc = spreadSessionDocRef.current
      const pages = spreadSessionKeyRef.current
      if (doc && pages) {
        store.checkpointNow()
        flushSpreadSessionDocumentToPageStorage({
          doc,
          key: pages,
          layout: spreadInkLayoutRef.current,
          studentId,
          bookId: selectedBookId,
          unitId: selectedUnitId,
        })
      }
      store.destroy()
      if (spreadSessionStoreRef.current === store) spreadSessionStoreRef.current = null
      spreadSessionDocRef.current = null
      spreadSessionKeyRef.current = null
      setSpreadEraserLineDraft(null)
    }
  }, [
    onSpreadOverlayCaps,
    pageNumber,
    selectedBookId,
    selectedUnitId,
    spreadRightPage,
    spreadSessionActive,
    spreadSessionStoreRef,
    studentId,
  ])

  const appendSpreadSessionCommand = useCallback((cmd: AnnotationCommand) => {
    spreadSessionStoreRef.current?.appendCommand(cmd)
  }, [])

  const spreadSessionUndo = useCallback(() => spreadSessionStoreRef.current?.undo() ?? false, [])

  const spreadSessionRedo = useCallback(() => spreadSessionStoreRef.current?.redo() ?? false, [])

  const spreadSessionClear = useCallback(() => {
    spreadSessionStoreRef.current?.clearCommands()
  }, [])

  const spreadInkDelegated =
    spreadSessionModeEnabled &&
    !isSinglePageMode &&
    !whiteboardActive &&
    spreadRightPage != null &&
    selectedBookId != null &&
    selectedUnitId != null

  const setSpreadSessionSelected = useCallback((ids: string[]) => {
    if (!spreadSessionModeEnabled) return
    spreadSessionStoreRef.current?.setSelectedIds(ids)
  }, [spreadSessionModeEnabled])

  const moveSpreadSessionSelected = useCallback((dx: number, dy: number) => {
    if (!spreadSessionModeEnabled) return
    spreadSessionStoreRef.current?.moveSelectedBy(dx, dy)
  }, [spreadSessionModeEnabled])

  const mirrorLeftSelectionMoveToRight = useCallback((ids: string[], dx: number, dy: number) => {
    if (spreadSessionModeEnabled && spreadSessionStoreRef.current) {
      spreadSessionStoreRef.current.setSelectedIds(ids)
      spreadSessionStoreRef.current.moveSelectedBy(dx, dy)
    }
    rightAnnRef.current?.translateByIds?.(ids, dx, dy)
  }, [rightAnnRef])

  const mirrorRightSelectionMoveToLeft = useCallback((ids: string[], dx: number, dy: number) => {
    if (spreadSessionModeEnabled && spreadSessionStoreRef.current) {
      spreadSessionStoreRef.current.setSelectedIds(ids)
      spreadSessionStoreRef.current.moveSelectedBy(dx, dy)
    }
    leftAnnRef.current?.translateByIds?.(ids, dx, dy)
  }, [leftAnnRef])

  const renderPoolPageChrome = useCallback(
    ({ pageNumber: poolPage, slotRole }: PageViewPoolRenderContext) => {
      if (!selectedBookId || !selectedUnitId) return null
      const isLeft = slotRole === 'left' || slotRole === 'single'
      const isRight = slotRole === 'right'
      return (
        <BookPageAnnotationLayer
          ref={isLeft ? leftAnnRef : isRight ? rightAnnRef : undefined}
          studentId={studentId}
          bookId={selectedBookId}
          unitId={selectedUnitId}
          pageNumber={poolPage}
          widthPx={spreadPageWidth}
          heightPx={pageCanvasHeightPx}
          mode={annotationMode}
          eyedropperVariant={eyedropperVariant}
          stampVariant={stampVariant}
          stampQuestionColor={stampQuestionColor}
          strokeWidthScale={strokeWidthScale}
          eraserLineStrokeWidthScale={eraserLineStrokeWidthScale}
          penStrokeWidthScale={penStrokeWidthScale}
          shapeStrokeWidthScale={shapeStrokeWidthScale}
          stampScale={stampScale}
          strokeColor={strokeColor}
          penInkColor={penInkColor}
          penInkStyle={penInkStyle}
          penStrokeProfile={penStrokeProfile}
          penInkPatternOriginXPx={isLeft ? leftPenInkPatternOriginXPx : isRight ? rightPenInkPatternOriginXPx : 0}
          strokeLineDashStyle={strokeLineDashStyle}
          markerStraightStroke={markerStraightStroke}
          markerDecoratedEdge={markerDecoratedEdge}
          penAutoGroupConnected={penAutoGroupConnected}
          marqueeSelectRule={marqueeSelectRule}
          shapeColor={shapeColorResolved}
          textColor={textColorResolved}
          shapeLineDashStyle={shapeLineDashStyle}
          shapeStrokeEnabled={shapeStrokeEnabled}
          shapeFillMode={shapeFillMode}
          shapeFillColor={shapeFillColor}
          textFontSizeNorm={textFontSizeNorm}
          textVisualStyle={textVisualStyle}
          textFillColor={textFillColor}
          stickyFillColor={stickyFillColor}
          stickyFontSizeNorm={stickyFontSizeNorm}
          defaultStickyWNorm={0.22}
          defaultStickyHNorm={0.11}
          onPointerSessionStart={() => setAnnotationTargetPage(poolPage)}
          onEyedropperPick={eyedropperForPage(poolPage)}
          onCapabilitiesChange={isLeft ? onLeftAnnotationCaps : isRight ? onRightAnnotationCaps : undefined}
          delegatePointerToSpread={!isSinglePageMode && spreadStrokeCaptureEnabled}
          spreadInkDelegated={spreadInkDelegated}
          onSelectionMoveCommitted={
            isLeft ? mirrorLeftSelectionMoveToRight : isRight ? mirrorRightSelectionMoveToLeft : undefined
          }
        />
      )
    },
    [
      annotationMode,
      spreadInkDelegated,
      eyedropperForPage,
      eyedropperVariant,
      eraserLineStrokeWidthScale,
      isSinglePageMode,
      leftAnnRef,
      leftPenInkPatternOriginXPx,
      marqueeSelectRule,
      markerDecoratedEdge,
      markerStraightStroke,
      mirrorLeftSelectionMoveToRight,
      mirrorRightSelectionMoveToLeft,
      onLeftAnnotationCaps,
      onRightAnnotationCaps,
      pageCanvasHeightPx,
      penAutoGroupConnected,
      penInkColor,
      penInkStyle,
      penStrokeProfile,
      penStrokeWidthScale,
      rightAnnRef,
      rightPenInkPatternOriginXPx,
      selectedBookId,
      selectedUnitId,
      setAnnotationTargetPage,
      shapeColorResolved,
      shapeFillColor,
      shapeFillMode,
      shapeLineDashStyle,
      shapeStrokeEnabled,
      shapeStrokeWidthScale,
      spreadPageWidth,
      spreadStrokeCaptureEnabled,
      stampQuestionColor,
      stampScale,
      stampVariant,
      stickyFillColor,
      stickyFontSizeNorm,
      strokeColor,
      strokeLineDashStyle,
      strokeWidthScale,
      studentId,
      textColorResolved,
      textFillColor,
      textFontSizeNorm,
      textVisualStyle,
    ],
  )

  const [sharedPdf, setSharedPdf] = useState<PDFDocumentProxy | null>(null)
  const [unitPdfLoading, setUnitPdfLoading] = useState(false)
  const [unitPdfError, setUnitPdfError] = useState<string | null>(null)

  useEffect(() => {
    if (unitPdfError) onSpreadSlotsPixelsReady?.()
  }, [unitPdfError, onSpreadSlotsPixelsReady])

  useEffect(() => {
    if (!selectedBookId) return
    preloadAllEffectPenResources()
  }, [selectedBookId])

  const onDocumentLoadSuccessRef = useRef(onDocumentLoadSuccess)
  onDocumentLoadSuccessRef.current = onDocumentLoadSuccess

  useEffect(() => {
    if (!pdfReady || !selectedUnitFilePath) {
      setSharedPdf(null)
      setUnitPdfLoading(false)
      setUnitPdfError(null)
      return
    }
    const fileUrl = makeUnitFileUrl(selectedUnitFilePath)
    let cancelled = false
    setUnitPdfLoading(true)
    setUnitPdfError(null)
    setSharedPdf(null)
    void loadCachedPdfDocument(fileUrl)
      .then(async (doc) => {
        if (cancelled) return
        let pageAspectRatio: number | undefined
        try {
          const n = doc.numPages
          if (n > 0) {
            const p = Math.min(Math.max(1, pageNumber), n)
            const page = await doc.getPage(p)
            const v = page.getViewport({ scale: 1 })
            const r = v.width / v.height
            if (Number.isFinite(r) && r > 0) pageAspectRatio = r
          }
        } catch {
          /* layout falls back to default aspect until react-pdf reports */
        }
        if (cancelled) return
        onDocumentLoadSuccessRef.current({ numPages: doc.numPages, pageAspectRatio })
        setSharedPdf(doc)
      })
      .catch((e) => {
        if (cancelled) return
        setUnitPdfError(e instanceof Error ? e.message : 'Could not open this PDF unit.')
      })
      .finally(() => {
        if (!cancelled) setUnitPdfLoading(false)
      })
    return () => {
      cancelled = true
    }
    // Intentionally omit `onDocumentLoadSuccess` — use ref so page turns do not reload the PDF.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reload when unit or worker readiness changes
  }, [pdfReady, selectedUnitFilePath, makeUnitFileUrl])

  const spreadStageOverlays = (
    <>
      {spreadSessionModeEnabled && showSpreadRightPage && spreadRightPage != null && spreadSessionDoc ? (
        <BookSpreadSessionLayer
          widthPx={spreadOverlayWidthPx}
          heightPx={spreadOverlayHeightPx}
          commands={spreadSessionDoc.commands}
          trailingEraserLineDraft={spreadEraserLineDraft}
          selectEnabled={annotationMode === 'select'}
          selectedIds={spreadSessionSelectedIds}
          onSelectedIdsChange={setSpreadSessionSelected}
          onMoveSelectedBy={moveSpreadSessionSelected}
        />
      ) : null}
      {!whiteboardActive &&
      showSpreadRightPage &&
      spreadRightPage != null &&
      selectedBookId &&
      selectedUnitId ? (
        <BookSpreadStrokeOverlay
          ref={spreadStrokeOverlayRef}
          leftPageCaptureRef={leftPageCaptureRef}
          rightPageCaptureRef={rightPageCaptureRef}
          leftAnnRef={leftAnnRef}
          rightAnnRef={rightAnnRef}
          annotationMode={annotationMode}
          strokeWidthScale={strokeWidthScale}
          eraserLineStrokeWidthScale={eraserLineStrokeWidthScale}
          penStrokeWidthScale={penStrokeWidthScale}
          strokeColor={strokeColor}
          penInkColor={penInkColor}
          penInkStyle={penInkStyle}
          penStrokeProfile={penStrokeProfile}
          strokeLineDashStyle={strokeLineDashStyle}
          markerStraightStroke={markerStraightStroke}
          markerDecoratedEdge={markerDecoratedEdge}
          shapeColor={shapeColorResolved}
          shapeStrokeWidthScale={shapeStrokeWidthScale}
          shapeLineDashStyle={shapeLineDashStyle}
          shapeStrokeEnabled={shapeStrokeEnabled}
          shapeFillMode={shapeFillMode}
          shapeFillColor={shapeFillColor}
          pageNumberLeft={pageNumber}
          pageNumberRight={spreadRightPage}
          annotationTargetPage={annotationTargetPage}
          setAnnotationTargetPage={setAnnotationTargetPage}
          onCapabilitiesChange={onSpreadOverlayCaps}
          captureEnabled={spreadStrokeCaptureEnabled}
          spreadOverlayWidthPx={spreadOverlayWidthPx}
          spreadOverlayHeightPx={spreadOverlayHeightPx}
          spreadPageWidthPx={spreadPageWidth}
          leftPenInkPatternOriginXPx={leftPenInkPatternOriginXPx}
          rightPenInkPatternOriginXPx={rightPenInkPatternOriginXPx}
          spreadSeamNormX={spreadSeamNormX}
          spreadSessionMode={spreadSessionModeEnabled}
          onSpreadSessionAppendCommand={appendSpreadSessionCommand}
          spreadSessionUndo={spreadSessionUndo}
          spreadSessionRedo={spreadSessionRedo}
          spreadSessionClear={spreadSessionClear}
          onSpreadEraserLineDraftChange={setSpreadEraserLineDraft}
        />
      ) : null}
      {whiteboardInSlot ? (
        <div
          ref={whiteboardPanelAnchorRef}
          className={cn(
            'pointer-events-none absolute isolate z-[32] overflow-visible',
            whiteboardPanelObscured && 'invisible opacity-0',
          )}
          style={{
            left: boardSlotLeftPx + WHITEBOARD_SLOT_INSET_PX,
            top: WHITEBOARD_SLOT_INSET_PX,
            width: whiteboardSlotPanelWidthPx,
            height: whiteboardSlotPanelHeightPx,
          }}
        >
          <div
            className={cn(
              'pointer-events-auto h-full w-full',
              whiteboardPanelObscured && 'pointer-events-none',
            )}
          >
            {renderWhiteboardPanel()}
          </div>
        </div>
      ) : null}
      {whiteboardMinimizedVisible ? (
        <WhiteboardCollapsedTab
          slotSide={whiteboardSlotSide}
          onExpand={onExpandWhiteboard}
          suppressChrome={suppressChrome}
        />
      ) : null}
    </>
  )

  const poolStageCommonProps = {
    anchorPage: pageNumber,
    spreadRightPage: spreadRightPage ?? null,
    visiblePages,
    readerBounds,
    unitId: selectedUnitId!,
    spreadPageWidth,
    pageCanvasHeightPx,
    gutterPullPx,
    pdf: sharedPdf!,
    PdfPage,
    prefetchRevision,
    confirmSlotPixelsReady: confirmSpreadSlotPixels,
    onPdfPageLoadSuccess,
    onSlotPixelsReady: handlePoolSlotPixelsReady,
    leftCaptureRef: leftPageCaptureRef,
    rightCaptureRef: rightPageCaptureRef,
    renderPageChrome: renderPoolPageChrome,
    spreadOverlayWidthPx,
    showSpreadRightPage,
  } as const

  return (
    <>
      <div
        ref={pageAreaRef}
        className={cn('absolute inset-0 overflow-hidden', spreadStrokeCaptureEnabled && 'touch-none')}
        style={spreadStrokeCaptureEnabled ? { touchAction: 'none' } : undefined}
      >
        {showSpreadLoadingHold ? (
          <div
            className="absolute inset-0 z-[19] flex flex-col items-center justify-center gap-2 bg-[var(--surface-2)] text-center"
            aria-busy="true"
            aria-live="polite"
          >
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" aria-hidden />
            <p className="text-xs text-muted-foreground">Loading pages…</p>
          </div>
        ) : null}
        {!hasCurriculumOrHistory ? (
          <div className="flex h-full items-center justify-center">
            <div className="max-w-md rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)]/92 p-6 text-center backdrop-blur-sm">
              <p className="text-base font-semibold text-foreground">No curriculum assigned yet for this student.</p>
              <p className="mt-2 text-sm text-muted-foreground">Assign a curriculum book first in the teacher plan screen.</p>
              <Button asChild className="mt-4">
                <Link href={`/students/${studentId}/plan?tab=curriculum`}>Open curriculum planning</Link>
              </Button>
            </div>
          </div>
        ) : loading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading book...</p>
        ) : error ? (
          <p className="p-6 text-sm text-[var(--brand-red)]">{error}</p>
        ) : !hasResolvedUnit ? (
          <div className="flex h-full items-center justify-center">
            <div className="max-w-md rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)]/92 p-6 text-center backdrop-blur-sm">
              <p className="text-base font-semibold text-foreground">Assigned book has no units.</p>
              <p className="mt-2 text-sm text-muted-foreground">Add unit PDF files to this book folder in `book-library` and try again.</p>
            </div>
          </div>
        ) : !pdfReady ? (
          <p className="p-6 text-sm text-muted-foreground">Preparing PDF viewer...</p>
        ) : unitPdfLoading || !sharedPdf ? (
          <p className="p-6 text-sm text-muted-foreground">Loading PDF...</p>
        ) : unitPdfError ? (
          <p className="p-6 text-sm text-[var(--brand-red)]">{unitPdfError}</p>
        ) : (
          <div className="absolute inset-0 flex min-h-0 min-w-0 items-center justify-center overflow-hidden">
            <div
              className={cn(
                'relative flex w-max max-h-full max-w-full shrink-0 items-center justify-center leading-none bg-transparent',
                spreadSlotsPixelsReady && 'bg-[var(--surface-2)]',
                whiteboardActive && whiteboardLayoutMode === 'fullscreen' && 'pointer-events-none',
              )}
              style={{
                transform: spreadDisplayScale !== 1 ? `scale(${spreadDisplayScale})` : undefined,
                transformOrigin: 'center center',
              }}
            >
              {isSinglePageMode ? (
                useStablePageViewPool ? (
                  <SpreadStage
                    {...poolStageCommonProps}
                    isSinglePageMode
                    spreadRightPage={null}
                    gridRef={spreadGridRef}
                    turnSlide={turnSlide}
                    onTurnSlideComplete={onTurnSlideComplete}
                  />
                ) : (
                <div className="flex w-max max-w-full items-start justify-center leading-none">
                  {selectedUnitId ? (
                    <ReaderPageSlot
                      key={`slot-p-${pageNumber}`}
                      unitId={selectedUnitId}
                      pageNumber={pageNumber}
                      spreadPageWidth={spreadPageWidth}
                      pageCanvasHeightPx={pageCanvasHeightPx}
                      pdf={sharedPdf}
                      PdfPage={PdfPage}
                      onPdfPageLoadSuccess={onPdfPageLoadSuccess}
                      prefetchRevision={prefetchRevision}
                      captureRef={leftPageCaptureRef}
                      onSlotPixelsReady={handleLeftSlotPixelsReady}
                      confirmSlotPixelsReady={confirmSpreadSlotPixels}
                    >
                      {selectedBookId ? (
                        <BookPageAnnotationLayer
                          ref={leftAnnRef}
                          studentId={studentId}
                          bookId={selectedBookId}
                          unitId={selectedUnitId}
                          pageNumber={pageNumber}
                          widthPx={spreadPageWidth}
                          heightPx={pageCanvasHeightPx}
                          mode={annotationMode}
                          eyedropperVariant={eyedropperVariant}
                          stampVariant={stampVariant}
                          stampQuestionColor={stampQuestionColor}
                          strokeWidthScale={strokeWidthScale}
                          eraserLineStrokeWidthScale={eraserLineStrokeWidthScale}
                          penStrokeWidthScale={penStrokeWidthScale}
                          shapeStrokeWidthScale={shapeStrokeWidthScale}
                          stampScale={stampScale}
                          strokeColor={strokeColor}
                          penInkColor={penInkColor}
                          penInkStyle={penInkStyle}
                          penStrokeProfile={penStrokeProfile}
                          strokeLineDashStyle={strokeLineDashStyle}
                          markerStraightStroke={markerStraightStroke}
                          markerDecoratedEdge={markerDecoratedEdge}
                          penAutoGroupConnected={penAutoGroupConnected}
                          marqueeSelectRule={marqueeSelectRule}
                          shapeColor={shapeColorResolved}
                          textColor={textColorResolved}
                          shapeLineDashStyle={shapeLineDashStyle}
                          shapeStrokeEnabled={shapeStrokeEnabled}
                          shapeFillMode={shapeFillMode}
                          shapeFillColor={shapeFillColor}
                          textFontSizeNorm={textFontSizeNorm}
                          textVisualStyle={textVisualStyle}
                          textFillColor={textFillColor}
                          stickyFillColor={stickyFillColor}
                          stickyFontSizeNorm={stickyFontSizeNorm}
                          defaultStickyWNorm={0.22}
                          defaultStickyHNorm={0.11}
                          onPointerSessionStart={() => setAnnotationTargetPage(pageNumber)}
                          onEyedropperPick={eyedropperForPage(pageNumber)}
                          onCapabilitiesChange={onLeftAnnotationCaps}
                          spreadInkDelegated={spreadInkDelegated}
                        />
                      ) : null}
                    </ReaderPageSlot>
                  ) : (
                    <div ref={leftPageCaptureRef} className="relative inline-block">
                      <PdfPage
                        key={`p-${pageNumber}`}
                        pdf={sharedPdf}
                        pageNumber={pageNumber}
                        width={spreadPageWidth}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        onLoadSuccess={onPdfPageLoadSuccess}
                      />
                    </div>
                  )}
                </div>
                )
              ) : whiteboardActive && whiteboardLayoutMode === 'fullscreen' ? (
                <div
                  ref={whiteboardPanelAnchorRef}
                  className={cn(
                    'relative inline-flex max-w-full items-start leading-none',
                    whiteboardPanelObscured && 'pointer-events-none invisible opacity-0',
                  )}
                  style={{ width: spreadOverlayWidthPx, minHeight: pageCanvasHeightPx }}
                >
                  {renderWhiteboardPanel()}
                </div>
              ) : useStablePageViewPool ? (
                <SpreadStage
                  {...poolStageCommonProps}
                  isSinglePageMode={false}
                  gridRef={spreadGridRef}
                  elevatedSlot={whiteboardInSlot ? (boardOnLeft ? 'right' : 'left') : null}
                  turnSlide={turnSlide}
                  onTurnSlideComplete={onTurnSlideComplete}
                >
                  {spreadStageOverlays}
                </SpreadStage>
              ) : (
                <SpreadPageCluster
                  gridRef={spreadGridRef}
                  spreadOverlayWidthPx={spreadOverlayWidthPx}
                  pageCanvasHeightPx={pageCanvasHeightPx}
                  gutterPullPx={gutterPullPx}
                  leftPage={
                      selectedUnitId ? (
                        <ReaderPageSlot
                          key={`slot-l-${pageNumber}`}
                          unitId={selectedUnitId}
                          pageNumber={pageNumber}
                          spreadPageWidth={spreadPageWidth}
                          pageCanvasHeightPx={pageCanvasHeightPx}
                          pdf={sharedPdf}
                          PdfPage={PdfPage}
                          onPdfPageLoadSuccess={onPdfPageLoadSuccess}
                          prefetchRevision={prefetchRevision}
                          captureRef={leftPageCaptureRef}
                          onSlotPixelsReady={handleLeftSlotPixelsReady}
                          confirmSlotPixelsReady={confirmSpreadSlotPixels}
                        >
                          {selectedBookId ? (
                            <BookPageAnnotationLayer
                              ref={leftAnnRef}
                              studentId={studentId}
                              bookId={selectedBookId}
                              unitId={selectedUnitId}
                              pageNumber={pageNumber}
                              widthPx={spreadPageWidth}
                              heightPx={pageCanvasHeightPx}
                              mode={annotationMode}
                              eyedropperVariant={eyedropperVariant}
                              stampVariant={stampVariant}
                              stampQuestionColor={stampQuestionColor}
                              strokeWidthScale={strokeWidthScale}
                              eraserLineStrokeWidthScale={eraserLineStrokeWidthScale}
                              penStrokeWidthScale={penStrokeWidthScale}
                              shapeStrokeWidthScale={shapeStrokeWidthScale}
                              stampScale={stampScale}
                              strokeColor={strokeColor}
                              penInkColor={penInkColor}
                              penInkStyle={penInkStyle}
                          penStrokeProfile={penStrokeProfile}
                              penInkPatternOriginXPx={leftPenInkPatternOriginXPx}
                              strokeLineDashStyle={strokeLineDashStyle}
                              markerStraightStroke={markerStraightStroke}
                          markerDecoratedEdge={markerDecoratedEdge}
                          penAutoGroupConnected={penAutoGroupConnected}
                          marqueeSelectRule={marqueeSelectRule}
                              shapeColor={shapeColorResolved}
                          textColor={textColorResolved}
                              shapeLineDashStyle={shapeLineDashStyle}
                              shapeStrokeEnabled={shapeStrokeEnabled}
                              shapeFillMode={shapeFillMode}
                              shapeFillColor={shapeFillColor}
                              textFontSizeNorm={textFontSizeNorm}
                              textVisualStyle={textVisualStyle}
                              textFillColor={textFillColor}
                              stickyFillColor={stickyFillColor}
                              stickyFontSizeNorm={stickyFontSizeNorm}
                              defaultStickyWNorm={0.22}
                              defaultStickyHNorm={0.11}
                              onPointerSessionStart={() => setAnnotationTargetPage(pageNumber)}
                              onEyedropperPick={eyedropperForPage(pageNumber)}
                              onCapabilitiesChange={onLeftAnnotationCaps}
                              delegatePointerToSpread={spreadStrokeCaptureEnabled}
                              spreadInkDelegated={spreadInkDelegated}
                              onSelectionMoveCommitted={mirrorLeftSelectionMoveToRight}
                            />
                          ) : null}
                        </ReaderPageSlot>
                      ) : (
                        <div ref={leftPageCaptureRef} className="relative inline-block">
                          <PdfPage
                            key={`l-${pageNumber}`}
                            pdf={sharedPdf}
                            pageNumber={pageNumber}
                            width={spreadPageWidth}
                            renderTextLayer={false}
                            renderAnnotationLayer={false}
                            onLoadSuccess={onPdfPageLoadSuccess}
                          />
                        </div>
                      )}
                  rightPage={
                      showSpreadRightPage && spreadRightPage != null ? (
                        selectedUnitId ? (
                          <ReaderPageSlot
                            key={`slot-r-${spreadRightPage}`}
                            unitId={selectedUnitId}
                            pageNumber={spreadRightPage}
                            spreadPageWidth={spreadPageWidth}
                            pageCanvasHeightPx={pageCanvasHeightPx}
                            pdfClipLeftPx={gutterPullPx}
                            pdf={sharedPdf}
                            PdfPage={PdfPage}
                            onPdfPageLoadSuccess={onPdfPageLoadSuccess}
                            prefetchRevision={prefetchRevision}
                            captureRef={rightPageCaptureRef}
                            onSlotPixelsReady={handleRightSlotPixelsReady}
                            confirmSlotPixelsReady={confirmSpreadSlotPixels}
                          >
                            {selectedBookId ? (
                              <BookPageAnnotationLayer
                                ref={rightAnnRef}
                                studentId={studentId}
                                bookId={selectedBookId}
                                unitId={selectedUnitId}
                                pageNumber={spreadRightPage}
                                widthPx={spreadPageWidth}
                                heightPx={pageCanvasHeightPx}
                                mode={annotationMode}
                                eyedropperVariant={eyedropperVariant}
                                stampVariant={stampVariant}
                                stampQuestionColor={stampQuestionColor}
                                strokeWidthScale={strokeWidthScale}
                                eraserLineStrokeWidthScale={eraserLineStrokeWidthScale}
                                penStrokeWidthScale={penStrokeWidthScale}
                                shapeStrokeWidthScale={shapeStrokeWidthScale}
                                stampScale={stampScale}
                                strokeColor={strokeColor}
                                penInkColor={penInkColor}
                                penInkStyle={penInkStyle}
                          penStrokeProfile={penStrokeProfile}
                                penInkPatternOriginXPx={rightPenInkPatternOriginXPx}
                                strokeLineDashStyle={strokeLineDashStyle}
                                markerStraightStroke={markerStraightStroke}
                          markerDecoratedEdge={markerDecoratedEdge}
                          penAutoGroupConnected={penAutoGroupConnected}
                          marqueeSelectRule={marqueeSelectRule}
                                shapeColor={shapeColorResolved}
                          textColor={textColorResolved}
                                shapeLineDashStyle={shapeLineDashStyle}
                                shapeStrokeEnabled={shapeStrokeEnabled}
                                shapeFillMode={shapeFillMode}
                                shapeFillColor={shapeFillColor}
                                textFontSizeNorm={textFontSizeNorm}
                                textVisualStyle={textVisualStyle}
                                textFillColor={textFillColor}
                                stickyFillColor={stickyFillColor}
                                stickyFontSizeNorm={stickyFontSizeNorm}
                                defaultStickyWNorm={0.22}
                                defaultStickyHNorm={0.11}
                                onPointerSessionStart={() => setAnnotationTargetPage(spreadRightPage)}
                                onEyedropperPick={
                                  spreadRightPage != null ? eyedropperForPage(spreadRightPage) : undefined
                                }
                                onCapabilitiesChange={onRightAnnotationCaps}
                                delegatePointerToSpread={spreadStrokeCaptureEnabled}
                                spreadInkDelegated={spreadInkDelegated}
                                onSelectionMoveCommitted={mirrorRightSelectionMoveToLeft}
                              />
                            ) : null}
                          </ReaderPageSlot>
                        ) : (
                          <div ref={rightPageCaptureRef} className="relative inline-block">
                            <PdfPage
                              key={`r-${spreadRightPage}`}
                              pdf={sharedPdf}
                              pageNumber={spreadRightPage}
                              width={spreadPageWidth}
                              renderTextLayer={false}
                              renderAnnotationLayer={false}
                              onLoadSuccess={onPdfPageLoadSuccess}
                            />
                          </div>
                        )
                      ) : (
                        <div aria-hidden style={{ width: spreadPageWidth, height: pageCanvasHeightPx }} />
                      )}
                >
                    {spreadSessionModeEnabled &&
                    showSpreadRightPage &&
                    spreadRightPage != null &&
                    spreadSessionDoc ? (
                      <BookSpreadSessionLayer
                        widthPx={spreadOverlayWidthPx}
                        heightPx={spreadOverlayHeightPx}
                        commands={spreadSessionDoc.commands}
                        trailingEraserLineDraft={spreadEraserLineDraft}
                        selectEnabled={annotationMode === 'select'}
                        selectedIds={spreadSessionSelectedIds}
                        onSelectedIdsChange={setSpreadSessionSelected}
                        onMoveSelectedBy={moveSpreadSessionSelected}
                      />
                    ) : null}
                    {!whiteboardActive &&
                    showSpreadRightPage &&
                    spreadRightPage != null &&
                    selectedBookId &&
                    selectedUnitId ? (
                      <BookSpreadStrokeOverlay
                        ref={spreadStrokeOverlayRef}
                        leftPageCaptureRef={leftPageCaptureRef}
                        rightPageCaptureRef={rightPageCaptureRef}
                        leftAnnRef={leftAnnRef}
                        rightAnnRef={rightAnnRef}
                        annotationMode={annotationMode}
                        strokeWidthScale={strokeWidthScale}
                        eraserLineStrokeWidthScale={eraserLineStrokeWidthScale}
                        penStrokeWidthScale={penStrokeWidthScale}
                        strokeColor={strokeColor}
                        penInkColor={penInkColor}
                        penInkStyle={penInkStyle}
                        penStrokeProfile={penStrokeProfile}
                        strokeLineDashStyle={strokeLineDashStyle}
                        markerStraightStroke={markerStraightStroke}
                        markerDecoratedEdge={markerDecoratedEdge}
                        shapeColor={shapeColorResolved}
                        shapeStrokeWidthScale={shapeStrokeWidthScale}
                        shapeLineDashStyle={shapeLineDashStyle}
                        shapeStrokeEnabled={shapeStrokeEnabled}
                        shapeFillMode={shapeFillMode}
                        shapeFillColor={shapeFillColor}
                        pageNumberLeft={pageNumber}
                        pageNumberRight={spreadRightPage}
                        annotationTargetPage={annotationTargetPage}
                        setAnnotationTargetPage={setAnnotationTargetPage}
                        onCapabilitiesChange={onSpreadOverlayCaps}
                        captureEnabled={spreadStrokeCaptureEnabled}
                        spreadOverlayWidthPx={spreadOverlayWidthPx}
                        spreadOverlayHeightPx={spreadOverlayHeightPx}
                        spreadPageWidthPx={spreadPageWidth}
                        leftPenInkPatternOriginXPx={leftPenInkPatternOriginXPx}
                        rightPenInkPatternOriginXPx={rightPenInkPatternOriginXPx}
                        spreadSeamNormX={spreadSeamNormX}
                        spreadSessionMode={spreadSessionModeEnabled}
                        onSpreadSessionAppendCommand={appendSpreadSessionCommand}
                        spreadSessionUndo={spreadSessionUndo}
                        spreadSessionRedo={spreadSessionRedo}
                        spreadSessionClear={spreadSessionClear}
                        onSpreadEraserLineDraftChange={setSpreadEraserLineDraft}
                      />
                    ) : null}
                    {whiteboardInSlot ? (
                      <div
                        ref={whiteboardPanelAnchorRef}
                        className={cn(
                          'pointer-events-none absolute isolate z-[32] overflow-visible',
                          whiteboardPanelObscured && 'invisible opacity-0',
                        )}
                        style={{
                          left: boardSlotLeftPx + WHITEBOARD_SLOT_INSET_PX,
                          top: WHITEBOARD_SLOT_INSET_PX,
                          width: whiteboardSlotPanelWidthPx,
                          height: whiteboardSlotPanelHeightPx,
                        }}
                      >
                        <div
                          className={cn(
                            'pointer-events-auto h-full w-full',
                            whiteboardPanelObscured && 'pointer-events-none',
                          )}
                        >
                          {renderWhiteboardPanel()}
                        </div>
                      </div>
                    ) : null}
                    {whiteboardMinimizedVisible ? (
                      <WhiteboardCollapsedTab
                        slotSide={whiteboardSlotSide}
                        onExpand={onExpandWhiteboard}
                        suppressChrome={suppressChrome}
                      />
                    ) : null}
                </SpreadPageCluster>
              )}
            </div>

          </div>
        )}
        <BookCaptureRegionOverlay
          open={regionSelectOpen}
          onCancel={() => setRegionSelectOpen(false)}
          onConfirm={(rect) => {
            setRegionSelectOpen(false)
            void runImageCapture({ kind: 'region', regionCss: rect })
          }}
        />
        {pdfExporting ? (
          <div className="absolute inset-0 z-[88] flex flex-col items-center justify-center gap-2 bg-black/55 px-4 text-center text-sm text-white backdrop-blur-[2px]">
            <p>{pdfProgressLabel ?? 'Exporting…'}</p>
          </div>
        ) : null}
      </div>
    </>
  )
}

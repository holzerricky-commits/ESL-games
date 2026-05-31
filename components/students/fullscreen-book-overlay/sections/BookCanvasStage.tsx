'use client'

import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import type { ComponentType, CSSProperties, MutableRefObject, RefObject } from 'react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { BookCaptureRegionOverlay } from '@/components/students/book-capture-region-overlay'
import { BookPageAnnotationLayer, type AnnotationCapabilities, type BookPageAnnotationHandle } from '@/components/students/book-page-annotation-layer'
import { BookSpreadStrokeOverlay } from '@/components/students/book-spread-stroke-overlay'
import { BookSpreadSessionLayer } from '@/components/students/book-spread-session-layer'
import type { AnnotationLineDashStyle, ShapeFillMode } from '@/lib/books/annotation-command-types'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import { Button } from '@/components/ui/button'
import type { BookReaderDocumentReadyMeta } from '@/components/students/fullscreen-book-overlay/types'
import { useReaderPrefetchCacheRevision } from '@/components/students/fullscreen-book-overlay/hooks/useReaderPrefetchCacheRevision'
import { ReaderPageSlot } from '@/components/students/fullscreen-book-overlay/sections/ReaderPageSlot'
import { preloadAllManifestBrushPatterns } from '@/lib/books/brush-pattern-loader'
import { DEFAULT_TEXT_FILL_COLOR } from '@/lib/books/annotation-palettes'
import { spreadSidePullPx } from '@/lib/books/spread-gutter'
import { SpreadPageCluster } from '@/components/books/spread-page-cluster'
import { seamClientX } from '@/lib/books/spread-stroke-split'
import { loadCachedPdfDocument } from '@/lib/books/pdf-thumbnail-cache'
import { spreadSessionEditingEnabled } from '@/lib/books/feature-flags'
import { createSpreadSessionStore } from '@/lib/books/spread-session-store'
import type { SpreadSessionDocument } from '@/lib/books/spread-session-types'
import { hydrateSpreadSessionFromOwnerPages, projectSpreadSessionToOwnerPages } from '@/lib/books/spread-session-commit'
import { getAnnotationsForPage, setAnnotationsForPage } from '@/lib/books/annotation-storage'
import { SPREAD_SESSION_FLUSH_EVENT } from '@/lib/books/spread-session-events'
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
  /** Phase E1 (Option B): paper-tone hold until first spread `react-pdf` onLoadSuccess. */
  viewportPaintHold: boolean
  firstSpreadPaintSession: number
  onFirstSpreadPaintReady: () => void
  spreadStrokeOverlayRef: MutableRefObject<BookPageAnnotationHandle | null>
  onSpreadOverlayCaps: (caps: AnnotationCapabilities) => void
  spreadStrokeCaptureEnabled: boolean
  onEyedropperPick?: (
    pageNumber: number,
    clientX: number,
    clientY: number,
  ) => void
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
  viewportPaintHold,
  firstSpreadPaintSession,
  onFirstSpreadPaintReady,
  spreadStrokeOverlayRef,
  onSpreadOverlayCaps,
  spreadStrokeCaptureEnabled,
  onEyedropperPick,
}: BookCanvasStageProps) {
  const isDevBuild = process.env.NODE_ENV !== 'production'
  const [spreadSessionModeEnabled, setSpreadSessionModeEnabled] = useState(spreadSessionEditingEnabled)
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
  /** Phase E1 — see `lib/books/first-spread-paint-ready-contract.ts`. */
  const firstSpreadReportedRef = useRef(false)
  const leftPagePaintedRef = useRef(false)
  const rightPagePaintedRef = useRef(false)

  const tryReportFirstSpreadPaintReady = useCallback(() => {
    if (firstSpreadReportedRef.current) return
    if (isSinglePageMode) {
      if (!leftPagePaintedRef.current) return
      firstSpreadReportedRef.current = true
      onFirstSpreadPaintReady()
      return
    }
    if (!showSpreadRightPage || spreadRightPage == null) {
      if (!leftPagePaintedRef.current) return
      firstSpreadReportedRef.current = true
      onFirstSpreadPaintReady()
      return
    }
    if (leftPagePaintedRef.current && rightPagePaintedRef.current) {
      firstSpreadReportedRef.current = true
      onFirstSpreadPaintReady()
    }
  }, [isSinglePageMode, showSpreadRightPage, spreadRightPage, onFirstSpreadPaintReady])

  useEffect(() => {
    firstSpreadReportedRef.current = false
    leftPagePaintedRef.current = false
    rightPagePaintedRef.current = false
  }, [firstSpreadPaintSession, isSinglePageMode])

  const handleLeftPdfPageLoadSuccess = useCallback(
    (p: { originalWidth?: number; originalHeight?: number; width: number; height: number }) => {
      onPdfPageLoadSuccess(p)
      leftPagePaintedRef.current = true
      tryReportFirstSpreadPaintReady()
    },
    [onPdfPageLoadSuccess, tryReportFirstSpreadPaintReady],
  )

  const handleRightPdfPageLoadSuccess = useCallback(
    (p: { originalWidth?: number; originalHeight?: number; width: number; height: number }) => {
      onPdfPageLoadSuccess(p)
      rightPagePaintedRef.current = true
      tryReportFirstSpreadPaintReady()
    },
    [onPdfPageLoadSuccess, tryReportFirstSpreadPaintReady],
  )

  const handleSingleFallbackPdfLoadSuccess = useCallback(
    (p: { originalWidth?: number; originalHeight?: number; width: number; height: number }) => {
      onPdfPageLoadSuccess(p)
      leftPagePaintedRef.current = true
      tryReportFirstSpreadPaintReady()
    },
    [onPdfPageLoadSuccess, tryReportFirstSpreadPaintReady],
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

  const spreadGridRef = useRef<HTMLDivElement | null>(null)
  const [leftPenInkPatternOriginXPx, setLeftPenInkPatternOriginXPx] = useState(0)
  const [rightPenInkPatternOriginXPx, setRightPenInkPatternOriginXPx] = useState(0)
  const [spreadSeamNormX, setSpreadSeamNormX] = useState(0.5)
  const spreadSessionStoreRef = useRef<ReturnType<typeof createSpreadSessionStore> | null>(null)
  const [spreadSessionDoc, setSpreadSessionDoc] = useState<SpreadSessionDocument | null>(null)
  const spreadSessionDocRef = useRef<SpreadSessionDocument | null>(null)
  const [spreadSessionSelectedIds, setSpreadSessionSelectedIds] = useState<string[]>([])
  const spreadSessionKeyRef = useRef<{ leftPage: number; rightPage: number } | null>(null)

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

  const flushSpreadSessionToPageStorage = useCallback((overridePages?: { leftPage: number; rightPage: number }) => {
    const store = spreadSessionStoreRef.current
    const doc = spreadSessionDocRef.current
    const pages = overridePages ?? (spreadRightPage != null ? { leftPage: pageNumber, rightPage: spreadRightPage } : null)
    if (!store || !doc || !selectedBookId || !selectedUnitId || !pages) return
    const layout = {
      spreadOverlayWidthPx,
      spreadPageWidthPx: spreadPageWidth,
      leftPageOriginXPx: leftPenInkPatternOriginXPx,
      rightPageOriginXPx: rightPenInkPatternOriginXPx,
      seamNormX: spreadSeamNormX,
    }
    const projected = projectSpreadSessionToOwnerPages(doc.commands, layout)
    if (doc.commands.length === 0) {
      setAnnotationsForPage(studentId, selectedBookId, selectedUnitId, pages.leftPage, [], 'pdf')
      setAnnotationsForPage(studentId, selectedBookId, selectedUnitId, pages.rightPage, [], 'pdf')
      store.markClean()
      store.checkpointNow()
      return
    }
    setAnnotationsForPage(studentId, selectedBookId, selectedUnitId, pages.leftPage, projected.left, 'pdf')
    setAnnotationsForPage(studentId, selectedBookId, selectedUnitId, pages.rightPage, projected.right, 'pdf')
    store.markClean()
    store.checkpointNow()
  }, [
    leftPenInkPatternOriginXPx,
    pageNumber,
    rightPenInkPatternOriginXPx,
    selectedBookId,
    selectedUnitId,
    spreadOverlayWidthPx,
    spreadPageWidth,
    spreadRightPage,
    spreadSeamNormX,
    studentId,
  ])

  useEffect(() => {
    const onFlush = () => flushSpreadSessionToPageStorage()
    window.addEventListener(SPREAD_SESSION_FLUSH_EVENT, onFlush)
    return () => window.removeEventListener(SPREAD_SESSION_FLUSH_EVENT, onFlush)
  }, [flushSpreadSessionToPageStorage])

  useEffect(() => {
    const shouldUseSession =
      spreadSessionModeEnabled &&
      !isSinglePageMode &&
      selectedBookId &&
      selectedUnitId &&
      spreadRightPage != null
    const prev = spreadSessionKeyRef.current
    const next = shouldUseSession ? { leftPage: pageNumber, rightPage: spreadRightPage } : null
    if (prev && (!next || prev.leftPage !== next.leftPage || prev.rightPage !== next.rightPage)) {
      flushSpreadSessionToPageStorage(prev)
    }
    if (!shouldUseSession) {
      spreadSessionStoreRef.current?.destroy()
      spreadSessionStoreRef.current = null
      spreadSessionKeyRef.current = null
      setSpreadSessionDoc(null)
      spreadSessionDocRef.current = null
      setSpreadSessionSelectedIds([])
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
      { autosaveMs: 3000 },
    )
    spreadSessionStoreRef.current = store
    spreadSessionKeyRef.current = { leftPage: pageNumber, rightPage: spreadRightPage }
    const layout = {
      spreadOverlayWidthPx,
      spreadPageWidthPx: spreadPageWidth,
      leftPageOriginXPx: leftPenInkPatternOriginXPx,
      rightPageOriginXPx: rightPenInkPatternOriginXPx,
      seamNormX: spreadSeamNormX,
    }
    const leftStored = getAnnotationsForPage(studentId, selectedBookId, selectedUnitId, pageNumber, 'pdf')
    const rightStored = getAnnotationsForPage(studentId, selectedBookId, selectedUnitId, spreadRightPage, 'pdf')
    const hydrated = hydrateSpreadSessionFromOwnerPages(leftStored, rightStored, layout)
    store.setCommands(hydrated)
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
    })
    return () => {
      unsub()
      store.destroy()
      if (spreadSessionStoreRef.current === store) spreadSessionStoreRef.current = null
      spreadSessionDocRef.current = null
    }
  }, [
    flushSpreadSessionToPageStorage,
    isSinglePageMode,
    leftPenInkPatternOriginXPx,
    pageNumber,
    rightPenInkPatternOriginXPx,
    selectedBookId,
    selectedUnitId,
    spreadOverlayWidthPx,
    spreadPageWidth,
    spreadRightPage,
    spreadSeamNormX,
    spreadSessionModeEnabled,
    studentId,
  ])

  const syncSpreadSessionCommands = useCallback((commands: AnnotationCommand[]) => {
    if (!spreadSessionModeEnabled) return
    spreadSessionStoreRef.current?.setCommands(commands)
  }, [spreadSessionModeEnabled])

  const setSpreadSessionSelected = useCallback((ids: string[]) => {
    if (!spreadSessionModeEnabled) return
    spreadSessionStoreRef.current?.setSelectedIds(ids)
  }, [spreadSessionModeEnabled])

  const moveSpreadSessionSelected = useCallback((dx: number, dy: number) => {
    if (!spreadSessionModeEnabled) return
    spreadSessionStoreRef.current?.moveSelectedBy(dx, dy)
  }, [spreadSessionModeEnabled])

  useEffect(() => {
    if (!spreadSessionModeEnabled) return
    if (isSinglePageMode || whiteboardActive || spreadRightPage == null) return
    if (annotationMode !== 'select') return

    const onKeyDown = (e: KeyboardEvent) => {
      if (isBookOverlayKeyboardTypingTarget()) return
      const key = e.key
      const keyLower = key.toLowerCase()
      const mod = e.metaKey || e.ctrlKey

      if (mod && !e.shiftKey && keyLower === 'a') {
        e.preventDefault()
        spreadSessionStoreRef.current?.selectAll()
        return
      }

      if (mod && !e.shiftKey && keyLower === 'd') {
        if (spreadSessionStoreRef.current?.duplicateSelected()) {
          e.preventDefault()
        }
        return
      }

      if (mod && !e.shiftKey && keyLower === 'c') {
        if (spreadSessionStoreRef.current?.copySelected()) {
          e.preventDefault()
        }
        return
      }

      if (mod && !e.shiftKey && keyLower === 'v') {
        if (spreadSessionStoreRef.current?.pasteFromClipboard()) {
          e.preventDefault()
        }
        return
      }

      if (mod && keyLower === 'g') {
        const ok = e.shiftKey
          ? spreadSessionStoreRef.current?.removeFromGroupSelected()
          : spreadSessionStoreRef.current?.toggleGroupSelected()
        if (ok) {
          e.preventDefault()
        }
        return
      }

      if (key === 'Tab' && !mod && !e.altKey) {
        if (spreadSessionStoreRef.current?.selectNextInStack(e.shiftKey ? -1 : 1)) {
          e.preventDefault()
        }
        return
      }

      if (!mod && !e.altKey && (key === 'Delete' || key === 'Backspace')) {
        if (spreadSessionStoreRef.current?.deleteSelected()) {
          e.preventDefault()
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [annotationMode, isSinglePageMode, whiteboardActive, spreadRightPage, spreadSessionModeEnabled])

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

  const [sharedPdf, setSharedPdf] = useState<PDFDocumentProxy | null>(null)
  const [unitPdfLoading, setUnitPdfLoading] = useState(false)
  const [unitPdfError, setUnitPdfError] = useState<string | null>(null)

  useEffect(() => {
    if (unitPdfError) onFirstSpreadPaintReady()
  }, [unitPdfError, onFirstSpreadPaintReady])

  useEffect(() => {
    if (!selectedBookId) return
    preloadAllManifestBrushPatterns()
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

  return (
    <>
      <div
        ref={pageAreaRef}
        className={cn('absolute inset-0 overflow-hidden', spreadStrokeCaptureEnabled && 'touch-none')}
        style={spreadStrokeCaptureEnabled ? { touchAction: 'none' } : undefined}
      >
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
            {viewportPaintHold ? (
              <div
                className="absolute inset-0 z-[18] flex flex-col items-center justify-center gap-2 bg-[var(--surface-2)] text-center"
                aria-busy="true"
                aria-live="polite"
              >
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" aria-hidden />
                <p className="text-xs text-muted-foreground">Loading pages…</p>
              </div>
            ) : null}
            <div
              className={cn(
                'relative flex w-max max-h-full max-w-full shrink-0 items-center justify-center leading-none bg-[var(--surface-2)]',
                whiteboardActive && whiteboardLayoutMode === 'fullscreen' && 'pointer-events-none',
              )}
              style={{
                transform: spreadDisplayScale !== 1 ? `scale(${spreadDisplayScale})` : undefined,
                transformOrigin: 'center center',
                transition: `transform ${ANIMATION_MS}ms cubic-bezier(0.4,0,0.2,1)`,
              }}
            >
              {isSinglePageMode ? (
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
                      onPdfPageLoadSuccess={handleLeftPdfPageLoadSuccess}
                      prefetchRevision={prefetchRevision}
                      captureRef={leftPageCaptureRef}
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
                        onLoadSuccess={handleSingleFallbackPdfLoadSuccess}
                      />
                    </div>
                  )}
                </div>
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
                          onPdfPageLoadSuccess={handleLeftPdfPageLoadSuccess}
                          prefetchRevision={prefetchRevision}
                          captureRef={leftPageCaptureRef}
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
                            onLoadSuccess={handleLeftPdfPageLoadSuccess}
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
                            onPdfPageLoadSuccess={handleRightPdfPageLoadSuccess}
                            prefetchRevision={prefetchRevision}
                            captureRef={rightPageCaptureRef}
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
                              onLoadSuccess={handleRightPdfPageLoadSuccess}
                            />
                          </div>
                        )
                      ) : (
                        <div aria-hidden style={{ width: spreadPageWidth, height: pageCanvasHeightPx }} />
                      )}
                >
                    {whiteboardInSlot ? (
                      <div
                        ref={whiteboardPanelAnchorRef}
                        className={cn(
                          'pointer-events-none absolute z-20 overflow-visible',
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
                        onSpreadSessionSyncCommands={syncSpreadSessionCommands}
                      />
                    ) : null}
                    {spreadSessionModeEnabled &&
                    showSpreadRightPage &&
                    spreadRightPage != null &&
                    spreadSessionDoc ? (
                      <BookSpreadSessionLayer
                        widthPx={spreadOverlayWidthPx}
                        heightPx={spreadOverlayHeightPx}
                        commands={spreadSessionDoc.commands}
                        selectEnabled={annotationMode === 'select'}
                        selectedIds={spreadSessionSelectedIds}
                        onSelectedIdsChange={setSpreadSessionSelected}
                        onMoveSelectedBy={moveSpreadSessionSelected}
                      />
                    ) : null}
                    {spreadSessionModeEnabled && spreadSessionDoc ? (
                      <div className="pointer-events-none absolute right-2 top-2 z-[40] rounded bg-black/70 px-2 py-1 text-[11px] text-white">
                        {`spread-session rev:${spreadSessionDoc.meta.revision} dirty:${spreadSessionDoc.meta.dirty ? 'yes' : 'no'} cmds:${spreadSessionDoc.commands.length} sel:${spreadSessionSelectedIds.length}`}
                      </div>
                    ) : null}
                    {isDevBuild ? (
                      <button
                        type="button"
                        className="pointer-events-auto absolute left-2 top-2 z-[41] rounded border border-white/30 bg-black/65 px-2 py-1 text-[11px] text-white"
                        onClick={() => setSpreadSessionModeEnabled((v) => !v)}
                      >
                        {spreadSessionModeEnabled ? 'session: on' : 'session: off'}
                      </button>
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

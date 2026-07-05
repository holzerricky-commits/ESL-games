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
  type LiveStrokeDraft,
} from '@/components/students/book-page-annotation-layer'
import { BookSpreadStrokeOverlay } from '@/components/students/book-spread-stroke-overlay'
import { BookSpreadPageMarkerLayer } from '@/components/students/book-spread-page-marker-layer'
import { BookSpreadMarkerSpreadOverlay } from '@/components/students/book-spread-marker-spread-overlay'
import { BookSpreadSessionLayer } from '@/components/students/book-spread-session-layer'
import type { AnnotationLineDashStyle, ShapeFillMode } from '@/lib/books/annotation-command-types'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import { appendCommandWithPenAutoGroup } from '@/lib/books/annotation-pen-auto-group'
import { Button } from '@/components/ui/button'
import type { BookReaderDocumentReadyMeta } from '@/components/students/fullscreen-book-overlay/types'
import { useReaderPrefetchCacheRevision } from '@/components/students/fullscreen-book-overlay/hooks/useReaderPrefetchCacheRevision'
import { ReaderPageSlot } from '@/components/students/fullscreen-book-overlay/sections/ReaderPageSlot'
import { SpreadStage } from '@/components/students/fullscreen-book-overlay/sections/SpreadStage'
import type { SpreadTurnSlidePayload } from '@/components/students/fullscreen-book-overlay/hooks/useSpreadTurnSlide'
import type { PageViewPoolRenderContext } from '@/components/students/fullscreen-book-overlay/sections/PageViewPool'
import { preloadAllEffectPenResources } from '@/lib/books/effect-pen-preload'
import { DEFAULT_TEXT_FILL_COLOR } from '@/lib/books/annotation-palettes'
import { isWritableStickerInteraction } from '@/lib/books/sticker-tool'
import { spreadSidePullPx } from '@/lib/books/spread-gutter'
import { SpreadPageCluster } from '@/components/books/spread-page-cluster'
import { seamClientX } from '@/lib/books/spread-stroke-split'
import { loadCachedPdfDocument } from '@/lib/books/pdf-thumbnail-cache'
import {
  spreadMarkerSpreadOverlayFallbackEnabled,
  spreadSessionEditingEnabled,
  pageViewPoolEnabled,
} from '@/lib/books/feature-flags'
import type { UnitPageBounds } from '@/lib/books/page-range'
import { createSpreadSessionStore } from '@/lib/books/spread-session-store'
import type { SpreadSessionDocument } from '@/lib/books/spread-session-types'
import {
  hydrateSpreadSessionFromOwnerPages,
  mapCommandPageToSpread,
  mergeSpreadSessionPageOwnedFromOwnerPages,
} from '@/lib/books/spread-session-commit'
import { nextCalloutIndex } from '@/components/students/book-page-annotation-layer/helpers'
import { getAnnotationsForPage } from '@/lib/books/annotation-storage'
import { SPREAD_SESSION_FLUSH_EVENT } from '@/lib/books/spread-session-events'
import { INK_SESSION_AUTOSAVE_MS } from '@/lib/books/ink-session-persist-config'
import { flushSpreadSessionDocumentToPageStorage } from '@/lib/books/spread-session-persist'
import type { SpreadInkLayout } from '@/lib/books/spread-stroke-split'
import { useSpreadSessionPersistGuards } from '@/components/students/fullscreen-book-overlay/hooks/useSpreadSessionPersistGuards'
import type { SpreadSessionDomConfig } from '@/components/students/fullscreen-book-overlay/hooks/useSpreadSessionDomInteraction'
import type {
  StickyAnnotationCommand,
  TextAnnotationCommand,
} from '@/lib/books/annotation-command-types'
import { isBookOverlayKeyboardTypingTarget } from '@/lib/books/book-overlay-keyboard-guards'
import { commitRotatedAnnotationCommands } from '@/lib/books/annotation-rotation'
import { scaleAnnotationCommandsFromOrientedFrames } from '@/lib/books/annotation-scale'
import type { OrientedSelectionFrame } from '@/lib/books/annotation-select'
import { cn } from '@/lib/utils'
import { InfiniteWhiteboardPanel } from '@/components/students/fullscreen-book-overlay/sections/InfiniteWhiteboardPanel'
import { WhiteboardCollapsedTab } from '@/components/students/fullscreen-book-overlay/sections/WhiteboardCollapsedTab'
import { WHITEBOARD_EYEDROPER_PAGE } from '@/lib/books/whiteboard-storage'
import {
  WHITEBOARD_HEADER_HEIGHT_PX,
  WHITEBOARD_SLOT_INSET_PX,
} from '@/components/students/fullscreen-book-overlay/constants'
import {
  getLessonBoardActivePage,
  lessonBoardLogicalWidthPx,
  lessonBoardUsesSpreadPresentation,
  type LessonBoardPageOrientation,
} from '@/lib/books/lesson-board-types'
import type { WhiteboardSlotMotionApi } from '@/components/students/fullscreen-book-overlay/hooks/useWhiteboardSlotMotion'
import type {
  WhiteboardLayoutMode,
  WhiteboardSlotSide,
} from '@/components/students/fullscreen-book-overlay/hooks/useWhiteboardPlacement'
import { useWhiteboardFloatMotion } from '@/components/students/fullscreen-book-overlay/hooks/useWhiteboardFloatMotion'
import {
  lessonBoardWidePanelAnchorPx,
  lessonBoardWidePanelHeightPx,
  lessonBoardWideSpreadWidthPx as resolveLessonBoardWideSpreadWidthPx,
} from '@/lib/books/lesson-board-ink-layout'
import {
  defaultLessonBoardFloatRect,
  lessonBoardFloatDisplayMetrics,
  type LessonBoardFloatRect,
} from '@/lib/books/lesson-board-float-layout'

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
  setWhiteboardSlotSide: (side: WhiteboardSlotSide) => void
  applyWhiteboardSlotSide: (side: WhiteboardSlotSide) => void
  registerWhiteboardSlotMotion: (api: WhiteboardSlotMotionApi | null) => void
  /** PDF export only — single-page capture layout; does not affect spread ink routing. */
  exportCaptureLayoutActive: boolean
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
  stickerKind?: import('@/lib/books/sticker-tool').StickerKind
  writableStickerVariant?: import('@/lib/books/annotation-command-types').WritableStickerVariant
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
  shapeRoundedCorners?: boolean
  textFontSizeNorm: number
  textFontId: import('@/lib/books/annotation-text-fonts').AnnotationTextFontId
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
  whiteboardSlotSide: WhiteboardSlotSide
  whiteboardLayoutMode: WhiteboardLayoutMode
  whiteboardFloatRect: LessonBoardFloatRect | null
  floatWhiteboard: (slotLeftPx: number, slotTopPx: number) => void
  dockWhiteboardToSlot: () => void
  forceDockWhiteboard: () => void
  commitWhiteboardFloatRect: (rect: LessonBoardFloatRect) => void
  whiteboardContentHeightPx: number
  extendWhiteboardRunway: () => void
  createLessonBoardPage?: (orientation: LessonBoardPageOrientation) => void
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
  whiteboardSelectionMoveClampRef?: MutableRefObject<
    import('@/lib/books/annotation-scale').SelectionMoveClampContext | null
  >
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
  setWhiteboardSlotSide,
  applyWhiteboardSlotSide,
  registerWhiteboardSlotMotion,
  exportCaptureLayoutActive,
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
  stickerKind = 'quick',
  writableStickerVariant = 'note',
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
  shapeRoundedCorners = true,
  textFontSizeNorm,
  textFontId,
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
  whiteboardSlotSide,
  whiteboardLayoutMode,
  whiteboardFloatRect,
  floatWhiteboard,
  dockWhiteboardToSlot,
  forceDockWhiteboard,
  commitWhiteboardFloatRect,
  whiteboardContentHeightPx,
  extendWhiteboardRunway,
  createLessonBoardPage,
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
  whiteboardSelectionMoveClampRef,
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
    if (exportCaptureLayoutActive) {
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
  }, [exportCaptureLayoutActive, showSpreadRightPage, spreadRightPage, onSpreadSlotsPixelsReady])

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
  }, [spreadReportEpoch, exportCaptureLayoutActive, pageNumber, spreadRightPage])

  const useStablePageViewPool = pageViewPoolEnabled && selectedUnitId != null

  const handlePoolSlotPixelsReady = useCallback(
    (_readyPage: number, side: 'left' | 'right') => {
      if (side === 'left') {
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
  const lessonBoardActivePage = whiteboardSessionDoc
    ? getLessonBoardActivePage(whiteboardSessionDoc.pages, whiteboardSessionDoc.activePageId)
    : null
  const lessonBoardWideActive = lessonBoardUsesSpreadPresentation(
    lessonBoardActivePage?.orientation ?? 'standard',
  )
  const whiteboardWideSpreadPresented = whiteboardActive && lessonBoardWideActive
  const whiteboardStandardActive = whiteboardActive && !lessonBoardWideActive
  const whiteboardInSlot = whiteboardStandardActive && whiteboardLayoutMode === 'slot'
  const whiteboardFloating =
    whiteboardStandardActive && whiteboardLayoutMode === 'floating'
  const boardOnLeft = whiteboardSlotSide === 'left'
  const whiteboardSlotPanelWidthPx = Math.max(1, spreadPageWidth - WHITEBOARD_SLOT_INSET_PX * 2)
  const whiteboardSlotPanelHeightPx = Math.max(1, pageCanvasHeightPx - WHITEBOARD_SLOT_INSET_PX * 2)
  const wideSpreadLogicalWidthPx = resolveLessonBoardWideSpreadWidthPx(
    spreadOverlayWidthPx,
    WHITEBOARD_SLOT_INSET_PX,
  )
  const lessonBoardLogicalCanvasWidthPx = lessonBoardActivePage
    ? lessonBoardLogicalWidthPx(lessonBoardActivePage, {
        slotWidthPx: whiteboardSlotPanelWidthPx,
        spreadWidthPx: wideSpreadLogicalWidthPx,
      })
    : whiteboardSlotPanelWidthPx

  const lessonBoardNaturalPanelWidthPx = lessonBoardWideActive
    ? lessonBoardLogicalCanvasWidthPx
    : whiteboardSlotPanelWidthPx
  const lessonBoardNaturalPanelHeightPx = lessonBoardWideActive
    ? lessonBoardWidePanelHeightPx(
        whiteboardContentHeightPx,
        WHITEBOARD_HEADER_HEIGHT_PX,
      )
    : whiteboardSlotPanelHeightPx
  const lessonBoardWideAnchorPx = lessonBoardWideActive
    ? lessonBoardWidePanelAnchorPx(
        spreadOverlayWidthPx,
        pageCanvasHeightPx,
        lessonBoardNaturalPanelWidthPx,
        lessonBoardNaturalPanelHeightPx,
        WHITEBOARD_SLOT_INSET_PX,
      )
    : null

  const boardSlotLeftPx = boardOnLeft ? 0 : Math.max(0, Math.round(spreadPageWidth - gutterPullPx))
  const slotAnchorLeftPx = boardSlotLeftPx + WHITEBOARD_SLOT_INSET_PX
  const slotAnchorTopPx = WHITEBOARD_SLOT_INSET_PX
  const floatBoundsWidthPx = spreadOverlayWidthPx
  const floatBoundsHeightPx = pageCanvasHeightPx
  const resolvedFloatRect =
    whiteboardFloatRect ??
    defaultLessonBoardFloatRect(slotAnchorLeftPx, slotAnchorTopPx)
  const whiteboardFloatMetrics = whiteboardFloating
    ? lessonBoardFloatDisplayMetrics(
        whiteboardSlotPanelWidthPx,
        whiteboardSlotPanelHeightPx,
        whiteboardContentHeightPx,
        resolvedFloatRect.scale,
        WHITEBOARD_HEADER_HEIGHT_PX,
      )
    : null

  useEffect(() => {
    if (lessonBoardWideActive && whiteboardLayoutMode === 'floating') {
      forceDockWhiteboard()
    }
  }, [forceDockWhiteboard, lessonBoardWideActive, whiteboardLayoutMode])

  const {
    onFloatDragPointerDown,
    onFloatDragPointerMove,
    onFloatDragPointerUp,
    onFloatDragPointerCancel,
    onFloatResizePointerDown,
    onFloatResizePointerMove,
    onFloatResizePointerUp,
    onFloatResizePointerCancel,
  } = useWhiteboardFloatMotion({
    rect: resolvedFloatRect,
    naturalWidthPx: whiteboardSlotPanelWidthPx,
    naturalHeightPx: whiteboardSlotPanelHeightPx,
    boundsWidthPx: floatBoundsWidthPx,
    boundsHeightPx: floatBoundsHeightPx,
    enabled: whiteboardFloating,
    onCommitRect: commitWhiteboardFloatRect,
  })

  const whiteboardPanelWidthPx =
    whiteboardFloatMetrics?.panelWidthPx ?? lessonBoardNaturalPanelWidthPx
  const whiteboardPanelHeightPx =
    whiteboardFloatMetrics?.panelHeightPx ?? lessonBoardNaturalPanelHeightPx

  const handleFloatWhiteboard = useCallback(() => {
    floatWhiteboard(slotAnchorLeftPx, slotAnchorTopPx)
  }, [floatWhiteboard, slotAnchorLeftPx, slotAnchorTopPx])

  const renderWhiteboardPanel = () => {
    if (!whiteboardStorageKey || !selectedBookId || !selectedUnitId) return null
    return (
      <InfiniteWhiteboardPanel
        key="lesson-session-whiteboard"
        studentId={studentId}
        bookId={selectedBookId}
        unitId={selectedUnitId}
        widthPx={whiteboardPanelWidthPx}
        logicalCanvasWidthPx={lessonBoardLogicalCanvasWidthPx}
        viewportHeightPx={whiteboardPanelHeightPx}
        contentHeightPx={whiteboardContentHeightPx}
        storagePageKey={whiteboardStorageKey}
        surfaceStyle={WHITEBOARD_NOTEBOOK_SURFACE}
        slotSide={whiteboardSlotSide}
        layoutMode={whiteboardLayoutMode}
        floatDisplayContentHeightPx={whiteboardFloatMetrics?.displayContentHeightPx}
        onFloat={whiteboardLayoutMode === 'slot' ? handleFloatWhiteboard : undefined}
        onDock={whiteboardLayoutMode === 'floating' ? dockWhiteboardToSlot : undefined}
        onFloatDragPointerDown={onFloatDragPointerDown}
        onFloatDragPointerMove={onFloatDragPointerMove}
        onFloatDragPointerUp={onFloatDragPointerUp}
        onFloatDragPointerCancel={onFloatDragPointerCancel}
        onFloatResizePointerDown={onFloatResizePointerDown}
        onFloatResizePointerMove={onFloatResizePointerMove}
        onFloatResizePointerUp={onFloatResizePointerUp}
        onFloatResizePointerCancel={onFloatResizePointerCancel}
        wbAnnRef={wbAnnRef}
        wbStrokeOverlayRef={wbStrokeOverlayRef}
        whiteboardSessionStoreRef={whiteboardSessionStoreRef}
        selectionMoveClampRef={whiteboardSelectionMoveClampRef}
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
        onNewLessonBoardPage={createLessonBoardPage}
        setSlotSide={applyWhiteboardSlotSide}
        slotTravelPx={Math.max(0, Math.round(spreadPageWidth - gutterPullPx))}
        registerSlotMotion={registerWhiteboardSlotMotion}
        onMinimize={onMinimizeWhiteboard}
        suppressChrome={suppressChrome}
        deferHeaderChromeActions={whiteboardPanelObscured}
        mode={annotationMode}
        eyedropperVariant={eyedropperVariant}
        stickerKind={stickerKind}
        writableStickerVariant={writableStickerVariant}
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
        shapeRoundedCorners={shapeRoundedCorners}
        textFontSizeNorm={textFontSizeNorm}
        textFontId={textFontId}
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

  const renderWhiteboardWideSpreadOverlay = () => {
    if (!whiteboardWideSpreadPresented || !lessonBoardWideAnchorPx) return null
    return (
      <>
        <div className="pointer-events-none absolute inset-0 z-[31] bg-black/35" aria-hidden />
        <div
          ref={whiteboardPanelAnchorRef}
          className={cn(
            'pointer-events-none absolute inset-0 z-[38]',
            whiteboardPanelObscured && 'invisible opacity-0',
          )}
        >
          <div
            className={cn(
              'pointer-events-auto absolute',
              whiteboardPanelObscured && 'pointer-events-none',
            )}
            style={{
              left: lessonBoardWideAnchorPx.leftPx,
              top: lessonBoardWideAnchorPx.topPx,
            }}
          >
            {renderWhiteboardPanel()}
          </div>
        </div>
      </>
    )
  }

  const renderWhiteboardStandardAnchor = () => {
    if (!whiteboardStandardActive) return null

    if (whiteboardFloating && whiteboardFloatMetrics) {
      return (
        <div
          ref={whiteboardPanelAnchorRef}
          className={cn(
            'pointer-events-none absolute inset-0 isolate z-[38] overflow-visible',
            whiteboardPanelObscured && 'invisible opacity-0',
          )}
        >
          <div
            className={cn(
              'pointer-events-auto absolute',
              whiteboardPanelObscured && 'pointer-events-none',
            )}
            style={{
              left: resolvedFloatRect.leftPx,
              top: resolvedFloatRect.topPx,
              width: whiteboardFloatMetrics.panelWidthPx,
              height: whiteboardFloatMetrics.panelHeightPx,
            }}
          >
            {renderWhiteboardPanel()}
          </div>
        </div>
      )
    }

    if (!whiteboardInSlot) return null

    return (
      <div
        ref={whiteboardPanelAnchorRef}
        className={cn(
          'pointer-events-none absolute isolate z-[38] overflow-visible',
          whiteboardPanelObscured && 'invisible opacity-0',
        )}
        style={{
          left: slotAnchorLeftPx,
          top: slotAnchorTopPx,
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
    )
  }

  const localSpreadGridRef = useRef<HTMLDivElement | null>(null)
  const spreadGridRef = spreadTurnGridRef ?? localSpreadGridRef
  const [leftPenInkPatternOriginXPx, setLeftPenInkPatternOriginXPx] = useState(0)
  const [rightPenInkPatternOriginXPx, setRightPenInkPatternOriginXPx] = useState(0)
  const [spreadSeamNormX, setSpreadSeamNormX] = useState(0.5)
  const localSpreadSessionStoreRef = useRef<ReturnType<typeof createSpreadSessionStore> | null>(null)
  const spreadSessionStoreRef = spreadSessionStoreRefProp ?? localSpreadSessionStoreRef
  const [spreadEraserLineDraft, setSpreadEraserLineDraft] = useState<LiveEraserLineDraft | null>(null)
  const [spreadMarkerStrokeDraft, setSpreadMarkerStrokeDraft] = useState<LiveStrokeDraft | null>(null)
  const [spreadSessionDoc, setSpreadSessionDoc] = useState<SpreadSessionDocument | null>(null)
  const spreadSessionDocRef = useRef<SpreadSessionDocument | null>(null)
  const [spreadSessionSelectedIds, setSpreadSessionSelectedIds] = useState<string[]>([])
  const [spreadSessionNudgePreview, setSpreadSessionNudgePreview] = useState<{
    dx: number
    dy: number
  } | null>(null)
  const spreadSessionKeyRef = useRef<{ leftPage: number; rightPage: number } | null>(null)
  const spreadSelectionMoveClampRef = useRef({ widthPx: 0, heightPx: 0 })
  spreadSelectionMoveClampRef.current = {
    widthPx: spreadOverlayWidthPx,
    heightPx: spreadOverlayHeightPx,
  }
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

  const spreadInkLayout = useMemo<SpreadInkLayout>(
    () => ({
      spreadOverlayWidthPx,
      spreadPageWidthPx: spreadPageWidth,
      leftPageOriginXPx: leftPenInkPatternOriginXPx,
      rightPageOriginXPx: rightPenInkPatternOriginXPx,
      seamNormX: spreadSeamNormX,
    }),
    [
      spreadOverlayWidthPx,
      spreadPageWidth,
      leftPenInkPatternOriginXPx,
      rightPenInkPatternOriginXPx,
      spreadSeamNormX,
    ],
  )

  const spreadSessionLayoutSnapshotRef = useRef<{
    key: { leftPage: number; rightPage: number }
    layout: SpreadInkLayout
  } | null>(null)
  const [spreadInkLayoutRevision, setSpreadInkLayoutRevision] = useState(0)

  const spreadSessionActive = useMemo(
    () =>
      Boolean(
        spreadSessionModeEnabled &&
          selectedBookId &&
          selectedUnitId,
      ),
    [selectedBookId, selectedUnitId, spreadSessionModeEnabled],
  )

  const sessionRightPage = spreadRightPage ?? pageNumber
  const activeSpreadSessionKey = spreadSessionKeyRef.current
  if (
    spreadSessionActive &&
    activeSpreadSessionKey &&
    activeSpreadSessionKey.leftPage === pageNumber &&
    activeSpreadSessionKey.rightPage === sessionRightPage
  ) {
    spreadSessionLayoutSnapshotRef.current = {
      key: { ...activeSpreadSessionKey },
      layout: spreadInkLayout,
    }
  }

  const measurePenInkPatternOrigins = useCallback(() => {
    const spread = spreadGridRef.current?.getBoundingClientRect()
    const left = leftPageCaptureRef.current?.getBoundingClientRect()
    const right = rightPageCaptureRef.current?.getBoundingClientRect()
    if (!spread || !(spreadOverlayWidthPx > 0)) return
    const scale = spreadDisplayScale > 0 ? spreadDisplayScale : 1
    if (left) setLeftPenInkPatternOriginXPx((left.left - spread.left) / scale)
    if (right) {
      setRightPenInkPatternOriginXPx((right.left - spread.left) / scale)
      const seamClient = seamClientX(left!, right)
      setSpreadSeamNormX((seamClient - spread.left) / scale / spreadOverlayWidthPx)
    } else if (left) {
      const syntheticRightOrigin = spreadPageWidth - gutterPullPx
      setRightPenInkPatternOriginXPx(syntheticRightOrigin)
      setSpreadSeamNormX(Math.max(0, Math.min(1, syntheticRightOrigin / spreadOverlayWidthPx)))
    }
    setSpreadInkLayoutRevision((r) => r + 1)
  }, [
    gutterPullPx,
    leftPageCaptureRef,
    rightPageCaptureRef,
    spreadDisplayScale,
    spreadOverlayWidthPx,
    spreadPageWidth,
  ])

  useLayoutEffect(() => {
    if (exportCaptureLayoutActive) {
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
    exportCaptureLayoutActive,
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
        (spreadRightPage != null
          ? { leftPage: pageNumber, rightPage: spreadRightPage }
          : { leftPage: pageNumber, rightPage: pageNumber })
      if (!doc || !selectedBookId || !selectedUnitId || !pages) return
      const layoutSnapshot = spreadSessionLayoutSnapshotRef.current
      const layout =
        layoutSnapshot &&
        layoutSnapshot.key.leftPage === pages.leftPage &&
        layoutSnapshot.key.rightPage === pages.rightPage
          ? layoutSnapshot.layout
          : spreadInkLayoutRef.current
      flushSpreadSessionDocumentToPageStorage({
        doc,
        key: pages,
        layout,
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
    if (!spreadSessionActive || !selectedBookId || !selectedUnitId) {
      setSpreadSessionDoc(null)
      spreadSessionDocRef.current = null
      setSpreadSessionSelectedIds([])
      spreadSessionKeyRef.current = null
      return
    }

    const resolvedRightPage = spreadRightPage ?? pageNumber

    const store = createSpreadSessionStore(
      {
        studentId,
        bookId: selectedBookId,
        unitId: selectedUnitId,
        leftPage: pageNumber,
        rightPage: resolvedRightPage,
      },
      {
        autosaveMs: INK_SESSION_AUTOSAVE_MS,
        getSelectionMoveClamp: () => {
          const { widthPx, heightPx } = spreadSelectionMoveClampRef.current
          if (!(widthPx > 0) || !(heightPx > 0)) return null
          return { widthPx, heightPx }
        },
      },
    )
    spreadSessionStoreRef.current = store
    spreadSessionKeyRef.current = { leftPage: pageNumber, rightPage: resolvedRightPage }

    const layout = spreadInkLayoutRef.current
    spreadSessionLayoutSnapshotRef.current = {
      key: { leftPage: pageNumber, rightPage: resolvedRightPage },
      layout,
    }
    const leftStored = getAnnotationsForPage(studentId, selectedBookId, selectedUnitId, pageNumber, 'pdf')
    const rightStored =
      spreadRightPage != null
        ? getAnnotationsForPage(
            studentId,
            selectedBookId,
            selectedUnitId,
            spreadRightPage,
            'pdf',
          )
        : []
    const initialCommands = store.getState().doc.commands
    let commands =
      initialCommands.length === 0
        ? hydrateSpreadSessionFromOwnerPages(leftStored, rightStored, layout)
        : mergeSpreadSessionPageOwnedFromOwnerPages(
            initialCommands,
            leftStored,
            rightStored,
            layout,
          )
    store.syncCommands(commands)
    store.markClean()
    store.checkpointNow()
    const initialState = store.getState()
    setSpreadSessionDoc(initialState.doc)
    spreadSessionDocRef.current = initialState.doc
    setSpreadSessionSelectedIds(initialState.selectedIds)
    setSpreadSessionNudgePreview(initialState.nudgePreview)
    let lastOverlayCaps = {
      canUndo: initialState.canUndo,
      canRedo: initialState.canRedo,
    }
    const unsub = store.subscribe((state) => {
      setSpreadSessionDoc(state.doc)
      spreadSessionDocRef.current = state.doc
      setSpreadSessionSelectedIds(state.selectedIds)
      setSpreadSessionNudgePreview(state.nudgePreview)
      if (
        state.canUndo !== lastOverlayCaps.canUndo ||
        state.canRedo !== lastOverlayCaps.canRedo
      ) {
        lastOverlayCaps = { canUndo: state.canUndo, canRedo: state.canRedo }
        onSpreadOverlayCaps(lastOverlayCaps)
      }
    })
    return () => {
      unsub()
      const doc = spreadSessionDocRef.current
      const pages = spreadSessionKeyRef.current
      if (doc && pages) {
        store.checkpointNow()
        const layoutSnapshot = spreadSessionLayoutSnapshotRef.current
        const layout =
          layoutSnapshot &&
          layoutSnapshot.key.leftPage === pages.leftPage &&
          layoutSnapshot.key.rightPage === pages.rightPage
            ? layoutSnapshot.layout
            : spreadInkLayoutRef.current
        flushSpreadSessionDocumentToPageStorage({
          doc,
          key: pages,
          layout,
          studentId,
          bookId: selectedBookId,
          unitId: selectedUnitId,
        })
      }
      store.destroy()
      if (spreadSessionStoreRef.current === store) spreadSessionStoreRef.current = null
      spreadSessionDocRef.current = null
      spreadSessionKeyRef.current = null
      const layoutSnapshot = spreadSessionLayoutSnapshotRef.current
      if (
        pages &&
        layoutSnapshot &&
        layoutSnapshot.key.leftPage === pages.leftPage &&
        layoutSnapshot.key.rightPage === pages.rightPage
      ) {
        spreadSessionLayoutSnapshotRef.current = null
      }
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

  const appendSpreadSessionCommand = useCallback(
    (cmd: AnnotationCommand) => {
      const store = spreadSessionStoreRef.current
      if (!store) return
      if (penAutoGroupConnected && cmd.kind === 'stroke' && cmd.tool === 'pen') {
        store.patchCommands((commands) =>
          appendCommandWithPenAutoGroup(commands, cmd, {
            penAutoGroupConnected: true,
            widthPx: spreadOverlayWidthPx,
            heightPx: spreadOverlayHeightPx,
          }),
        )
        return
      }
      store.appendCommand(cmd)
    },
    [penAutoGroupConnected, spreadOverlayHeightPx, spreadOverlayWidthPx],
  )

  const spreadSessionUndo = useCallback(() => spreadSessionStoreRef.current?.undo() ?? false, [])

  const spreadSessionRedo = useCallback(() => spreadSessionStoreRef.current?.redo() ?? false, [])

  const spreadSessionClear = useCallback(() => {
    spreadSessionStoreRef.current?.clearCommands()
  }, [])

  const spreadInkDelegated =
    spreadSessionModeEnabled &&
    !whiteboardActive &&
    !exportCaptureLayoutActive &&
    selectedBookId != null &&
    selectedUnitId != null

  const spreadDomToolsDelegated =
    spreadInkDelegated &&
    (annotationMode === 'text' || isWritableStickerInteraction(annotationMode, stickerKind))
  const delegatePointerToSpreadPageLayer =
    spreadStrokeCaptureEnabled || spreadDomToolsDelegated

  const commitPageCanvasCommandToSpread = useCallback(
    (cmd: AnnotationCommand, ownerPage: number) => {
      if (!spreadInkDelegated) return
      const side = ownerPage === pageNumber ? 'left' : 'right'
      let resolved = cmd
      if (cmd.kind === 'callout') {
        const spreadCmds = spreadSessionStoreRef.current?.getState().doc.commands ?? []
        resolved = { ...cmd, index: nextCalloutIndex(spreadCmds) }
      }
      appendSpreadSessionCommand(mapCommandPageToSpread(resolved, side, spreadInkLayout))
    },
    [
      appendSpreadSessionCommand,
      pageNumber,
      spreadInkDelegated,
      spreadInkLayout,
      spreadSessionStoreRef,
    ],
  )

  const setSpreadSessionSelected = useCallback((ids: string[]) => {
    if (!spreadSessionModeEnabled) return
    spreadSessionStoreRef.current?.setSelectedIds(ids)
  }, [spreadSessionModeEnabled])

  const patchSpreadSessionCommand = useCallback(
    (id: string, partial: Partial<TextAnnotationCommand | StickyAnnotationCommand>) => {
      spreadSessionStoreRef.current?.patchCommands((cmds) =>
        cmds.map((c) => (c.id === id ? ({ ...c, ...partial } as AnnotationCommand) : c)),
      )
    },
    [],
  )

  const deleteSpreadSessionCommand = useCallback((id: string) => {
    const store = spreadSessionStoreRef.current
    if (!store) return
    store.patchCommands((cmds) => cmds.filter((c) => c.id !== id))
    const remaining = store.getState().selectedIds.filter((sid) => sid !== id)
    if (remaining.length !== store.getState().selectedIds.length) {
      store.setSelectedIds(remaining)
    }
  }, [])

  const spreadDomConfig = useMemo((): SpreadSessionDomConfig | null => {
    if (!spreadInkDelegated || !spreadSessionDoc) return null
    return {
      enabled: true,
      mode: annotationMode,
      stickerKind,
      writableStickerVariant,
      textColor: textColorResolved,
      textFontSizeNorm,
      textFontId,
      textVisualStyle,
      textFillColor,
      stickyFillColor,
      stickyFontSizeNorm,
      defaultStickyWNorm: 0.22,
      defaultStickyHNorm: 0.11,
      commands: spreadSessionDoc.commands,
      widthPx: spreadOverlayWidthPx,
      heightPx: spreadOverlayHeightPx,
      selectEnabled: annotationMode === 'select' && !whiteboardActive,
      selectedIds: spreadSessionSelectedIds,
      onAppendCommand: appendSpreadSessionCommand,
      onPatchCommand: patchSpreadSessionCommand,
      onDeleteText: deleteSpreadSessionCommand,
      onDeleteSticky: deleteSpreadSessionCommand,
      onSelectedIdsChange: setSpreadSessionSelected,
    }
  }, [
    annotationMode,
    stickerKind,
    writableStickerVariant,
    appendSpreadSessionCommand,
    deleteSpreadSessionCommand,
    patchSpreadSessionCommand,
    setSpreadSessionSelected,
    spreadInkDelegated,
    spreadOverlayHeightPx,
    spreadOverlayWidthPx,
    spreadSessionDoc,
    spreadSessionSelectedIds,
    stickyFillColor,
    stickyFontSizeNorm,
    textColorResolved,
    textFillColor,
    textFontId,
    textFontSizeNorm,
    textVisualStyle,
    whiteboardActive,
  ])

  const moveSpreadSessionSelected = useCallback((dx: number, dy: number) => {
    if (!spreadSessionModeEnabled) return
    spreadSessionStoreRef.current?.moveSelectedBy(dx, dy)
  }, [spreadSessionModeEnabled])

  const scaleSpreadSessionSelected = useCallback(
    (startFrame: OrientedSelectionFrame, newFrame: OrientedSelectionFrame) => {
      const store = spreadSessionStoreRef.current
      if (!store) return
      const ids = new Set(store.getState().selectedIds)
      if (ids.size === 0) return
      store.patchCommands((cmds) =>
        scaleAnnotationCommandsFromOrientedFrames(
          cmds,
          ids,
          startFrame,
          newFrame,
          spreadOverlayWidthPx,
          spreadOverlayHeightPx,
        ),
      )
    },
    [spreadOverlayWidthPx, spreadOverlayHeightPx],
  )

  const rotateSpreadSessionSelected = useCallback(
    (
      pivot: [number, number],
      deltaRad: number,
      ids: string[],
      previewBase?: readonly AnnotationCommand[] | null,
      groupRotationFrame?: OrientedSelectionFrame | null,
    ) => {
      const store = spreadSessionStoreRef.current
      if (!store || ids.length === 0 || Math.abs(deltaRad) < 1e-6) return
      const layout = { widthPx: spreadOverlayWidthPx, heightPx: spreadOverlayHeightPx }
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
    [spreadOverlayWidthPx, spreadOverlayHeightPx],
  )

  const mirrorLeftSelectionMoveToRight = useCallback((ids: string[], dx: number, dy: number) => {
    if (spreadSessionModeEnabled && spreadSessionStoreRef.current) {
      const spreadCmdIds = new Set(
        spreadSessionStoreRef.current.getState().doc.commands.map((c) => c.id),
      )
      const spreadIds = ids.filter((id) => spreadCmdIds.has(id))
      if (spreadIds.length > 0) {
        spreadSessionStoreRef.current.moveSelectedBy(dx, dy)
      }
    }
    rightAnnRef.current?.translateByIds?.(ids, dx, dy)
  }, [rightAnnRef])

  const mirrorRightSelectionMoveToLeft = useCallback((ids: string[], dx: number, dy: number) => {
    if (spreadSessionModeEnabled && spreadSessionStoreRef.current) {
      const spreadCmdIds = new Set(
        spreadSessionStoreRef.current.getState().doc.commands.map((c) => c.id),
      )
      const spreadIds = ids.filter((id) => spreadCmdIds.has(id))
      if (spreadIds.length > 0) {
        spreadSessionStoreRef.current.moveSelectedBy(dx, dy)
      }
    }
    leftAnnRef.current?.translateByIds?.(ids, dx, dy)
  }, [leftAnnRef])

  const renderSpreadPageMarkerLayer = useCallback(
    (side: 'left' | 'right') => {
      if (spreadMarkerSpreadOverlayFallbackEnabled) return null
      if (!spreadSessionModeEnabled || !spreadSessionDoc || !spreadInkDelegated) return null
      return (
        <BookSpreadPageMarkerLayer
          side={side}
          widthPx={spreadPageWidth}
          heightPx={pageCanvasHeightPx}
          commands={spreadSessionDoc.commands}
          layout={spreadInkLayout}
          layoutMeasureRevision={spreadInkLayoutRevision}
          leftPageCaptureRef={leftPageCaptureRef}
          rightPageCaptureRef={rightPageCaptureRef}
          trailingMarkerStrokeDraft={spreadMarkerStrokeDraft}
        />
      )
    },
    [
      spreadSessionModeEnabled,
      spreadSessionDoc,
      spreadInkDelegated,
      spreadPageWidth,
      pageCanvasHeightPx,
      spreadMarkerStrokeDraft,
      spreadInkLayout,
      spreadInkLayoutRevision,
      leftPageCaptureRef,
      rightPageCaptureRef,
    ],
  )

  const renderPoolPageChrome = useCallback(
    ({ pageNumber: poolPage, slotRole }: PageViewPoolRenderContext) => {
      if (!selectedBookId || !selectedUnitId) return null
      const isLeft = slotRole === 'left'
      const isRight = slotRole === 'right'
      return (
        <>
          {slotRole === 'left' ? renderSpreadPageMarkerLayer('left') : null}
          {slotRole === 'right' ? renderSpreadPageMarkerLayer('right') : null}
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
          stickerKind={stickerKind}
          writableStickerVariant={writableStickerVariant}
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
        shapeRoundedCorners={shapeRoundedCorners}
          textFontSizeNorm={textFontSizeNorm}
          textFontId={textFontId}
          textVisualStyle={textVisualStyle}
          textFillColor={textFillColor}
          stickyFillColor={stickyFillColor}
          stickyFontSizeNorm={stickyFontSizeNorm}
          defaultStickyWNorm={0.22}
          defaultStickyHNorm={0.11}
          onPointerSessionStart={() => setAnnotationTargetPage(poolPage)}
          onEyedropperPick={eyedropperForPage(poolPage)}
          onCapabilitiesChange={isLeft ? onLeftAnnotationCaps : isRight ? onRightAnnotationCaps : undefined}
          delegatePointerToSpread={delegatePointerToSpreadPageLayer}
          spreadInkDelegated={spreadInkDelegated}
          onSelectionMoveCommitted={
            isLeft ? mirrorLeftSelectionMoveToRight : isRight ? mirrorRightSelectionMoveToLeft : undefined
          }
          onSpreadCanvasCommandCommit={
            spreadInkDelegated ? commitPageCanvasCommandToSpread : undefined
          }
        />
        </>
      )
    },
    [
      annotationMode,
      commitPageCanvasCommandToSpread,
      renderSpreadPageMarkerLayer,
      spreadInkDelegated,
      eyedropperForPage,
      eyedropperVariant,
      eraserLineStrokeWidthScale,
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
      shapeRoundedCorners,
      shapeLineDashStyle,
      shapeStrokeEnabled,
      shapeStrokeWidthScale,
      spreadPageWidth,
      delegatePointerToSpreadPageLayer,
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
  textFontId,
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
      {spreadMarkerSpreadOverlayFallbackEnabled &&
      spreadSessionModeEnabled &&
      spreadSessionDoc &&
      spreadInkDelegated ? (
        <BookSpreadMarkerSpreadOverlay
          spreadOverlayWidthPx={spreadOverlayWidthPx}
          spreadPageWidthPx={spreadPageWidth}
          pageCanvasHeightPx={pageCanvasHeightPx}
          layout={spreadInkLayout}
          layoutMeasureRevision={spreadInkLayoutRevision}
          commands={spreadSessionDoc.commands}
          leftPageCaptureRef={leftPageCaptureRef}
          rightPageCaptureRef={rightPageCaptureRef}
          trailingMarkerStrokeDraft={spreadMarkerStrokeDraft}
        />
      ) : null}
      {spreadSessionModeEnabled && spreadSessionDoc ? (
        <BookSpreadSessionLayer
          widthPx={spreadOverlayWidthPx}
          heightPx={spreadOverlayHeightPx}
          commands={spreadSessionDoc.commands}
          trailingEraserLineDraft={spreadEraserLineDraft}
          selectEnabled={annotationMode === 'select' && !whiteboardActive}
          selectedIds={spreadSessionSelectedIds}
          nudgePreview={spreadSessionNudgePreview}
          onSelectedIdsChange={setSpreadSessionSelected}
          onMoveSelectedBy={moveSpreadSessionSelected}
          onScaleSelectedBy={scaleSpreadSessionSelected}
          onRotateSelectedBy={rotateSpreadSessionSelected}
          domConfig={spreadDomConfig}
        />
      ) : null}
      {!whiteboardActive && selectedBookId && selectedUnitId ? (
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
        shapeRoundedCorners={shapeRoundedCorners}
          pageNumberLeft={pageNumber}
          pageNumberRight={sessionRightPage}
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
          spreadSessionCommands={spreadSessionDoc?.commands ?? []}
          onSpreadSessionAppendCommand={appendSpreadSessionCommand}
          spreadSessionUndo={spreadSessionUndo}
          spreadSessionRedo={spreadSessionRedo}
          spreadSessionClear={spreadSessionClear}
          onSpreadEraserLineDraftChange={setSpreadEraserLineDraft}
          onSpreadMarkerStrokeDraftChange={setSpreadMarkerStrokeDraft}
        />
      ) : null}
      {renderWhiteboardStandardAnchor()}
      {renderWhiteboardWideSpreadOverlay()}
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
              )}
              style={{
                transform: spreadDisplayScale !== 1 ? `scale(${spreadDisplayScale})` : undefined,
                transformOrigin: 'center center',
              }}
            >
              {exportCaptureLayoutActive ? (
                useStablePageViewPool ? (
                  <SpreadStage
                    {...poolStageCommonProps}
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
                          stickerKind={stickerKind}
                          writableStickerVariant={writableStickerVariant}
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
        shapeRoundedCorners={shapeRoundedCorners}
                          textFontSizeNorm={textFontSizeNorm}
                          textFontId={textFontId}
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
              ) : useStablePageViewPool ? (
                <SpreadStage
                  {...poolStageCommonProps}
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
                            <>
                              {renderSpreadPageMarkerLayer('left')}
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
                              stickerKind={stickerKind}
                              writableStickerVariant={writableStickerVariant}
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
        shapeRoundedCorners={shapeRoundedCorners}
                              textFontSizeNorm={textFontSizeNorm}
                              textFontId={textFontId}
                              textVisualStyle={textVisualStyle}
                              textFillColor={textFillColor}
                              stickyFillColor={stickyFillColor}
                              stickyFontSizeNorm={stickyFontSizeNorm}
                              defaultStickyWNorm={0.22}
                              defaultStickyHNorm={0.11}
                              onPointerSessionStart={() => setAnnotationTargetPage(pageNumber)}
                              onEyedropperPick={eyedropperForPage(pageNumber)}
                              onCapabilitiesChange={onLeftAnnotationCaps}
                              delegatePointerToSpread={delegatePointerToSpreadPageLayer}
                              spreadInkDelegated={spreadInkDelegated}
                              onSelectionMoveCommitted={mirrorLeftSelectionMoveToRight}
                              onSpreadCanvasCommandCommit={
                                spreadInkDelegated ? commitPageCanvasCommandToSpread : undefined
                              }
                            />
                            </>
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
                              <>
                                {renderSpreadPageMarkerLayer('right')}
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
                                stickerKind={stickerKind}
                                writableStickerVariant={writableStickerVariant}
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
        shapeRoundedCorners={shapeRoundedCorners}
                                textFontSizeNorm={textFontSizeNorm}
                                textFontId={textFontId}
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
                                delegatePointerToSpread={delegatePointerToSpreadPageLayer}
                                spreadInkDelegated={spreadInkDelegated}
                                onSelectionMoveCommitted={mirrorRightSelectionMoveToLeft}
                                onSpreadCanvasCommandCommit={
                                  spreadInkDelegated ? commitPageCanvasCommandToSpread : undefined
                                }
                              />
                              </>
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
                    {spreadSessionModeEnabled && spreadSessionDoc ? (
                      <BookSpreadSessionLayer
                        widthPx={spreadOverlayWidthPx}
                        heightPx={spreadOverlayHeightPx}
                        commands={spreadSessionDoc.commands}
                        trailingEraserLineDraft={spreadEraserLineDraft}
                        selectEnabled={annotationMode === 'select' && !whiteboardActive}
                        selectedIds={spreadSessionSelectedIds}
                        nudgePreview={spreadSessionNudgePreview}
                        onSelectedIdsChange={setSpreadSessionSelected}
                        onMoveSelectedBy={moveSpreadSessionSelected}
                        onScaleSelectedBy={scaleSpreadSessionSelected}
                        onRotateSelectedBy={rotateSpreadSessionSelected}
                        domConfig={spreadDomConfig}
                      />
                    ) : null}
                    {!whiteboardActive && selectedBookId && selectedUnitId ? (
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
        shapeRoundedCorners={shapeRoundedCorners}
                        pageNumberLeft={pageNumber}
                        pageNumberRight={sessionRightPage}
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
                        spreadSessionCommands={spreadSessionDoc?.commands ?? []}
                        onSpreadSessionAppendCommand={appendSpreadSessionCommand}
                        spreadSessionUndo={spreadSessionUndo}
                        spreadSessionRedo={spreadSessionRedo}
                        spreadSessionClear={spreadSessionClear}
                        onSpreadEraserLineDraftChange={setSpreadEraserLineDraft}
                        onSpreadMarkerStrokeDraftChange={setSpreadMarkerStrokeDraft}
                      />
                    ) : null}
                    {renderWhiteboardStandardAnchor()}
                    {renderWhiteboardWideSpreadOverlay()}
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

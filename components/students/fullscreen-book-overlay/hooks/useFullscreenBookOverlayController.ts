'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { resolveSpreadGutterPullRatio, spreadSidePullPx } from '@/lib/books/spread-gutter'
import type { BookLibraryPayload } from '@/lib/books/types'
import { patchStudentWorkCaption } from '@/lib/books/book-capture'
import {
  BOOK_FRAME_VISIBLE_STORAGE_KEY,
  makeUnitFileUrl,
  WHITEBOARD_CHROME_HEIGHT_PX,
  LESSON_BOARD_SURFACE,
  WHITEBOARD_SLOT_INSET_PX,
} from '../constants'
import type { ClassToolId } from '../sections/ClassToolDrawerShell'
import { useArrowKeyPageTurn } from './useArrowKeyPageTurn'
import { useBookOverlayKeyboardShortcuts } from './useBookOverlayKeyboardShortcuts'
import { useBrowserFullscreen } from './useBrowserFullscreen'
import type { SpreadImagePasteHandle } from '@/components/students/fullscreen-book-overlay/types'
import { useAnnotationController } from './useAnnotationController'
import { useEyedropperPick } from './useEyedropperPick'
import { useCaptureExportController } from './useCaptureExportController'
import { useBookLibraryLoader } from './useBookLibraryLoader'
import { useBookViewportLayout } from './useBookViewportLayout'
import { useBookFocusZoom } from './useBookFocusZoom'
import { useBookPinchZoom } from './useBookPinchZoom'
import { computeBookSpreadFrameOuterBox } from '@/lib/books/book-spread-frame-metrics'
import { useGatedBookNavigation } from './useGatedBookNavigation'
import { useBookPdfPageSync } from './useBookPdfPageSync'
import { useFullscreenOverlayPanels } from './useFullscreenOverlayPanels'
import { usePdfJsWorker } from './usePdfJsWorker'
import { useWhiteboardOnBookUnitChange } from './useWhiteboardOnBookUnitChange'
import { useWhiteboardPlacement } from './useWhiteboardPlacement'
import {
  getLessonBoardActivePage,
  lessonBoardLogicalWidthPx,
  lessonBoardResolveContentHeightPx,
  type LessonBoardPageOrientation,
} from '@/lib/books/lesson-board-types'
import {
  isNearEndOfUnitReader,
  lessonBoardBookAccentColor,
  lessonBoardDisplayLabel,
  lessonBoardFooterLabel,
  listLessonBoardShelfForStudent,
  resolveNextUnitInBook,
} from '@/lib/books/lesson-board-nav'
import {
  lessonBoardRunwayViewportHeightPx,
  lessonBoardWidePanelHeightPx,
  lessonBoardWideSpreadWidthPx,
} from '@/lib/books/lesson-board-ink-layout'
import { useLessonBoardPageRunway } from './useLessonBoardPageRunway'
import { useWhiteboardInkSession } from './useWhiteboardInkSession'
import { useBoardLinkPlacement } from './useBoardLinkPlacement'
import { useReadingCheckHotspotPlacement } from './useReadingCheckHotspotPlacement'
import type { WhiteboardToolbarLaunchApi } from './useWhiteboardToolbarLaunch'
import {
  listWhiteboardStorageKeyCandidates,
  resolveWhiteboardStorageKey,
} from '@/lib/books/whiteboard-storage'
import { usePdfUnitCacheOnChange } from './usePdfUnitCacheOnChange'
import { useInteractiveVocabPack } from './useInteractiveVocabPack'
import { useLiveReadingCheckPack } from './useLiveReadingCheckPack'
import { useReadingStoryAtPage } from './useReadingStoryAtPage'
import { useBookReaderSpreadModel } from './useBookReaderSpreadModel'
import { usePageJumpUiSync } from './usePageJumpUiSync'
import { useBookPageAlignmentModel } from './useBookPageAlignmentModel'
import { useCurrentPageCaptureEl } from './useCurrentPageCaptureEl'
import { preloadAllEffectPenResources } from '@/lib/books/effect-pen-preload'
import { getFileAlignment, getUnitReaderBounds } from '@/lib/books/page-range'
import {
  clearReaderPrefetchCacheForUnit,
  invalidateReaderPrefetchStaleWidthBucketsForUnit,
  queueReaderPrefetchWindowIdle,
  queueReaderPrefetchPagesImmediate,
  queueReaderPrefetchPagesLowRes,
  readerPrefetchWidthBucket,
} from '@/lib/books/reader-page-prefetch-queue'
import { getReaderPrefetchDirectionBias } from '@/lib/books/reader-prefetch-direction-bias'
import { splitReaderPrefetchPages } from '@/lib/books/reader-prefetch-priority'
import {
  areReaderSpreadPagesPrefetched,
} from '@/lib/books/reader-spread-prefetch-ready'
import { isSpreadDrawableReady } from '@/lib/books/spread-drawable-ready'
import { getMapAnchorSpreadContext, setMapAnchorSpreadContext } from '@/lib/books/map-anchor-spread-context'
import { spreadResizeScaleEnabled, spreadSlideEnabled, whiteboardInkSessionEnabled } from '@/lib/books/feature-flags'
import { resolveSpreadAnchorPages } from '@/lib/books/reader-spread-navigation'
import type { SpreadTurnSlidePayload } from './useSpreadTurnSlide'
import {
  SPREAD_RESIZE_COMMIT_IDLE_MS,
  SPREAD_WORKSPACE_FIT_MOTION_MS,
  pageAreaSizeAfterDeskLeftShift,
  shouldCommitSpreadRenderWidth,
  spreadResizeScaleIsActive,
} from '@/lib/books/spread-resize-config'
import {
  computeSpreadClusterMetrics,
  computeSpreadPageWidth,
  computeSpreadReaderDisplayScale,
  computeSpreadReaderResizeScale,
  heuristicBookOverlaySpreadPageWidthPx,
} from '@/lib/books/spread-viewport-layout'
import type { SelectionMoveClampContext } from '@/lib/books/annotation-scale'
import type { SpreadSessionStore } from '@/lib/books/spread-session-store'
import { requestWhiteboardSessionFlush } from '@/lib/books/whiteboard-session-events'
import type { WhiteboardSessionStore } from '@/lib/books/whiteboard-session-store'
import { setAnnotationsForStorageKey } from '@/lib/books/annotation-storage'
import { lessonBoardPageStorageKey } from '@/lib/books/lesson-board-session-ops'
import { removeLessonBoardPageLinksForBoardPageIds } from '@/lib/books/lesson-board-page-links'
import { getStudentTeachingOpenPdfPageForBookUnit } from '@/lib/students/selectors'
import type { FullscreenBookOverlayProps } from '../types'

/** A4-style portrait default until PDF viewport is primed (see B3). */
const DEFAULT_PAGE_ASPECT_RATIO = 1 / 1.414

const EMPTY_ASSIGNED_UNIT_REFS: Array<{ bookId: string; unitId: string }> = []
const EMPTY_CURRICULUM_HISTORY: NonNullable<FullscreenBookOverlayProps['curriculumHistory']> = []

function initialSpreadPageWidthPx(): number {
  if (typeof window === 'undefined') return 360
  return heuristicBookOverlaySpreadPageWidthPx(DEFAULT_PAGE_ASPECT_RATIO)
}

const PdfPage = dynamic(() => import('react-pdf').then((mod) => mod.Page), {
  ssr: false,
})

export function useFullscreenBookOverlayController(props: FullscreenBookOverlayProps) {
  const {
    studentId,
    activeClassSessionId = null,
    assignedBookIds,
    assignedUnitRefs = EMPTY_ASSIGNED_UNIT_REFS,
    curriculumHistory = EMPTY_CURRICULUM_HISTORY,
    studentName,
    numberingMode = 'mapped',
    open,
    onClose,
    presented: presentedProp,
    onBookReadyToPresent,
    onBookPaintInvalidated,
    onBookOpenPaintTimeout,
    onFocusPresentationChange,
    onLessonBoardOpenChange,
    isPrepMode = false,
    preferBookId = null,
    preferUnitId = null,
    preferOpenPdfPage = null,
  } = props

  const preferResumePage = useMemo(() => {
    if (preferOpenPdfPage != null && Number.isFinite(preferOpenPdfPage)) {
      return Math.max(1, Math.floor(preferOpenPdfPage))
    }
    const bookId = preferBookId?.trim()
    const unitId = preferUnitId?.trim()
    if (!bookId || !unitId) return null
    return getStudentTeachingOpenPdfPageForBookUnit(studentId, bookId, unitId, null)
  }, [preferBookId, preferOpenPdfPage, preferUnitId, studentId])

  const userPresented = presentedProp ?? true

  const {
    supported: browserFullscreenSupported,
    isBrowserFullscreen,
    toggle: toggleBrowserFullscreen,
  } = useBrowserFullscreen()

  useEffect(() => {
    if (!open) return
    preloadAllEffectPenResources()
  }, [open])

  const ANIMATION_MS = 650
  const [library, setLibrary] = useState<BookLibraryPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null)
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)
  /** Lasting board notebook â€” can differ from PDF selection while browsing Boards. */
  const [lessonBoardBookId, setLessonBoardBookId] = useState<string | null>(null)
  const [lessonBoardUnitId, setLessonBoardUnitId] = useState<string | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [numPages, setNumPages] = useState<number | null>(null)
  const [targetSpreadPageWidth, setTargetSpreadPageWidth] = useState(initialSpreadPageWidthPx)
  const [spreadPageWidth, setSpreadPageWidth] = useState(initialSpreadPageWidthPx)
  const [pageAspectRatio, setPageAspectRatio] = useState(DEFAULT_PAGE_ASPECT_RATIO)
  const [exportCaptureLayoutActive, setExportCaptureLayoutActive] = useState(false)
  /** Teacher preference: hardcover chrome around the spread (default on). Export still force-hides the frame. */
  const [showBookFrame, setShowBookFrameState] = useState(true)
  /** Spread = teach/annotate; pageGrid = Overview retell grid (Phase 1). */
  const [readerLayoutMode, setReaderLayoutMode] = useState<'spread' | 'pageGrid'>('spread')
  const [pdfReady, setPdfReady] = useState(false)

  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      const raw = window.localStorage.getItem(BOOK_FRAME_VISIBLE_STORAGE_KEY)
      if (raw === '0') setShowBookFrameState(false)
      else if (raw === '1') setShowBookFrameState(true)
    } catch {
      /* ignore quota / private mode */
    }
  }, [])

  const setShowBookFrame = useCallback((next: boolean) => {
    setShowBookFrameState(next)
    try {
      window.localStorage.setItem(BOOK_FRAME_VISIBLE_STORAGE_KEY, next ? '1' : '0')
    } catch {
      /* ignore quota / private mode */
    }
  }, [])
  const [isMounted, setIsMounted] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  /** Spread slots reported pixel-ready for the current anchor (prefetch drawn or pdf composited). */
  const [spreadSlotsPixelsReady, setSpreadSlotsPixelsReady] = useState(false)
  /** Max-wait fallback when slots/cache never satisfy drawable (non-map and map timeout). */
  const [spreadDrawableTimedOut, setSpreadDrawableTimedOut] = useState(false)
  /** Bumps so `BookCanvasStage` resets slot reporting when reopening, unit change, or width bucket. */
  const [spreadReportEpoch, setSpreadReportEpoch] = useState(0)
  const [isPageListOpen, setIsPageListOpen] = useState(false)
  const [pageListRailTab, setPageListRailTab] = useState<'book' | 'board'>('book')
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false)
  const [isWhiteboardMinimized, setIsWhiteboardMinimized] = useState(false)
  const [classToolId, setClassToolId] = useState<ClassToolId | null>(null)

  useEffect(() => {
    if (!open) setClassToolId(null)
  }, [open])

  useEffect(() => {
    if (!open) setReaderLayoutMode('spread')
  }, [open])

  const [pageAreaSize, setPageAreaSize] = useState({ w: 0, h: 0 })
  const [spreadFitMotionActive, setSpreadFitMotionActive] = useState(false)
  const pageAreaRef = useRef<HTMLDivElement | null>(null)
  const spreadTargetHoldUntilRef = useRef(0)
  const prevWorkspaceDeskLeftPxRef = useRef<number | null>(null)
  const deskFitHoldTimerRef = useRef<number | null>(null)
  const pageAreaSizeRef = useRef(pageAreaSize)
  pageAreaSizeRef.current = pageAreaSize
  const targetSpreadPageWidthRef = useRef(targetSpreadPageWidth)
  targetSpreadPageWidthRef.current = targetSpreadPageWidth
  const spreadTurnGridRef = useRef<HTMLDivElement | null>(null)
  const activePageRowRef = useRef<HTMLButtonElement | null>(null)
  const lessonBoardActivePageRowRef = useRef<HTMLDivElement | null>(null)
  const [pageJumpDraft, setPageJumpDraft] = useState('1')
  const [pageJumpFocused, setPageJumpFocused] = useState(false)
  const [pageListScrollRoot, setPageListScrollRoot] = useState<HTMLDivElement | null>(null)
  const prevUnitCacheRef = useRef<{ unitId: string; fileUrl: string } | null>(null)
  const prevReaderPrefetchAlignSigRef = useRef<string | null>(null)
  const lastReaderPrefetchWidthBucketRef = useRef<number | null>(null)
  const openRef = useRef(open)
  openRef.current = open
  const prevOpenForFirstPaintRef = useRef(open)
  const bookReadyToPresentNotifiedRef = useRef(false)
  const prevSelectedUnitForPaintRef = useRef<string | null>(selectedUnitId)
  const prevLayoutPrefetchBucketRef = useRef<number | null>(null)
  const spreadRenderBaseKeyRef = useRef('')
  const leftPageCaptureRef = useRef<HTMLDivElement | null>(null)
  const rightPageCaptureRef = useRef<HTMLDivElement | null>(null)
  const bookStageRef = useRef<HTMLDivElement | null>(null)
  const overlayRootRef = useRef<HTMLDivElement | null>(null)
  const pinchSpreadRef = useRef<HTMLDivElement | null>(null)
  const wbCaptureRootRef = useRef<HTMLDivElement | null>(null)

  usePdfJsWorker(setPdfReady)

  useBookLibraryLoader({
    open,
    studentId,
    assignedBookIds,
    assignedUnitRefs,
    curriculumHistory,
    preferBookId,
    preferUnitId,
    preferResumePage,
    setLoading,
    setError,
    setLibrary,
    setSelectedBookId,
    setSelectedUnitId,
    setPageNumber,
    setNumPages,
  })

  const selectedUnit = useMemo(() => {
    if (!library || !selectedBookId || !selectedUnitId) return null
    const book = library.books.find((item) => item.id === selectedBookId)
    return book?.units.find((unit) => unit.id === selectedUnitId) ?? null
  }, [library, selectedBookId, selectedUnitId])

  const primeReaderPageAspectRatio = useCallback((ratio: number) => {
    if (Number.isFinite(ratio) && ratio > 0) setPageAspectRatio(ratio)
  }, [])

  useEffect(() => {
    if (!selectedUnitId) return
    setPageAspectRatio(DEFAULT_PAGE_ASPECT_RATIO)
  }, [selectedUnitId])

  /** Reader may resolve from book ids, unit refs, or session history â€” do not gate the frame on book ids alone. */
  const hasCurriculumOrHistory =
    assignedBookIds.length > 0 || assignedUnitRefs.length > 0 || curriculumHistory.length > 0
  const hasResolvedUnit = !!selectedUnit

  const readerPresentationCore = useMemo(() => {
    if (!open) return true
    if (loading) return false
    if (error) return true
    if (!hasCurriculumOrHistory) return true
    if (!hasResolvedUnit) return true
    return pdfReady && numPages != null
  }, [open, loading, error, hasCurriculumOrHistory, hasResolvedUnit, pdfReady, numPages])

  const [readerPresentationTimedOut, setReaderPresentationTimedOut] = useState(false)

  useEffect(() => {
    if (!open) {
      setReaderPresentationTimedOut(false)
      return
    }
    if (readerPresentationCore) {
      setReaderPresentationTimedOut(false)
      return
    }
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const capMs = mq.matches ? 450 : 2800
    const id = window.setTimeout(() => setReaderPresentationTimedOut(true), capMs)
    return () => window.clearTimeout(id)
  }, [open, readerPresentationCore])

  const readerPresentationReady = readerPresentationCore || readerPresentationTimedOut

  useEffect(() => {
    if (!open) {
      prevOpenForFirstPaintRef.current = false
      bookReadyToPresentNotifiedRef.current = false
      setSpreadDrawableTimedOut(false)
      return
    }
    if (!prevOpenForFirstPaintRef.current) {
      setSpreadReportEpoch((n) => n + 1)
    }
    prevOpenForFirstPaintRef.current = true
  }, [open])

  useEffect(() => {
    if (!open) {
      prevSelectedUnitForPaintRef.current = selectedUnitId
      return
    }
    const prev = prevSelectedUnitForPaintRef.current
    if (prev != null && prev !== selectedUnitId && selectedUnitId != null) {
      setSpreadReportEpoch((n) => n + 1)
      setSpreadSlotsPixelsReady(false)
      setSpreadDrawableTimedOut(false)
      bookReadyToPresentNotifiedRef.current = false
      onBookPaintInvalidated?.()
    }
    prevSelectedUnitForPaintRef.current = selectedUnitId
  }, [open, selectedUnitId, onBookPaintInvalidated])

  useFullscreenOverlayPanels({
    open,
    presentationReady: readerPresentationReady,
    userPresented,
    setIsMounted,
    setIsVisible,
    setIsPageListOpen,
    setIsWhiteboardOpen,
    isWhiteboardOpen,
    isPageListOpen,
    pageNumber,
    numPages,
    library,
    selectedBookId,
    selectedUnitId,
  })

  useBookViewportLayout({
    open,
    pageAspectRatio,
    spreadResizeScaleEnabled,
    includeBookFrame: showBookFrame,
    selectedBookId,
    selectedUnitId,
    selectedUnit,
    pageAreaRef,
    spreadRenderBaseKeyRef,
    spreadTargetHoldUntilRef,
    targetSpreadPageWidthRef,
    setPageAreaSize,
    setTargetSpreadPageWidth,
    setSpreadPageWidth,
  })

  const pageAspectRatioRef = useRef(pageAspectRatio)
  pageAspectRatioRef.current = pageAspectRatio
  const showBookFrameRef = useRef(showBookFrame)
  showBookFrameRef.current = showBookFrame

  const syncWorkspaceDeskLeftPx = useCallback((nextPx: number) => {
    const prev = prevWorkspaceDeskLeftPxRef.current
    prevWorkspaceDeskLeftPxRef.current = nextPx
    if (prev == null || prev === nextPx) return
    const area = pageAreaSizeRef.current
    if (!(area.w > 0) || !(area.h > 0)) return
    const nextArea = pageAreaSizeAfterDeskLeftShift(area, prev, nextPx)
    setPageAreaSize(nextArea)
    setTargetSpreadPageWidth(
      computeSpreadPageWidth(
        nextArea.w,
        nextArea.h,
        pageAspectRatioRef.current,
        1,
        showBookFrameRef.current,
      ),
    )
    spreadTargetHoldUntilRef.current = performance.now() + SPREAD_WORKSPACE_FIT_MOTION_MS
    setSpreadFitMotionActive(true)
    if (deskFitHoldTimerRef.current != null) window.clearTimeout(deskFitHoldTimerRef.current)
    deskFitHoldTimerRef.current = window.setTimeout(() => {
      deskFitHoldTimerRef.current = null
      spreadTargetHoldUntilRef.current = 0
      setSpreadFitMotionActive(false)
    }, SPREAD_WORKSPACE_FIT_MOTION_MS)
  }, [])

  useEffect(() => {
    if (open) return
    prevWorkspaceDeskLeftPxRef.current = null
    spreadTargetHoldUntilRef.current = 0
    setSpreadFitMotionActive(false)
    if (deskFitHoldTimerRef.current != null) {
      window.clearTimeout(deskFitHoldTimerRef.current)
      deskFitHoldTimerRef.current = null
    }
  }, [open])

  useEffect(() => {
    return () => {
      if (deskFitHoldTimerRef.current != null) {
        window.clearTimeout(deskFitHoldTimerRef.current)
      }
    }
  }, [])

  function onPdfPageLoadSuccess(page: { originalWidth?: number; originalHeight?: number; width: number; height: number }) {
    const rawWidth = page.originalWidth ?? page.width
    const rawHeight = page.originalHeight ?? page.height
    if (!rawWidth || !rawHeight) return
    const nextRatio = rawWidth / rawHeight
    if (!Number.isFinite(nextRatio) || nextRatio <= 0) return
    setPageAspectRatio(nextRatio)
  }


  const selectedBook = useMemo(() => {
    if (!library || !selectedBookId) return null
    return library.books.find((item) => item.id === selectedBookId) ?? null
  }, [library, selectedBookId])

  useEffect(() => {
    if (!selectedBookId || !selectedUnitId) {
      setLessonBoardBookId(null)
      setLessonBoardUnitId(null)
      return
    }
    // Book/unit nav keeps the board notebook in sync. Boards picker changes
    // only lessonBoard* and must not jump the PDF.
    setLessonBoardBookId(selectedBookId)
    setLessonBoardUnitId(selectedUnitId)
  }, [selectedBookId, selectedUnitId])

  const effectiveLessonBoardBookId = lessonBoardBookId ?? selectedBookId
  const effectiveLessonBoardUnitId = lessonBoardUnitId ?? selectedUnitId

  const lessonBoardBook = useMemo(() => {
    if (!library || !effectiveLessonBoardBookId) return null
    return library.books.find((item) => item.id === effectiveLessonBoardBookId) ?? null
  }, [effectiveLessonBoardBookId, library])

  const lessonBoardUnit = useMemo(() => {
    if (!lessonBoardBook || !effectiveLessonBoardUnitId) return null
    return lessonBoardBook.units.find((unit) => unit.id === effectiveLessonBoardUnitId) ?? null
  }, [effectiveLessonBoardUnitId, lessonBoardBook])

  const boardBookAccentColor = useMemo(() => {
    if (!effectiveLessonBoardBookId) return undefined
    return lessonBoardBookAccentColor(effectiveLessonBoardBookId)
  }, [effectiveLessonBoardBookId])

  const boardFooterLabel = useMemo(() => {
    if (!lessonBoardBook) return undefined
    const displayLabel = lessonBoardDisplayLabel(lessonBoardBook)
    const multiUnit = lessonBoardBook.units.length >= 2
    const unitTitle = multiUnit
      ? lessonBoardUnit?.title.trim() || effectiveLessonBoardUnitId || undefined
      : undefined
    return lessonBoardFooterLabel({ displayLabel, unitTitle })
  }, [effectiveLessonBoardUnitId, lessonBoardBook, lessonBoardUnit])

  const boardBookFullTitle = useMemo(() => {
    if (!lessonBoardBook) return undefined
    return lessonBoardBook.title.trim() || lessonBoardBook.id
  }, [lessonBoardBook])

  const spreadGutterPullRatio = useMemo(
    () => resolveSpreadGutterPullRatio(selectedBook, selectedUnit?.filePath ?? null),
    [selectedBook, selectedUnit?.filePath],
  )

  const { vocabReaderHit, interactiveVocabPack } = useInteractiveVocabPack({
    selectedBook,
    selectedUnit,
    pageNumber,
    numPages,
  })

  const {
    unitPageBounds,
    visiblePages,
    spreadRightPage,
    showSpreadRightPage,
    currentTocPartTitle,
  } = useBookReaderSpreadModel({
    selectedBook,
    selectedUnit,
    numPages,
    pageNumber,
    vocabReaderHit,
  })

  const { readingStoryHit } = useReadingStoryAtPage({
    selectedBook,
    selectedUnit,
    pageNumber,
    spreadRightPage,
    numPages,
  })

  const { liveReadingCheckPack } = useLiveReadingCheckPack({
    story: readingStoryHit?.story ?? null,
  })

  const spreadSessionStoreRef = useRef<SpreadSessionStore | null>(null)
  const spreadImagePasteRef = useRef<SpreadImagePasteHandle | null>(null)
  const whiteboardSessionStoreRef = useRef<WhiteboardSessionStore | null>(null)
  const whiteboardSelectionMoveClampRef = useRef<SelectionMoveClampContext | null>(null)

  const {
    annotationMode,
    setAnnotationMode,
    stampVariant,
    setStampVariant,
    stampIndicatorPulseEpoch,
    pulseStampIndicator,
    stickerKind,
    setStickerKind,
    writableStickerVariant,
    setWritableStickerVariant,
    stampQuestionColor,
    setStampQuestionColor,
    stampEffectsEnabled,
    setStampEffectsEnabled,
    penSwatchId,
    pickPenSwatch,
    penStrokeProfile,
    setPenStrokeProfile,
    penColorSource,
    penCustomHex,
    pickPenCustomColor,
    textColor,
    setTextColor,
    pickTextColor,
    shapeStrokeSwatchId,
    setShapeStrokeSwatchId,
    pickShapeStrokeSwatch,
    stickyFillColor,
    setStickyFillColor,
    pickStickyFillColor,
    penColor,
    penInkStyle,
    markerColor,
    markerColorSource,
    markerCustomHex,
    pickMarkerSwatchColor,
    pickMarkerCustomColor,
    penThicknessStep,
    setPenThicknessStep,
    markerThicknessStep,
    setMarkerThicknessStep,
    shapeThicknessStep,
    setShapeThicknessStep,
    textThicknessStep,
    setTextThicknessStep,
    stickyThicknessStep,
    setStickyThicknessStep,
    stampThicknessStep,
    setStampThicknessStep,
    eraserPixelThicknessStep,
    setEraserPixelThicknessStep,
    eraserLineThicknessStep,
    setEraserLineThicknessStep,
    textVisualStyle,
    bookTextVisualStyle,
    setTextVisualStyle,
    textAlign,
    setTextAlign,
    textFontId,
    setTextFontId,
    textFontWeight,
    setTextFontWeight,
    textFillColor,
    setTextFillColor,
    pickTextFillColor,
    penLineDashStyle,
    setPenLineDashStyle,
    markerLineDashStyle,
    setMarkerLineDashStyle,
    markerStraightStroke,
    setMarkerStraightStroke,
    markerDecoratedEdge,
    setMarkerDecoratedEdge,
    penAutoGroupConnected,
    setPenAutoGroupConnected,
    marqueeSelectRule,
    setMarqueeSelectRule,
    shapeLineDashStyle,
    setShapeLineDashStyle,
    shapeStrokeEnabled,
    setShapeStrokeEnabled,
    shapeFillMode,
    setShapeFillMode,
    shapeFillColor,
    setShapeFillColor,
    shapeRoundedCorners,
    setShapeRoundedCorners,
    eyedropperVariant,
    setEyedropperVariant,
    strokeLineDashStyleForInk,
    annotationTargetPage,
    setAnnotationTargetPage,
    isAnnotationRailVisible,
    setIsAnnotationRailVisible,
    isAnnotationRailPinned,
    setIsAnnotationRailPinned,
    annotationRailPinHydrated,
    annotationRailKeyboardDismissAt,
    annotationRailKeyboardOpenAt,
    toggleAnnotationRailKeyboard,
    leftAnnRef,
    rightAnnRef,
    wbAnnRef,
    spreadStrokeOverlayRef,
    wbStrokeOverlayRef,
    whiteboardStrokeCaptureEnabled,
    onWhiteboardOverlayCaps,
    strokeWidthScale,
    eraserLineStrokeWidthScale,
    penStrokeWidthScale,
    strokeColor,
    shapeStrokeWidthScale,
    stampScale,
    textFontSizeNorm,
    stickyFontSizeNorm,
    shapeColor,
    toolbarCaps,
    spreadStrokeCaptureEnabled,
    onSpreadOverlayCaps,
    onLeftAnnotationCaps,
    onRightAnnotationCaps,
    onWhiteboardCaps,
    getActiveAnnotationRef,
    getPageAnnotationRef,
    selectAllOnActivePage,
    selectAllIncludingLockedOnActivePage,
    deselectAllOnActivePage,
    hasAnyAnnotationSelection,
    effectiveAnnotationMode,
  } = useAnnotationController({
    studentId,
    pageNumber,
    isWhiteboardOpen: isWhiteboardOpen && !isWhiteboardMinimized,
    showSpreadRight: showSpreadRightPage,
    spreadRightPage,
    overlayOpen: open,
    spreadSessionStoreRef,
    whiteboardSessionStoreRef,
  })

  const onEyedropperPick = useEyedropperPick({
    pageNumber,
    spreadRightPage,
    isWhiteboardOpen,
    leftPageCaptureRef,
    rightPageCaptureRef,
    wbCaptureRootRef,
    pickPenCustomColor,
    setAnnotationMode,
    eyedropperVariant,
  })

  const { pageAlignmentRuntime, printedJumpBounds } = useBookPageAlignmentModel({
    numPages,
    selectedBook,
    selectedUnit,
    visiblePages,
    numberingMode,
  })

  const readerPrefetchAlignmentSignature = useMemo(() => {
    if (!selectedBook || !selectedUnit || numPages == null) return null
    const { hiddenPdfPages, notCountedPdfPages } = getFileAlignment(selectedBook, selectedUnit.filePath)
    const h = [...hiddenPdfPages].sort((a, b) => a - b).join(',')
    const c = [...notCountedPdfPages].sort((a, b) => a - b).join(',')
    return `${numPages}|${h}|${c}`
  }, [selectedBook, selectedUnit, numPages])

  usePdfUnitCacheOnChange({ open, selectedUnit, prevUnitCacheRef })

  useEffect(() => {
    prevReaderPrefetchAlignSigRef.current = null
    lastReaderPrefetchWidthBucketRef.current = null
  }, [selectedUnitId])

  useEffect(() => {
    if (!open || !selectedUnitId || readerPrefetchAlignmentSignature == null) return
    const prev = prevReaderPrefetchAlignSigRef.current
    if (prev !== null && prev !== readerPrefetchAlignmentSignature) {
      clearReaderPrefetchCacheForUnit(selectedUnitId)
    }
    prevReaderPrefetchAlignSigRef.current = readerPrefetchAlignmentSignature
  }, [open, selectedUnitId, readerPrefetchAlignmentSignature])

  const layoutSpreadPageWidth = useMemo(() => {
    if (!(spreadPageWidth > 0)) return 1
    return Math.max(1, Math.floor(spreadPageWidth))
  }, [spreadPageWidth])

  const spreadDisplayScale = useMemo(
    () =>
      computeSpreadReaderResizeScale(
        layoutSpreadPageWidth,
        targetSpreadPageWidth,
        pageAspectRatio,
        spreadGutterPullRatio,
        showBookFrame,
      ),
    [
      layoutSpreadPageWidth,
      targetSpreadPageWidth,
      pageAspectRatio,
      spreadGutterPullRatio,
      showBookFrame,
    ],
  )

  const layoutSpreadCluster = useMemo(
    () =>
      computeSpreadClusterMetrics(
        layoutSpreadPageWidth,
        pageAspectRatio,
        spreadGutterPullRatio,
      ),
    [layoutSpreadPageWidth, pageAspectRatio, spreadGutterPullRatio],
  )

  const spreadReaderDisplayScale = useMemo(
    () =>
      computeSpreadReaderDisplayScale(
        spreadDisplayScale,
        pageAreaSize.w,
        pageAreaSize.h,
        layoutSpreadCluster.spreadOverlayWidthPx,
        layoutSpreadCluster.pageCanvasHeightPx,
        showBookFrame,
      ),
    [
      spreadDisplayScale,
      pageAreaSize.w,
      pageAreaSize.h,
      layoutSpreadCluster.spreadOverlayWidthPx,
      layoutSpreadCluster.pageCanvasHeightPx,
      showBookFrame,
    ],
  )

  const spreadResizeScaleHold = spreadResizeScaleIsActive(spreadReaderDisplayScale)

  useEffect(() => {
    if (!open) return
    if (!shouldCommitSpreadRenderWidth(layoutSpreadPageWidth, targetSpreadPageWidth)) return
    const timeoutId = window.setTimeout(() => {
      setSpreadPageWidth(targetSpreadPageWidth)
    }, SPREAD_RESIZE_COMMIT_IDLE_MS)
    return () => window.clearTimeout(timeoutId)
  }, [open, layoutSpreadPageWidth, targetSpreadPageWidth])

  /** Layout measured and render width is usable (bucket-stable; no spreadPageWidth >= target gate). */
  const spreadLayoutStable = useMemo(() => {
    return layoutSpreadPageWidth > 0 && pageAreaSize.w > 0
  }, [layoutSpreadPageWidth, pageAreaSize.w])

  useEffect(() => {
    if (!open) {
      prevLayoutPrefetchBucketRef.current = null
      return
    }

    const bucket = readerPrefetchWidthBucket(layoutSpreadPageWidth)
    const prev = prevLayoutPrefetchBucketRef.current
    if (prev !== null && prev !== bucket) {
      setSpreadReportEpoch((n) => n + 1)
      setSpreadSlotsPixelsReady(false)
      setSpreadDrawableTimedOut(false)
      bookReadyToPresentNotifiedRef.current = false
      onBookPaintInvalidated?.()
    }
    prevLayoutPrefetchBucketRef.current = bucket
  }, [open, layoutSpreadPageWidth, onBookPaintInvalidated])

  const handleSpreadSlotsPixelsReady = useCallback(() => {
    setSpreadSlotsPixelsReady(true)
  }, [])

  /** Hidden welcome warm must report pixels so we only leave the cover when the spread is painted. */
  const confirmSpreadSlotPixels = true

  const spreadCachePrimed = useMemo(() => {
    if (!selectedUnitId || !(layoutSpreadPageWidth > 0)) return false
    return areReaderSpreadPagesPrefetched({
      unitId: selectedUnitId,
      anchorPage: pageNumber,
      visiblePages,
      spreadPageWidthPx: layoutSpreadPageWidth,
    })
  }, [
    selectedUnitId,
    layoutSpreadPageWidth,
    pageNumber,
    visiblePages,
  ])

  const spreadDrawableBypass =
    !open || !hasCurriculumOrHistory || !!error || !hasResolvedUnit

  const spreadDrawableReady = useMemo(
    () =>
      isSpreadDrawableReady({
        spreadLayoutStable,
        spreadSlotsPixelsReady,
        userPresented,
        spreadCachePrimed,
        bypassGate: spreadDrawableBypass,
        spreadDrawableTimedOut,
        spreadResizeScaleHold,
      }),
    [
      spreadLayoutStable,
      spreadSlotsPixelsReady,
      userPresented,
      spreadCachePrimed,
      spreadDrawableBypass,
      spreadDrawableTimedOut,
      spreadResizeScaleHold,
    ],
  )

  useEffect(() => {
    if (!open || spreadDrawableReady) return
    if (!readerPresentationReady) return
    if (!hasCurriculumOrHistory || error || !hasResolvedUnit) return
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const capMs = mq.matches ? 1500 : 4000
    const id = window.setTimeout(() => setSpreadDrawableTimedOut(true), capMs)
    return () => window.clearTimeout(id)
  }, [
    open,
    spreadDrawableReady,
    readerPresentationReady,
    hasCurriculumOrHistory,
    error,
    hasResolvedUnit,
  ])

  const tryNotifyBookReadyToPresent = useCallback(() => {
    if (!open || !onBookReadyToPresent) return
    if (bookReadyToPresentNotifiedRef.current) return
    if (!selectedUnitId || !hasResolvedUnit) return
    if (!spreadLayoutStable) return
    if (!spreadSlotsPixelsReady) return
    bookReadyToPresentNotifiedRef.current = true
    onBookReadyToPresent()
  }, [
    open,
    onBookReadyToPresent,
    selectedUnitId,
    hasResolvedUnit,
    spreadLayoutStable,
    spreadSlotsPixelsReady,
  ])

  useEffect(() => {
    tryNotifyBookReadyToPresent()
  }, [tryNotifyBookReadyToPresent])

  /** Map route: timeout after user presents until drawable ready â€” not during silent warm. */
  useEffect(() => {
    if (!open || !onBookReadyToPresent || !userPresented) return
    if (!readerPresentationReady) return
    if (!hasCurriculumOrHistory || error || !hasResolvedUnit) return
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const capMs = mq.matches ? 1500 : 4000
    const id = window.setTimeout(() => {
      if (!bookReadyToPresentNotifiedRef.current) {
        onBookOpenPaintTimeout?.()
      }
    }, capMs)
    return () => window.clearTimeout(id)
  }, [
    open,
    userPresented,
    onBookReadyToPresent,
    readerPresentationReady,
    hasCurriculumOrHistory,
    error,
    hasResolvedUnit,
    onBookOpenPaintTimeout,
    spreadDrawableReady,
  ])

  useEffect(() => {
    if (!open) {
      setSpreadSlotsPixelsReady(false)
      setSpreadDrawableTimedOut(false)
      return
    }
    setSpreadSlotsPixelsReady(false)
    setSpreadDrawableTimedOut(false)
  }, [open, pageNumber, spreadReportEpoch, selectedUnitId])

  useEffect(() => {
    if (!open || !selectedUnitId || spreadResizeScaleEnabled) return
    const nextBucket = readerPrefetchWidthBucket(layoutSpreadPageWidth)
    const prevBucket = lastReaderPrefetchWidthBucketRef.current
    if (prevBucket !== null && nextBucket < prevBucket) {
      invalidateReaderPrefetchStaleWidthBucketsForUnit(selectedUnitId, layoutSpreadPageWidth)
    }
    lastReaderPrefetchWidthBucketRef.current = nextBucket
  }, [open, selectedUnitId, layoutSpreadPageWidth])

  useEffect(() => {
    if (!open || !pdfReady || !selectedUnit || numPages == null) return
    const w = layoutSpreadPageWidth
    if (!(w > 0)) return
    const fileUrl = makeUnitFileUrl(selectedUnit.filePath)
    const readerBounds = getUnitReaderBounds(selectedUnit, numPages, selectedBook ?? undefined)
    const { immediate, idle } = splitReaderPrefetchPages({
      anchorPage: pageNumber,
      visiblePages,
      readerBounds,
      directionBias: getReaderPrefetchDirectionBias(),
      intent: 'routine',
    })
    queueReaderPrefetchPagesImmediate({
      fileUrl,
      unitId: selectedUnit.id,
      pages: immediate,
      widthPx: w,
      shouldProceed: () => openRef.current,
    })
    queueReaderPrefetchPagesLowRes({
      fileUrl,
      unitId: selectedUnit.id,
      pages: immediate,
      widthPx: w,
      shouldProceed: () => openRef.current,
    })
    queueReaderPrefetchWindowIdle({
      fileUrl,
      unitId: selectedUnit.id,
      pages: idle,
      widthPx: w,
      shouldProceed: () => openRef.current,
    })
  }, [open, pdfReady, selectedUnit, numPages, selectedBook, pageNumber, visiblePages, layoutSpreadPageWidth])

  /** Align map cache-readiness checks with measured overlay width. */
  useEffect(() => {
    if (!open || !selectedUnitId || !(layoutSpreadPageWidth > 0)) return
    const ctx = getMapAnchorSpreadContext()
    if (!ctx || ctx.unitId !== selectedUnitId) return
    if (readerPrefetchWidthBucket(ctx.widthPx) === readerPrefetchWidthBucket(layoutSpreadPageWidth)) return
    setMapAnchorSpreadContext({ ...ctx, widthPx: layoutSpreadPageWidth })
  }, [open, selectedUnitId, layoutSpreadPageWidth])

  const pageCanvasHeightPx =
    layoutSpreadPageWidth > 0 && Number.isFinite(pageAspectRatio) && pageAspectRatio > 0
      ? Math.max(1, Math.round(layoutSpreadPageWidth / pageAspectRatio))
      : 1

  const whiteboardStorageKey = useMemo(() => {
    if (!effectiveLessonBoardBookId || !effectiveLessonBoardUnitId) return null
    return resolveWhiteboardStorageKey({
      bookId: effectiveLessonBoardBookId,
      unitId: effectiveLessonBoardUnitId,
    })
  }, [effectiveLessonBoardBookId, effectiveLessonBoardUnitId])

  const whiteboardStorageKeyCandidates = useMemo(() => {
    if (!effectiveLessonBoardBookId || !effectiveLessonBoardUnitId) return []
    return listWhiteboardStorageKeyCandidates({
      classSessionId: activeClassSessionId,
      bookId: effectiveLessonBoardBookId,
      unitId: effectiveLessonBoardUnitId,
    })
  }, [activeClassSessionId, effectiveLessonBoardBookId, effectiveLessonBoardUnitId])

  const {
    whiteboardSlotSide,
    whiteboardLayoutMode,
    whiteboardFloatRect,
    setWhiteboardSlotSide,
    applyWhiteboardSlotSide,
    registerWhiteboardSlotMotion,
    swapWhiteboardSlotSide,
    floatWhiteboard,
    dockWhiteboardToSlot,
    forceDockWhiteboard,
    commitWhiteboardFloatRect,
    openWhiteboardWithDefaultPlacement,
    resetPlacementForUnitChange,
  } = useWhiteboardPlacement({
    studentId,
    selectedBookId,
    selectedUnitId,
    pageNumber,
    spreadRightPage: spreadRightPage ?? null,
    annotationTargetPage,
  })

  const {
    whiteboardSessionDoc,
    whiteboardInkRevision,
    flushWhiteboardSessionToLegacy,
    appendWhiteboardSessionCommand: appendWhiteboardSessionCommandRaw,
    whiteboardSessionUndo,
    whiteboardSessionRedo,
    whiteboardSessionClear,
    setActiveLessonBoardContentHeightPx,
    setActiveLessonBoardPage,
    appendLessonBoardPage,
    setLessonBoardPageTitle,
    deleteLessonBoardPage,
    setLessonBoardPageBookPageHint,
  } = useWhiteboardInkSession({
    enabled:
      whiteboardInkSessionEnabled &&
      open &&
      !!effectiveLessonBoardBookId &&
      !!effectiveLessonBoardUnitId &&
      !!whiteboardStorageKey,
    studentId,
    bookId: effectiveLessonBoardBookId,
    unitId: effectiveLessonBoardUnitId,
    storagePageKey: whiteboardStorageKey,
    storagePageKeyCandidates: whiteboardStorageKeyCandidates,
    whiteboardSessionStoreRef,
    selectionMoveClampRef: whiteboardSelectionMoveClampRef,
    onOverlayCaps: onWhiteboardOverlayCaps,
  })

  const appendWhiteboardSessionCommand = useCallback(
    (cmd: Parameters<typeof appendWhiteboardSessionCommandRaw>[0]) => {
      appendWhiteboardSessionCommandRaw(cmd)
      const activeId = whiteboardSessionDoc?.activePageId
      if (activeId && pageNumber >= 1) {
        setLessonBoardPageBookPageHint(activeId, pageNumber)
      }
    },
    [
      appendWhiteboardSessionCommandRaw,
      pageNumber,
      setLessonBoardPageBookPageHint,
      whiteboardSessionDoc?.activePageId,
    ],
  )

  const boardShelf = useMemo(() => {
    if (!library || !studentId) return []
    return listLessonBoardShelfForStudent({
      studentId,
      library,
      assignedBookIds,
      assignedUnitRefs,
      openBookId: effectiveLessonBoardBookId,
      openUnitId: effectiveLessonBoardUnitId,
    })
  }, [
    assignedBookIds,
    assignedUnitRefs,
    effectiveLessonBoardBookId,
    effectiveLessonBoardUnitId,
    library,
    studentId,
    whiteboardInkRevision,
  ])

  const switchLessonBoardNotebook = useCallback(
    (next: { bookId: string; unitId: string }) => {
      const bookId = next.bookId.trim()
      const unitId = next.unitId.trim()
      if (!bookId || !unitId) return
      if (bookId === effectiveLessonBoardBookId && unitId === effectiveLessonBoardUnitId) return
      flushWhiteboardSessionToLegacy()
      setLessonBoardBookId(bookId)
      setLessonBoardUnitId(unitId)
    },
    [effectiveLessonBoardBookId, effectiveLessonBoardUnitId, flushWhiteboardSessionToLegacy],
  )

  /** Next unit in the open board's book (library order only — never invented). */
  const nextUnitBoard = useMemo(
    () => resolveNextUnitInBook(lessonBoardBook, effectiveLessonBoardUnitId),
    [effectiveLessonBoardUnitId, lessonBoardBook],
  )

  const [dismissedNextUnitHandoffKey, setDismissedNextUnitHandoffKey] = useState<string | null>(
    null,
  )

  const nextUnitHandoffKey =
    selectedBookId && selectedUnitId && nextUnitBoard
      ? `${selectedBookId}::${selectedUnitId}::${nextUnitBoard.id}`
      : null

  const nearEndOfSelectedUnit = useMemo(() => {
    if (!selectedUnitId || unitPageBounds.max >= Number.MAX_SAFE_INTEGER / 2) return false
    return isNearEndOfUnitReader({
      pageNumber,
      spreadRightPage,
      unitMaxPage: unitPageBounds.max,
    })
  }, [pageNumber, selectedUnitId, spreadRightPage, unitPageBounds.max])

  const showNextUnitBoardPrompt = Boolean(
    nextUnitBoard &&
      nextUnitHandoffKey &&
      nearEndOfSelectedUnit &&
      selectedBookId === effectiveLessonBoardBookId &&
      selectedUnitId === effectiveLessonBoardUnitId &&
      dismissedNextUnitHandoffKey !== nextUnitHandoffKey,
  )

  const openNextUnitBoard = useCallback(() => {
    if (!effectiveLessonBoardBookId || !nextUnitBoard) return
    switchLessonBoardNotebook({
      bookId: effectiveLessonBoardBookId,
      unitId: nextUnitBoard.id,
    })
    if (nextUnitHandoffKey) setDismissedNextUnitHandoffKey(nextUnitHandoffKey)
  }, [
    effectiveLessonBoardBookId,
    nextUnitBoard,
    nextUnitHandoffKey,
    switchLessonBoardNotebook,
  ])

  const dismissNextUnitBoardPrompt = useCallback(() => {
    if (nextUnitHandoffKey) setDismissedNextUnitHandoffKey(nextUnitHandoffKey)
  }, [nextUnitHandoffKey])

  const whiteboardSlotPanelHeightPx = Math.max(
    1,
    pageCanvasHeightPx - WHITEBOARD_SLOT_INSET_PX * 2,
  )
  const lessonBoardActivePage = whiteboardSessionDoc
    ? getLessonBoardActivePage(whiteboardSessionDoc.pages, whiteboardSessionDoc.activePageId)
    : null
  const lessonBoardRunwayOrientation = lessonBoardActivePage?.orientation ?? 'standard'
  const lessonBoardSpreadOverlayWidthPx = Math.max(
    1,
    Math.round(spreadPageWidth * 2 - spreadSidePullPx(spreadPageWidth, spreadGutterPullRatio)),
  )
  const bookFocusZoom = useBookFocusZoom({
    pageAreaW: pageAreaSize.w,
    pageAreaH: pageAreaSize.h,
    spreadW: lessonBoardSpreadOverlayWidthPx,
    spreadH: pageCanvasHeightPx,
    baseScale: spreadReaderDisplayScale,
    spreadGridRef: spreadTurnGridRef,
    pageNumber,
    overlayOpen: open,
  })

  const readerSpreadOuterBox = useMemo(() => {
    if (!(lessonBoardSpreadOverlayWidthPx > 0) || !(pageCanvasHeightPx > 0)) return null
    // Focus hides the hardcover and transforms the page cluster only â€” match that box for pinch sizing.
    if (!showBookFrame || bookFocusZoom.focusActive) {
      return {
        widthPx: lessonBoardSpreadOverlayWidthPx,
        heightPx: pageCanvasHeightPx,
      }
    }
    return computeBookSpreadFrameOuterBox(lessonBoardSpreadOverlayWidthPx, pageCanvasHeightPx)
  }, [
    bookFocusZoom.focusActive,
    lessonBoardSpreadOverlayWidthPx,
    pageCanvasHeightPx,
    showBookFrame,
  ])

  const bookPinchZoom = useBookPinchZoom({
    containerRef: overlayRootRef,
    pageAreaRef,
    pinchSpreadRef,
    enabled: open && userPresented,
    focusPhase: bookFocusZoom.focusPhase,
    pageAreaW: pageAreaSize.w,
    pageAreaH: pageAreaSize.h,
    spreadOuterW: readerSpreadOuterBox?.widthPx ?? 0,
    spreadOuterH: readerSpreadOuterBox?.heightPx ?? 0,
    pageNumber,
  })

  const effectiveSpreadScreenScale =
    bookFocusZoom.focusLayout?.scale ?? 1

  useEffect(() => {
    onFocusPresentationChange?.(bookFocusZoom.focusActive)
  }, [bookFocusZoom.focusActive, onFocusPresentationChange])

  const lessonBoardCoversClassChrome = isWhiteboardOpen && !isWhiteboardMinimized
  useEffect(() => {
    onLessonBoardOpenChange?.(lessonBoardCoversClassChrome)
  }, [lessonBoardCoversClassChrome, onLessonBoardOpenChange])

  const lessonBoardSpreadWidthPx = lessonBoardWideSpreadWidthPx(
    lessonBoardSpreadOverlayWidthPx,
    WHITEBOARD_SLOT_INSET_PX,
  )
  const lessonBoardSlotWidthPx = Math.max(1, spreadPageWidth - WHITEBOARD_SLOT_INSET_PX * 2)
  const lessonBoardActiveLogicalWidthPx = lessonBoardActivePage
    ? lessonBoardLogicalWidthPx(lessonBoardActivePage, {
        slotWidthPx: lessonBoardSlotWidthPx,
        spreadWidthPx: lessonBoardSpreadWidthPx,
      })
    : lessonBoardSlotWidthPx
  const widePanelHeightPx =
    lessonBoardRunwayOrientation === 'wide'
      ? lessonBoardWidePanelHeightPx(
          lessonBoardResolveContentHeightPx(
            'wide',
            lessonBoardActiveLogicalWidthPx,
            lessonBoardActivePage?.contentHeightPx ?? 0,
          ),
          WHITEBOARD_CHROME_HEIGHT_PX,
        )
      : undefined
  const whiteboardCanvasViewportHeightPx = lessonBoardRunwayViewportHeightPx(
    lessonBoardRunwayOrientation,
    whiteboardSlotPanelHeightPx,
    WHITEBOARD_CHROME_HEIGHT_PX,
    widePanelHeightPx,
  )

  const { lessonBoardContentHeightPx, ensureLessonBoardRunwayBelowView } = useLessonBoardPageRunway({
    enabled: isWhiteboardOpen && !!whiteboardSessionDoc,
    viewportHeightPx: whiteboardCanvasViewportHeightPx,
    logicalWidthPx: lessonBoardActiveLogicalWidthPx,
    orientation: lessonBoardActivePage?.orientation ?? 'standard',
    storedContentHeightPx: lessonBoardActivePage?.contentHeightPx ?? 0,
    activePageId: whiteboardSessionDoc?.activePageId ?? '',
    commands: whiteboardSessionDoc?.commands ?? [],
    onPersistContentHeight: setActiveLessonBoardContentHeightPx,
  })

  const whiteboardContentHeightPx = lessonBoardContentHeightPx
  const ensureWhiteboardRunwayBelowView = ensureLessonBoardRunwayBelowView

  useWhiteboardOnBookUnitChange({
    selectedBookId,
    selectedUnitId,
    resetWhiteboardPlacementForUnit: resetPlacementForUnitChange,
  })

  useEffect(() => {
    if (!open) setIsWhiteboardMinimized(false)
  }, [open])

  const minimizeWhiteboard = useCallback(() => {
    setIsWhiteboardMinimized(true)
  }, [])

  const expandWhiteboard = useCallback(() => {
    if (bookFocusZoom.focusActive) {
      bookFocusZoom.clearFocusZoom()
    }
    setIsWhiteboardMinimized(false)
  }, [bookFocusZoom.clearFocusZoom, bookFocusZoom.focusActive])

  const selectLessonBoardPage = useCallback(
    (pageId: string) => {
      setActiveLessonBoardPage(pageId)
    },
    [setActiveLessonBoardPage],
  )

  const createLessonBoardPage = useCallback(
    (orientation: LessonBoardPageOrientation = 'standard') => {
      appendLessonBoardPage({
        orientation,
        viewportHeightPx: whiteboardCanvasViewportHeightPx,
        slotWidthPx: lessonBoardSlotWidthPx,
        spreadWidthPx: lessonBoardSpreadWidthPx,
        bookPageHint: pageNumber >= 1 ? pageNumber : undefined,
      })
    },
    [
      appendLessonBoardPage,
      lessonBoardSlotWidthPx,
      lessonBoardSpreadWidthPx,
      pageNumber,
      whiteboardCanvasViewportHeightPx,
    ],
  )

  const renameLessonBoardPage = useCallback(
    (pageId: string, title: string | undefined) => {
      setLessonBoardPageTitle(pageId, title)
    },
    [setLessonBoardPageTitle],
  )

  const saveLessonBoardNow = useCallback(() => {
    flushWhiteboardSessionToLegacy()
    requestWhiteboardSessionFlush()
    toast.success('Board saved')
  }, [flushWhiteboardSessionToLegacy])

  const deleteActiveLessonBoardPage = useCallback(() => {
    const doc = whiteboardSessionDoc
    if (
      !doc ||
      doc.pages.length <= 1 ||
      !effectiveLessonBoardBookId ||
      !effectiveLessonBoardUnitId ||
      !whiteboardStorageKey
    ) {
      return
    }
    const pageId = doc.activePageId
    const deleted = deleteLessonBoardPage(pageId)
    if (!deleted) return

    if (effectiveLessonBoardBookId && effectiveLessonBoardUnitId) {
      removeLessonBoardPageLinksForBoardPageIds(
        {
          studentId,
          bookId: effectiveLessonBoardBookId,
          unitId: effectiveLessonBoardUnitId,
        },
        [pageId],
      )
    }

    const pageKey = lessonBoardPageStorageKey(whiteboardStorageKey, pageId)
    setAnnotationsForStorageKey(
      studentId,
      effectiveLessonBoardBookId,
      effectiveLessonBoardUnitId,
      pageKey,
      [],
    )
    flushWhiteboardSessionToLegacy()
    requestWhiteboardSessionFlush()
    toast.success('Board page deleted')
  }, [
    deleteLessonBoardPage,
    effectiveLessonBoardBookId,
    effectiveLessonBoardUnitId,
    flushWhiteboardSessionToLegacy,
    studentId,
    whiteboardSessionDoc,
    whiteboardStorageKey,
  ])

  const canDeleteActiveLessonBoardPage = (whiteboardSessionDoc?.pages.length ?? 0) > 1

  const togglePageListRail = useCallback(() => {
    setIsPageListOpen((wasOpen) => {
      if (!wasOpen) {
        setPageListRailTab(isWhiteboardOpen ? 'board' : 'book')
      }
      return !wasOpen
    })
  }, [isWhiteboardOpen])

  const openWhiteboard = useCallback(() => {
    if (bookFocusZoom.focusActive) {
      bookFocusZoom.clearFocusZoom()
    }
    setIsWhiteboardMinimized(false)
    setIsWhiteboardOpen(true)
  }, [bookFocusZoom.clearFocusZoom, bookFocusZoom.focusActive])

  const toolbarLaunchApiRef = useRef<WhiteboardToolbarLaunchApi | null>(null)

  const registerWhiteboardToolbarLaunch = useCallback((api: WhiteboardToolbarLaunchApi | null) => {
    toolbarLaunchApiRef.current = api
  }, [])

  const launchOpenWhiteboard = useCallback(() => {
    const api = toolbarLaunchApiRef.current
    if (api) {
      api.playEnter(openWhiteboard)
      return
    }
    openWhiteboard()
  }, [openWhiteboard])

  const launchExpandWhiteboard = useCallback(() => {
    const api = toolbarLaunchApiRef.current
    if (api) {
      api.playEnter(expandWhiteboard)
      return
    }
    expandWhiteboard()
  }, [expandWhiteboard])

  const launchCloseWhiteboard = useCallback(() => {
    flushWhiteboardSessionToLegacy()
    requestWhiteboardSessionFlush()
    const api = toolbarLaunchApiRef.current
    if (api) {
      api.playExit(() => setIsWhiteboardOpen(false))
      return
    }
    setIsWhiteboardOpen(false)
  }, [flushWhiteboardSessionToLegacy])

  const launchMinimizeWhiteboard = useCallback(() => {
    const api = toolbarLaunchApiRef.current
    if (api) {
      api.playExit(minimizeWhiteboard)
      return
    }
    minimizeWhiteboard()
  }, [minimizeWhiteboard])

  const {
    boardLinkPlacementActive,
    lessonBoardPageLinks,
    activeBoardPageLink,
    startBoardLinkPlacement,
    cancelBoardLinkPlacement,
    placeBoardLinkAt,
    removeActiveBoardPageLink,
    openBoardFromLink,
  } = useBoardLinkPlacement({
    studentId,
    bookId: effectiveLessonBoardBookId,
    unitId: effectiveLessonBoardUnitId,
    whiteboardSessionDoc,
    minimizeWhiteboard: launchMinimizeWhiteboard,
    openWhiteboard,
    selectLessonBoardPage: setActiveLessonBoardPage,
    setLessonBoardPageBookPageHint,
  })

  const {
    readingCheckHotspotPlacementActive,
    cancelReadingCheckHotspotPlacement,
    placeReadingCheckHotspotAt,
    readingCheckHotspotPreviewPdfPage,
    readingCheckHotspotPreviewCenter,
    readingCheckHotspotPreviewLabel,
    onReadingCheckHotspotPreviewClick,
  } = useReadingCheckHotspotPlacement({
    enabled: open && userPresented,
    bookId: selectedBookId,
    unitId: selectedUnitId,
    selectedBook,
    selectedUnit,
    totalPdfPages: numPages,
    leftPdfPage: pageNumber,
    rightPdfPage: spreadRightPage ?? null,
    minimizeWhiteboard: launchMinimizeWhiteboard,
    cancelBoardLinkPlacement,
  })

  const startBoardLinkPlacementGuarded = useCallback(() => {
    if (readingCheckHotspotPlacementActive) {
      cancelReadingCheckHotspotPlacement()
    }
    startBoardLinkPlacement()
  }, [
    cancelReadingCheckHotspotPlacement,
    readingCheckHotspotPlacementActive,
    startBoardLinkPlacement,
  ])

  const readerViewportAspectRatio = useMemo(() => {
    const r = pageAspectRatio
    if (!Number.isFinite(r) || r <= 0) {
      return DEFAULT_PAGE_ASPECT_RATIO * 2
    }
    return r * 2
  }, [pageAspectRatio])

  const turnSlideSeqRef = useRef(0)
  const [turnSlide, setTurnSlide] = useState<SpreadTurnSlidePayload | null>(null)

  const onBeforeCommitPage = useCallback(
    (fromPage: number, toPage: number) => {
      if (!spreadSlideEnabled || typeof window === 'undefined') return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      const direction = (toPage > fromPage ? 1 : -1) as 1 | -1
      const outgoing = resolveSpreadAnchorPages(fromPage, visiblePages)
      turnSlideSeqRef.current += 1
      setTurnSlide({ captureUrl: null, direction, outgoing, seq: turnSlideSeqRef.current })
    },
    [visiblePages],
  )

  const handleTurnSlideComplete = useCallback(() => {
    setTurnSlide(null)
  }, [])

  useEffect(() => {
    if (!open) setTurnSlide(null)
  }, [open])

  const { goToPage, goToAdjacentPage, commitPageJump } = useGatedBookNavigation({
    selectedBookId,
    selectedUnitId,
    selectedBook,
    selectedUnit,
    numPages,
    visiblePages,
    pageNumber,
    pageJumpDraft,
    numberingMode,
    printedJumpBounds,
    layoutSpreadPageWidth,
    open,
    setPageNumber,
    onBeforeCommitPage,
  })

  useArrowKeyPageTurn({
    open,
    enabled: readerLayoutMode === 'spread',
    goToAdjacentPage,
  })

  const enterPageGridOverview = useCallback(() => {
    bookFocusZoom.clearFocusZoom()
    bookPinchZoom.clearPinchZoom()
    setAnnotationMode('select')
    setReaderLayoutMode('pageGrid')
  }, [bookFocusZoom, bookPinchZoom, setAnnotationMode])

  const exitPageGridOverview = useCallback(() => {
    setReaderLayoutMode('spread')
  }, [])

  const openSpreadAtPageFromGrid = useCallback(
    (page: number) => {
      goToPage(page)
      setReaderLayoutMode('spread')
    },
    [goToPage],
  )

  const { onDocumentLoadSuccess } = useBookPdfPageSync({
    selectedBookId,
    selectedUnitId,
    selectedBook,
    selectedUnit,
    numPages,
    visiblePages,
    pageNumber,
    setNumPages,
    setPageNumber,
    primeReaderPageAspectRatio,
  })

  usePageJumpUiSync({
    isPageListOpen,
    activePageRowRef,
    pageNumber,
    numPages,
    pageJumpFocused,
    spreadRightPage,
    pageAlignmentRuntime,
    selectedBook,
    selectedUnit,
    numberingMode,
    setPageJumpDraft,
  })

  const getCurrentPageCaptureEl = useCurrentPageCaptureEl({
    isWhiteboardOpen,
    wbCaptureRootRef,
    spreadRightPage,
    annotationTargetPage,
    leftPageCaptureRef,
    rightPageCaptureRef,
  })

  const {
    captureFormat,
    setCaptureFormat,
    jpegQuality,
    setJpegQuality,
    hideChromeForCapture,
    setHideChromeForCapture,
    watermarkEnabled,
    setWatermarkEnabled,
    suppressChrome,
    setSuppressChrome,
    regionSelectOpen,
    setRegionSelectOpen,
    captureBusy,
    setCaptureBusy,
    captionDialog,
    setCaptionDialog,
    captionDraft,
    setCaptionDraft,
    pdfDialogOpen,
    setPdfDialogOpen,
    pdfFrom,
    setPdfFrom,
    pdfTo,
    setPdfTo,
    pdfExporting,
    setPdfExporting,
    pdfProgressLabel,
    setPdfProgressLabel,
    hasLastImageCapture,
    setHasLastImageCapture,
    runImageCapture,
    runPdfPacketExport,
    copyLastCaptureToClipboard,
  } = useCaptureExportController({
    selectedBookId,
    selectedUnit,
    selectedBook,
    numPages,
    pdfFrom: '1',
    pdfTo: '1',
    exportCaptureLayoutActive,
    pageNumber,
    studentId,
    hideChromeForCapture: true,
    watermarkEnabled: false,
    studentName,
    annotationMode,
    setAnnotationMode,
    isWhiteboardOpen,
    selectedUnitId,
    annotationTargetPage,
    bookPageAtCapture: pageNumber,
    captureFormat: 'png',
    jpegQuality: 0.88,
    setPageNumber,
    setExportCaptureLayoutActive,
    setPdfDialogOpen: () => undefined,
    getCurrentPageCaptureEl,
    leftPageCaptureRef,
    pageAreaRef,
  })

  const pasteSpreadImageFromSystemClipboard = useCallback(
    () => spreadImagePasteRef.current?.pasteImageFromSystemClipboard() ?? Promise.resolve({ ok: false }),
    [],
  )

  useBookOverlayKeyboardShortcuts({
    open,
    onClose,
    annotationMode,
    setAnnotationMode,
    penStrokeProfile,
    setPenStrokeProfile,
    stampVariant,
    setStampVariant,
    pulseStampIndicator,
    stickerKind,
    setStickerKind,
    writableStickerVariant,
    setWritableStickerVariant,
    eyedropperVariant,
    setEyedropperVariant,
    isAnnotationRailVisible,
    toggleAnnotationRailKeyboard,
    isPageListOpen,
    setIsPageListOpen,
    pageListRailTab,
    setPageListRailTab,
    isWhiteboardOpen: isWhiteboardOpen && !isWhiteboardMinimized,
    isWhiteboardSessionOpen: isWhiteboardOpen,
    setIsWhiteboardOpen,
    launchOpenWhiteboard,
    launchExpandWhiteboard,
    launchCloseWhiteboard,
    setWhiteboardSlotSide,
    isWhiteboardMinimized,
    pdfDialogOpen,
    regionSelectOpen,
    boardLinkPlacementActive,
    cancelBoardLinkPlacement,
    readingCheckHotspotPlacementActive,
    cancelReadingCheckHotspotPlacement,
    captionDialogOpen: captionDialog != null,
    translateDockOpen: classToolId === 'translate',
    setTranslateDockOpen: (v: boolean) => setClassToolId(v ? 'translate' : null),
    penThicknessStep,
    setPenThicknessStep,
    markerThicknessStep,
    setMarkerThicknessStep,
    shapeThicknessStep,
    setShapeThicknessStep,
    textThicknessStep,
    setTextThicknessStep,
    stickyThicknessStep,
    setStickyThicknessStep,
    stampThicknessStep,
    setStampThicknessStep,
    eraserPixelThicknessStep,
    setEraserPixelThicknessStep,
    toolbarCaps,
    selectAllOnActivePage,
    selectAllIncludingLockedOnActivePage,
    deselectAllOnActivePage,
    hasAnyAnnotationSelection,
    getPageAnnotationRef,
    getWhiteboardAnnotationRef: () => wbAnnRef,
    getActiveAnnotationRef,
    pasteSpreadImageFromSystemClipboard,
    focusZoomPhase: bookFocusZoom.focusPhase,
    toggleFocusZoom: bookFocusZoom.toggleFocusTool,
    clearFocusZoom: bookFocusZoom.clearFocusZoom,
    cancelFocusDraw: bookFocusZoom.clearFocusZoom,
    focusZoomEnabled: bookFocusZoom.focusZoomEnabled,
    pinchZoomActive: bookPinchZoom.pinchZoomActive,
    clearPinchZoom: bookPinchZoom.clearPinchZoom,
    stepPinchZoom: bookPinchZoom.stepPinchZoom,
    onToggleBrowserFullscreen: browserFullscreenSupported
      ? toggleBrowserFullscreen
      : undefined,
  })

  const unitThumbFileUrl = hasResolvedUnit && selectedUnit ? makeUnitFileUrl(selectedUnit.filePath) : ''

  const handleCaptionSave = useCallback(async () => {
    if (!captionDialog) return
    const t = captionDraft.trim()
    if (t) {
      try {
        await patchStudentWorkCaption({
          studentId,
          fileRelativePath: captionDialog.fileRel,
          caption: t,
        })
        toast.success('Caption saved to meta file')
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Could not save caption'
        toast.error(msg)
      }
    }
    setCaptionDialog(null)
  }, [captionDialog, captionDraft, studentId, setCaptionDialog])

  return {
    ANIMATION_MS,
    readerViewportAspectRatio,
    PdfPage,
    LESSON_BOARD_SURFACE,
    activePageRowRef,
    annotationMode,
    effectiveAnnotationMode,
    annotationTargetPage,
    bookStageRef,
    captionDialog,
    captionDraft,
    captureBusy,
    captureFormat,
    commitPageJump,
    copyLastCaptureToClipboard,
    eraserLineThicknessStep,
    eraserPixelThicknessStep,
    error,
    getActiveAnnotationRef,
    goToAdjacentPage,
    goToPage,
    handleCaptionSave,
    hasCurriculumOrHistory,
    hasLastImageCapture,
    hasResolvedUnit,
    hideChromeForCapture,
    interactiveVocabPack,
    readingStoryHit,
    liveReadingCheckPack,
    isAnnotationRailVisible,
    isAnnotationRailPinned,
    setIsAnnotationRailPinned,
    annotationRailPinHydrated,
    annotationRailKeyboardDismissAt,
    annotationRailKeyboardOpenAt,
    toggleAnnotationRailKeyboard,
    isMounted,
    open,
    isPageListOpen,
    syncWorkspaceDeskLeftPx,
    pageListRailTab,
    exportCaptureLayoutActive,
    showBookFrame,
    setShowBookFrame,
    readerLayoutMode,
    enterPageGridOverview,
    exitPageGridOverview,
    openSpreadAtPageFromGrid,
    isVisible,
    isWhiteboardOpen: isWhiteboardOpen && !isWhiteboardMinimized,
    isWhiteboardSessionOpen: isWhiteboardOpen,
    userPresented,
    confirmSpreadSlotPixels,
    spreadReportEpoch,
    onSpreadSlotsPixelsReady: handleSpreadSlotsPixelsReady,
    readerPresentationReady,
    spreadDrawableReady,
    spreadSlotsPixelsReady,
    spreadTurnGridRef,
    turnSlide,
    handleTurnSlideComplete,
    jpegQuality,
    leftPageCaptureRef,
    loading,
    makeUnitFileUrl,
    markerColor,
    markerColorSource,
    markerCustomHex,
    pickMarkerSwatchColor,
    pickMarkerCustomColor,
    markerThicknessStep,
    shapeThicknessStep,
    textThicknessStep,
    stickyThicknessStep,
    stampThicknessStep,
    numPages,
    numberingMode,
    onDocumentLoadSuccess,
    onLeftAnnotationCaps,
    onPdfPageLoadSuccess,
    onRightAnnotationCaps,
    onSpreadOverlayCaps,
    onWhiteboardCaps,
    overlayRootRef,
    pinchSpreadRef,
    pageAreaRef,
    pageCanvasHeightPx,
    pinchZoomState: bookPinchZoom.pinchZoomState,
    pinchZoomActive: bookPinchZoom.pinchZoomActive,
    clearPinchZoom: bookPinchZoom.clearPinchZoom,
    stepPinchZoom: bookPinchZoom.stepPinchZoom,
    pageAspectRatio,
    pageJumpDraft,
    pageListNumbers: visiblePages,
    pageListScrollRoot,
    pageNumber,
    pdfDialogOpen,
    pdfExporting,
    pdfFrom,
    pdfProgressLabel,
    pdfReady,
    pdfTo,
    penSwatchId,
    pickPenSwatch,
    penStrokeProfile,
    setPenStrokeProfile,
    penColorSource,
    penCustomHex,
    pickPenCustomColor,
    onEyedropperPick,
    textColor,
    setTextColor,
    pickTextColor,
    shapeStrokeSwatchId,
    setShapeStrokeSwatchId,
    pickShapeStrokeSwatch,
    stickyFillColor,
    setStickyFillColor,
    pickStickyFillColor,
    penColor,
    penInkStyle,
    penThicknessStep,
    penLineDashStyle,
    setPenLineDashStyle,
    markerLineDashStyle,
    setMarkerLineDashStyle,
    markerStraightStroke,
    setMarkerStraightStroke,
    markerDecoratedEdge,
    setMarkerDecoratedEdge,
    penAutoGroupConnected,
    setPenAutoGroupConnected,
    marqueeSelectRule,
    setMarqueeSelectRule,
    shapeLineDashStyle,
    setShapeLineDashStyle,
    shapeStrokeEnabled,
    setShapeStrokeEnabled,
    shapeFillMode,
    setShapeFillMode,
    shapeFillColor,
    setShapeFillColor,
    shapeRoundedCorners,
    setShapeRoundedCorners,
    eyedropperVariant,
    setEyedropperVariant,
    printedJumpBounds,
    regionSelectOpen,
    rightPageCaptureRef,
    runImageCapture,
    runPdfPacketExport,
    selectedBook,
    selectedBookId,
    selectedUnit,
    setAnnotationMode,
    setAnnotationTargetPage,
    setCaptureFormat,
    setCaptionDialog,
    setCaptionDraft,
    setEraserLineThicknessStep,
    setEraserPixelThicknessStep,
    setHideChromeForCapture,
    setIsAnnotationRailVisible,
    activeClassSessionId,
    isPrepMode,
    setIsPageListOpen,
    togglePageListRail,
    setPageListRailTab,
    setIsWhiteboardOpen,
    setJpegQuality,
    setMarkerThicknessStep,
    setShapeThicknessStep,
    setTextThicknessStep,
    setStickyThicknessStep,
    setStampThicknessStep,
    setPageJumpDraft,
    setPageJumpFocused,
    setPageListScrollRoot,
    setPdfDialogOpen,
    setPdfFrom,
    setPdfTo,
    setPenThicknessStep,
    setRegionSelectOpen,
    setStampVariant,
    setStickerKind,
    setWritableStickerVariant,
    setStampQuestionColor,
    setTextFillColor,
    pickTextFillColor,
    setTextVisualStyle,
    setTextAlign,
    setTextFontId,
    setTextFontWeight,
    setWatermarkEnabled,
    openWhiteboardWithDefaultPlacement,
    shapeColor,
    shapeStrokeWidthScale,
    showSpreadRightPage,
    spreadDisplayScale,
    spreadReaderDisplayScale,
    spreadFitMotionActive,
    spreadGutterPullRatio,
    spreadPageWidth,
    spreadStrokeCaptureEnabled: spreadStrokeCaptureEnabled && !bookFocusZoom.focusDrawActive,
    spreadStrokeOverlayRef,
    spreadSessionStoreRef,
    spreadImagePasteRef,
    wbStrokeOverlayRef,
    whiteboardStrokeCaptureEnabled,
    whiteboardSessionStoreRef,
    whiteboardSelectionMoveClampRef,
    whiteboardSessionDoc,
    whiteboardInkRevision,
    appendWhiteboardSessionCommand,
    whiteboardSessionUndo,
    whiteboardSessionRedo,
    whiteboardSessionClear,
    selectLessonBoardPage,
    createLessonBoardPage,
    renameLessonBoardPage,
    saveLessonBoardNow,
    deleteActiveLessonBoardPage,
    canDeleteActiveLessonBoardPage,
    lessonBoardActivePageRowRef,
    boardLinkPlacementActive,
    lessonBoardPageLinks,
    activeBoardPageLink,
    startBoardLinkPlacement: startBoardLinkPlacementGuarded,
    cancelBoardLinkPlacement,
    placeBoardLinkAt,
    removeActiveBoardPageLink,
    openBoardFromLink,
    readingCheckHotspotPlacementActive,
    cancelReadingCheckHotspotPlacement,
    placeReadingCheckHotspotAt,
    readingCheckHotspotPreviewPdfPage,
    readingCheckHotspotPreviewCenter,
    readingCheckHotspotPreviewLabel,
    onReadingCheckHotspotPreviewClick,
    onWhiteboardOverlayCaps,
    layoutSpreadPageWidth,
    spreadRightPage,
    stampScale,
    stampVariant,
    stampIndicatorPulseEpoch,
    stickerKind,
    writableStickerVariant,
    stampQuestionColor,
    stampEffectsEnabled,
    setStampEffectsEnabled,
    stickyFontSizeNorm,
    strokeColor,
    strokeWidthScale,
    eraserLineStrokeWidthScale,
    penStrokeWidthScale,
    strokeLineDashStyleForInk,
    bookFocusZoomEnabled: bookFocusZoom.focusZoomEnabled,
    focusZoomPhase: bookFocusZoom.focusPhase,
    focusZoomDrawActive: bookFocusZoom.focusDrawActive,
    focusZoomActive: bookFocusZoom.focusActive,
    focusLayout: bookFocusZoom.focusLayout,
    effectiveSpreadScreenScale,
    toggleFocusZoom: bookFocusZoom.toggleFocusTool,
    startFocusDraw: bookFocusZoom.startFocusDraw,
    clearFocusZoom: bookFocusZoom.clearFocusZoom,
    commitFocusNormRect: bookFocusZoom.commitFocusNormRect,
    applyFocusPanDelta: bookFocusZoom.applyFocusPanDelta,
    cancelFocusDraw: bookFocusZoom.clearFocusZoom,
    coachLessonId: vocabReaderHit?.lesson.id ?? null,
    coachLessonTitle: vocabReaderHit?.lesson.title ?? null,
    coachPartId: vocabReaderHit?.part.id ?? null,
    coachPartTitle: vocabReaderHit?.part.title ?? currentTocPartTitle ?? null,
    studentId,
    studentName,
    suppressChrome,
    textFontSizeNorm,
    textFontId,
    textFontWeight,
    textFillColor,
    bookTextVisualStyle,
    textVisualStyle,
    textAlign,
    toolbarCaps,
    translateDockOpen: classToolId === 'translate',
    setTranslateDockOpen: (v: boolean) => setClassToolId(v ? 'translate' : null),
    classToolId,
    setClassToolId,
    unitPageBounds,
    unitThumbFileUrl,
    visiblePages,
    watermarkEnabled,
    leftAnnRef,
    rightAnnRef,
    wbAnnRef,
    wbCaptureRootRef,
    whiteboardStorageKey,
    lessonBoardBookId: effectiveLessonBoardBookId,
    lessonBoardUnitId: effectiveLessonBoardUnitId,
    boardFooterLabel,
    boardBookFullTitle,
    boardBookAccentColor,
    boardShelf,
    nextUnitBoard,
    showNextUnitBoardPrompt,
    openNextUnitBoard,
    dismissNextUnitBoardPrompt,
    switchLessonBoardNotebook,
    whiteboardSlotSide,
    whiteboardLayoutMode,
    whiteboardFloatRect,
    setWhiteboardSlotSide,
    applyWhiteboardSlotSide,
    registerWhiteboardSlotMotion,
    registerWhiteboardToolbarLaunch,
    whiteboardContentHeightPx,
    ensureWhiteboardRunwayBelowView,
    isWhiteboardMinimized,
    minimizeWhiteboard,
    expandWhiteboard,
    openWhiteboard,
    swapWhiteboardSlotSide,
    floatWhiteboard,
    dockWhiteboardToSlot,
    forceDockWhiteboard,
    commitWhiteboardFloatRect,
    browserFullscreenSupported,
    isBrowserFullscreen,
    toggleBrowserFullscreen,
  }
}

export type FullscreenBookOverlayViewModel = ReturnType<typeof useFullscreenBookOverlayController>

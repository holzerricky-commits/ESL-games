'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { resolveSpreadGutterPullRatio } from '@/lib/books/spread-gutter'
import type { BookLibraryPayload } from '@/lib/books/types'
import { patchStudentWorkCaption } from '@/lib/books/book-capture'
import { BOOK_OVERLAY_NOTEBOOK_UI_ENABLED, makeUnitFileUrl, WHITEBOARD_NOTEBOOK_SURFACE } from '../constants'
import { useArrowKeyPageTurn } from './useArrowKeyPageTurn'
import { useBookOverlayKeyboardShortcuts } from './useBookOverlayKeyboardShortcuts'
import { useAnnotationController } from './useAnnotationController'
import { useEyedropperPick } from './useEyedropperPick'
import { useCaptureExportController } from './useCaptureExportController'
import { useLessonPaperContextHeadings } from './useLessonPaperContextHeadings'
import { useLessonPaperEditorInteractions } from './useLessonPaperEditorInteractions'
import { useLessonPaperLayoutController } from './useLessonPaperLayoutController'
import { useBookLibraryLoader } from './useBookLibraryLoader'
import { useBookViewportLayout } from './useBookViewportLayout'
import { useGatedBookNavigation } from './useGatedBookNavigation'
import { useBookPdfPageSync } from './useBookPdfPageSync'
import { useFullscreenOverlayPanels } from './useFullscreenOverlayPanels'
import { usePdfJsWorker } from './usePdfJsWorker'
import { useLessonPaperPersistence } from './useLessonPaperPersistence'
import { useLessonPaperIntentEntry } from './useLessonPaperIntentEntry'
import { useLessonPaperNotebookNavigation } from './useLessonPaperNotebookNavigation'
import { useWhiteboardNotebookCapture } from './useWhiteboardNotebookCapture'
import { useWhiteboardOnBookUnitChange } from './useWhiteboardOnBookUnitChange'
import { useWhiteboardPlacement } from './useWhiteboardPlacement'
import { useInfiniteWhiteboardRunway } from './useInfiniteWhiteboardRunway'
import type { WhiteboardToolbarLaunchApi } from './useWhiteboardToolbarLaunch'
import { resolveWhiteboardStorageKey } from '@/lib/books/whiteboard-storage'
import { usePdfUnitCacheOnChange } from './usePdfUnitCacheOnChange'
import { useInteractiveVocabPack } from './useInteractiveVocabPack'
import { useBookReaderSpreadModel } from './useBookReaderSpreadModel'
import { useLessonPaperNotebookCanvasScroll } from './useLessonPaperNotebookCanvasScroll'
import { usePageJumpUiSync } from './usePageJumpUiSync'
import { useBookPageAlignmentModel } from './useBookPageAlignmentModel'
import { useCurrentPageCaptureEl } from './useCurrentPageCaptureEl'
import { preloadAllManifestBrushPatterns } from '@/lib/books/brush-pattern-loader'
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
import { spreadResizeScaleEnabled, spreadSlideEnabled } from '@/lib/books/feature-flags'
import { resolveSpreadAnchorPages } from '@/lib/books/reader-spread-navigation'
import type { SpreadTurnSlidePayload } from './useSpreadTurnSlide'
import { getStudentClassSessionById } from '@/lib/students/selectors'
import { heuristicBookOverlaySpreadPageWidthPx } from '@/lib/books/spread-viewport-layout'
import type { FullscreenBookOverlayProps } from '../types'

/** A4-style portrait default until PDF viewport is primed (see B3). */
const DEFAULT_PAGE_ASPECT_RATIO = 1 / 1.414

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
    assignedUnitRefs = [],
    curriculumHistory = [],
    studentName,
    numberingMode = 'mapped',
    open,
    onClose,
    presented: presentedProp,
    onBookReadyToPresent,
    onBookPaintInvalidated,
    onBookOpenPaintTimeout,
  } = props

  const userPresented = presentedProp ?? true

  useEffect(() => {
    if (!open) return
    preloadAllManifestBrushPatterns()
  }, [open])

  const ANIMATION_MS = 650
  const [library, setLibrary] = useState<BookLibraryPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null)
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [numPages, setNumPages] = useState<number | null>(null)
  const [targetSpreadPageWidth, setTargetSpreadPageWidth] = useState(initialSpreadPageWidthPx)
  const [spreadPageWidth, setSpreadPageWidth] = useState(initialSpreadPageWidthPx)
  const [pageAspectRatio, setPageAspectRatio] = useState(DEFAULT_PAGE_ASPECT_RATIO)
  const [isSinglePageMode, setIsSinglePageMode] = useState(false)
  const [pdfReady, setPdfReady] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  /** Spread slots reported pixel-ready for the current anchor (prefetch drawn or pdf composited). */
  const [spreadSlotsPixelsReady, setSpreadSlotsPixelsReady] = useState(false)
  /** Max-wait fallback when slots/cache never satisfy drawable (non-map and map timeout). */
  const [spreadDrawableTimedOut, setSpreadDrawableTimedOut] = useState(false)
  /** Bumps so `BookCanvasStage` resets slot reporting when reopening, unit change, or width bucket. */
  const [spreadReportEpoch, setSpreadReportEpoch] = useState(0)
  const [isPageListOpen, setIsPageListOpen] = useState(false)
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false)
  const [isWhiteboardMinimized, setIsWhiteboardMinimized] = useState(false)
  const [translateDockOpen, setTranslateDockOpen] = useState(false)

  useEffect(() => {
    if (!open) setTranslateDockOpen(false)
  }, [open])

  /** Right rail: blank lesson paper beside the book (Phase 1). */
  const [isLessonPaperOpen, setIsLessonPaperOpen] = useState(false)
  const [lessonPaperHtml, setLessonPaperHtml] = useState('')
  const lessonPaperHtmlRef = useRef('')
  const [lessonPaperEditVersion, setLessonPaperEditVersion] = useState(0)
  const [lessonPaperSectionId, setLessonPaperSectionId] = useState<string | null>(null)
  const [lessonPaperHeader, setLessonPaperHeader] = useState<{
    title: string
    dateLabel: string
    lessonPartLabel: string
    pageLabel: string
  } | null>(null)
  const [lessonPaperSaveState, setLessonPaperSaveState] = useState<'idle' | 'typing' | 'saving' | 'saved' | 'error'>(
    'idle',
  )
  const [lessonPaperDocUpdatedAt, setLessonPaperDocUpdatedAt] = useState<string | null>(null)
  const [lessonPaperBreadcrumb, setLessonPaperBreadcrumb] = useState<string>('')
  const [lessonPaperViewMode, setLessonPaperViewMode] = useState<'left' | 'right' | 'split'>('left')
  const [lessonPaperCanvasPageIndex, setLessonPaperCanvasPageIndex] = useState(0)
  /** Phase 2: intent-based headings only; do not append on page turn. */
  const lessonPaperAutoAppendHeadingsEnabled = false
  const [lessonPaperPanPx, setLessonPaperPanPx] = useState(0)
  const lessonPaperPanRef = useRef(0)
  const lessonPaperEditorRef = useRef<HTMLDivElement | null>(null)
  const lessonPaperLastPartContextKeyRef = useRef<string | null>(null)
  const lessonPaperLastInputAtRef = useRef(0)
  const lessonPaperScrollTimerRef = useRef<number[]>([])
  const lessonPaperHydratedRef = useRef(false)
  const lessonPaperClassRef = useRef<string | null>(null)
  const lessonPaperSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lessonPaperEditSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lessonPaperHasPendingChangesRef = useRef(false)
  const onNotebookIntentRef = useRef<
    (trigger: 'typing' | 'paste' | 'whiteboard_capture' | 'vocab_save' | 'start_note') => void
  >(() => {})
  const [pageAreaSize, setPageAreaSize] = useState({ w: 0, h: 0 })
  const pageAreaRef = useRef<HTMLDivElement | null>(null)
  const activePageRowRef = useRef<HTMLButtonElement | null>(null)
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
  const wbCaptureRootRef = useRef<HTMLDivElement | null>(null)

  const { lessonPaperScrollRunwayPx, lessonPaperScrollRef } = useLessonPaperLayoutController({
    isLessonPaperOpen,
  })

  const activeClassSession = activeClassSessionId
    ? getStudentClassSessionById(studentId, activeClassSessionId)
    : null
  const lessonPaperPrimarySectionId = useMemo(
    () => activeClassSession?.lessonNotebookSession?.sections?.[0]?.sectionId ?? null,
    [activeClassSession],
  )

  const notebookEditable = useMemo(
    () => activeClassSession?.status === 'in_progress',
    [activeClassSession],
  )

  const lessonPaperDraftStorageKey = useMemo(() => {
    const sectionId = lessonPaperSectionId ?? lessonPaperPrimarySectionId
    return activeClassSessionId && sectionId
      ? `lesson-paper-draft::${studentId}::${activeClassSessionId}::${sectionId}`
      : null
  }, [activeClassSessionId, lessonPaperPrimarySectionId, lessonPaperSectionId, studentId])

  const { flushLessonPaperSaveNow } = useLessonPaperPersistence({
    studentId,
    activeClassSessionId,
    isLessonPaperOpen,
    lessonPaperEditVersion,
    lessonPaperSectionId,
    lessonPaperPrimarySectionId,
    lessonPaperDraftStorageKey,
    lessonPaperDocUpdatedAt,
    lessonPaperEditorRef,
    lessonPaperHtmlRef,
    lessonPaperHasPendingChangesRef,
    lessonPaperHydratedRef,
    lessonPaperClassRef,
    lessonPaperSaveTimerRef,
    setLessonPaperSectionId,
    setLessonPaperHeader,
    setLessonPaperBreadcrumb,
    setLessonPaperDocUpdatedAt,
    setLessonPaperHtml,
    setLessonPaperSaveState,
  })

  const handleSetLessonPaperOpen = useCallback(
    (nextOpen: boolean) => {
      if (!BOOK_OVERLAY_NOTEBOOK_UI_ENABLED && nextOpen) return
      if (!nextOpen && isLessonPaperOpen) {
        flushLessonPaperSaveNow()
      }
      setIsLessonPaperOpen(nextOpen)
    },
    [flushLessonPaperSaveNow, isLessonPaperOpen],
  )

  useEffect(() => {
    if (!BOOK_OVERLAY_NOTEBOOK_UI_ENABLED && isLessonPaperOpen) {
      setIsLessonPaperOpen(false)
    }
  }, [isLessonPaperOpen])

  useEffect(() => {
    if (open) return
    if (!isLessonPaperOpen) return
    flushLessonPaperSaveNow()
    setIsLessonPaperOpen(false)
  }, [open, isLessonPaperOpen, flushLessonPaperSaveNow])

  useEffect(
    () => () => {
      if (lessonPaperSaveTimerRef.current) clearTimeout(lessonPaperSaveTimerRef.current)
      if (lessonPaperEditSyncTimerRef.current) clearTimeout(lessonPaperEditSyncTimerRef.current)
      for (const timerId of lessonPaperScrollTimerRef.current) clearTimeout(timerId)
    },
    [],
  )

  const scheduleLessonPaperEditSync = useCallback(() => {
    if (lessonPaperEditSyncTimerRef.current) clearTimeout(lessonPaperEditSyncTimerRef.current)
    lessonPaperEditSyncTimerRef.current = setTimeout(() => {
      lessonPaperEditSyncTimerRef.current = null
      setLessonPaperEditVersion((v) => v + 1)
    }, 950)
  }, [])

  const scheduleLessonPaperEditorFocus = useCallback((placeCaretAtEnd = false) => {
    const rafId = window.requestAnimationFrame(() => {
      const editor = lessonPaperEditorRef.current
      if (!editor) return
      editor.focus()
      if (!placeCaretAtEnd) return
      const selection = window.getSelection()
      if (!selection) return
      const range = document.createRange()
      range.selectNodeContents(editor)
      range.collapse(false)
      selection.removeAllRanges()
      selection.addRange(range)
    })
    return () => window.cancelAnimationFrame(rafId)
  }, [])

  const focusLessonPaperMarkerForTyping = useCallback((markerId: string) => {
    const editor = lessonPaperEditorRef.current
    if (!editor) return
    const headingEl = editor.querySelector(`[data-notebook-marker="${markerId}"]`) as HTMLElement | null
    if (!headingEl) return
    const selection = window.getSelection()
    if (!selection) return
    let anchorNode: Node | null = headingEl.nextSibling
    let anchorOffset = 0
    if (!anchorNode) {
      const paragraph = document.createElement('p')
      paragraph.appendChild(document.createElement('br'))
      editor.appendChild(paragraph)
      anchorNode = paragraph
      anchorOffset = 0
    }
    editor.focus()
    const range = document.createRange()
    range.setStart(anchorNode, anchorOffset)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
  }, [])

  const applyNotebookHtmlFromCapture = useCallback((html: string, docUpdatedAt: string) => {
    setLessonPaperHtml(html)
    lessonPaperHtmlRef.current = html
    setLessonPaperDocUpdatedAt(docUpdatedAt)
    lessonPaperHasPendingChangesRef.current = false
    if (lessonPaperEditorRef.current) lessonPaperEditorRef.current.innerHTML = html
    setLessonPaperEditVersion((v) => v + 1)
    setLessonPaperSaveState('saved')
  }, [])

  const {
    applyLessonPaperCommand,
    onLessonPaperInput,
    onLessonPaperPaste,
  } = useLessonPaperEditorInteractions({
    isLessonPaperOpen,
    lessonPaperEditorRef,
    lessonPaperLastInputAtRef,
    lessonPaperHtmlRef,
    lessonPaperHasPendingChangesRef,
    setLessonPaperEditVersion,
    setLessonPaperSaveState,
    scheduleLessonPaperEditSync,
    onNotebookIntent: (trigger) => onNotebookIntentRef.current(trigger),
  })

  usePdfJsWorker(setPdfReady)

  useBookLibraryLoader({
    open,
    assignedBookIds,
    assignedUnitRefs,
    curriculumHistory,
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

  /** Reader may resolve from book ids, unit refs, or session history — do not gate the frame on book ids alone. */
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
    }
    prevSelectedUnitForPaintRef.current = selectedUnitId
  }, [open, selectedUnitId])

  useFullscreenOverlayPanels({
    open,
    presentationReady: readerPresentationReady,
    userPresented,
    setIsMounted,
    setIsVisible,
    setIsPageListOpen,
    setIsWhiteboardOpen,
    isLessonPaperOpen,
    setLessonPaperViewMode,
    lessonPaperPanRef,
    isWhiteboardOpen,
    isPageListOpen,
    pageNumber,
    isSinglePageMode,
    numPages,
    library,
    selectedBookId,
    selectedUnitId,
  })

  useBookViewportLayout({
    open,
    pageAspectRatio,
    isLessonPaperOpen,
    spreadResizeScaleEnabled,
    selectedBookId,
    selectedUnitId,
    selectedUnit,
    pageAreaRef,
    spreadRenderBaseKeyRef,
    setPageAreaSize,
    setIsSinglePageMode,
    setTargetSpreadPageWidth,
    setSpreadPageWidth,
  })

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
    currentNotebookPageSpanKey,
    currentTocPartKey,
    currentTocPartTitle,
    currentLessonPartPageSpanKey,
    currentTocBreadcrumb,
    lessonPartOrderByKey,
  } = useBookReaderSpreadModel({
    selectedBook,
    selectedUnit,
    numPages,
    pageNumber,
    vocabReaderHit,
  })

  const {
    annotationMode,
    setAnnotationMode,
    stampVariant,
    setStampVariant,
    stampQuestionColor,
    setStampQuestionColor,
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
    setTextVisualStyle,
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
    eyedropperVariant,
    setEyedropperVariant,
    strokeLineDashStyleForInk,
    annotationTargetPage,
    setAnnotationTargetPage,
    isAnnotationRailVisible,
    setIsAnnotationRailVisible,
    leftAnnRef,
    rightAnnRef,
    wbAnnRef,
    spreadStrokeOverlayRef,
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
    effectiveAnnotationMode,
  } = useAnnotationController({
    studentId,
    pageNumber,
    isSinglePageMode,
    isWhiteboardOpen: isWhiteboardOpen && !isWhiteboardMinimized,
    showSpreadRight: showSpreadRightPage,
    spreadRightPage,
    overlayOpen: open,
    isLessonPaperOpen,
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

  const { appendLessonPaperContextHeading } = useLessonPaperContextHeadings({
    isLessonPaperOpen,
    lessonPaperAutoAppendHeadingsEnabled,
    activeClassSessionId,
    lessonPaperPrimarySectionId,
    studentId,
    currentNotebookPageSpanKey,
    currentLessonPartPageSpanKey,
    currentTocPartKey,
    currentTocPartTitle,
    currentTocBreadcrumb,
    vocabReaderPartTitle: vocabReaderHit?.part?.title,
    lessonPartOrderByKey,
    lessonPaperEditorRef,
    lessonPaperScrollRef,
    lessonPaperHtmlRef,
    lessonPaperLastInputAtRef,
    lessonPaperScrollTimerRef,
    lessonPaperHasPendingChangesRef,
    lessonPaperLastPartContextKeyRef,
    setLessonPaperHtml,
    setLessonPaperEditVersion,
    setLessonPaperSaveState,
    scheduleLessonPaperEditorFocus,
    focusLessonPaperMarkerForTyping,
  })

  const { ensureNotebookPartOnIntent, resetNotebookIntentDedupe } = useLessonPaperIntentEntry({
    activeClassSessionId,
    lessonPaperPrimarySectionId,
    studentId,
    currentNotebookPageSpanKey,
    currentLessonPartPageSpanKey,
    currentTocPartKey,
    currentTocPartTitle,
    currentTocBreadcrumb,
    vocabReaderPartTitle: vocabReaderHit?.part?.title,
    lessonPartOrderByKey,
    lessonPaperEditorRef,
    lessonPaperHtmlRef,
    lessonPaperLastPartContextKeyRef,
    appendLessonPaperContextHeading,
  })

  useEffect(() => {
    onNotebookIntentRef.current = ensureNotebookPartOnIntent
  }, [ensureNotebookPartOnIntent])

  useEffect(() => {
    resetNotebookIntentDedupe()
  }, [activeClassSessionId, lessonPaperSectionId, resetNotebookIntentDedupe])

  useWhiteboardNotebookCapture({
    studentId,
    activeClassSessionId,
    notebookEditable,
    lessonPaperSectionId,
    lessonPaperPrimarySectionId,
    lessonPaperDocUpdatedAt,
    selectedBookId,
    selectedUnit,
    selectedBook,
    numPages,
    numberingMode,
    bookPageAtCapture: pageNumber,
    currentNotebookPageSpanKey,
    currentTocPartKey,
    currentTocPartTitle,
    wbCaptureRootRef,
    annotationMode,
    setAnnotationMode,
    isLessonPaperOpen,
    setIsLessonPaperOpen: handleSetLessonPaperOpen,
    applyNotebookHtml: applyNotebookHtmlFromCapture,
    getNotebookHtmlForSave: () =>
      lessonPaperEditorRef.current?.innerHTML ?? lessonPaperHtmlRef.current,
    onNotebookIntent: () => ensureNotebookPartOnIntent('whiteboard_capture'),
  })

  const { pageListNumbers } = useLessonPaperNotebookCanvasScroll({
    isLessonPaperOpen,
    visiblePages,
    lessonPaperScrollRef,
    setLessonPaperCanvasPageIndex,
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
    if (spreadResizeScaleEnabled) {
      return Math.max(1, Math.floor(spreadPageWidth))
    }
    if (!Number.isFinite(targetSpreadPageWidth) || !(targetSpreadPageWidth > 0)) {
      return Math.max(1, Math.floor(spreadPageWidth))
    }
    return Math.max(1, Math.floor(Math.min(spreadPageWidth, targetSpreadPageWidth)))
  }, [spreadPageWidth, targetSpreadPageWidth])

  const spreadDisplayScale = useMemo(() => {
    if (!(layoutSpreadPageWidth > 0) || !(targetSpreadPageWidth > 0)) return 1
    return Math.max(0.1, targetSpreadPageWidth / layoutSpreadPageWidth)
  }, [layoutSpreadPageWidth, targetSpreadPageWidth])

  /** Layout measured and render width is usable (bucket-stable; no spreadPageWidth >= target gate). */
  const spreadLayoutStable = useMemo(() => {
    return layoutSpreadPageWidth > 0 && pageAreaSize.w > 0
  }, [layoutSpreadPageWidth, pageAreaSize.w])

  useEffect(() => {
    if (!open) {
      prevLayoutPrefetchBucketRef.current = null
      return
    }

    if (spreadResizeScaleEnabled) {
      prevLayoutPrefetchBucketRef.current = readerPrefetchWidthBucket(layoutSpreadPageWidth)
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

  const confirmSpreadSlotPixels = !onBookReadyToPresent || userPresented

  const spreadCachePrimed = useMemo(() => {
    if (!selectedUnitId || !(layoutSpreadPageWidth > 0)) return false
    return areReaderSpreadPagesPrefetched({
      unitId: selectedUnitId,
      anchorPage: pageNumber,
      visiblePages,
      isSinglePageMode,
      spreadPageWidthPx: layoutSpreadPageWidth,
    })
  }, [
    selectedUnitId,
    layoutSpreadPageWidth,
    pageNumber,
    visiblePages,
    isSinglePageMode,
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
      }),
    [
      spreadLayoutStable,
      spreadSlotsPixelsReady,
      userPresented,
      spreadCachePrimed,
      spreadDrawableBypass,
      spreadDrawableTimedOut,
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
    if (userPresented) {
      if (!spreadDrawableReady) return
    } else if (!spreadLayoutStable || !spreadCachePrimed) {
      return
    }
    bookReadyToPresentNotifiedRef.current = true
    onBookReadyToPresent()
  }, [
    open,
    onBookReadyToPresent,
    userPresented,
    selectedUnitId,
    hasResolvedUnit,
    spreadDrawableReady,
    spreadLayoutStable,
    spreadCachePrimed,
  ])

  useEffect(() => {
    tryNotifyBookReadyToPresent()
  }, [tryNotifyBookReadyToPresent])

  /** Map route: timeout after user presents until drawable ready — not during silent warm. */
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
    const spreadPrimed =
      selectedUnitId != null &&
      layoutSpreadPageWidth > 0 &&
      areReaderSpreadPagesPrefetched({
        unitId: selectedUnitId,
        anchorPage: pageNumber,
        visiblePages,
        isSinglePageMode,
        spreadPageWidthPx: layoutSpreadPageWidth,
      })
    if (!spreadPrimed) {
      setSpreadSlotsPixelsReady(false)
      setSpreadDrawableTimedOut(false)
    }
  }, [
    open,
    pageNumber,
    spreadReportEpoch,
    selectedUnitId,
    layoutSpreadPageWidth,
    visiblePages,
    isSinglePageMode,
  ])

  useEffect(() => {
    if (!open || !selectedUnitId || spreadResizeScaleEnabled) return
    const nextBucket = readerPrefetchWidthBucket(layoutSpreadPageWidth)
    const prevBucket = lastReaderPrefetchWidthBucketRef.current
    if (prevBucket !== null && prevBucket !== nextBucket) {
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
      isSinglePageMode,
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
  }, [open, pdfReady, selectedUnit, numPages, selectedBook, pageNumber, visiblePages, layoutSpreadPageWidth, isSinglePageMode])

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
    if (!selectedBookId || !selectedUnitId) return null
    return resolveWhiteboardStorageKey({
      classSessionId: activeClassSessionId,
      bookId: selectedBookId,
      unitId: selectedUnitId,
    })
  }, [activeClassSessionId, selectedBookId, selectedUnitId])

  const {
    whiteboardLayoutMode,
    whiteboardSlotSide,
    setWhiteboardSlotSide,
    applyWhiteboardSlotSide,
    registerWhiteboardSlotMotion,
    toggleWhiteboardFullscreen,
    swapWhiteboardSlotSide,
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

  const { whiteboardContentHeightPx, extendWhiteboardRunway } = useInfiniteWhiteboardRunway({
    viewportHeightPx: pageCanvasHeightPx,
    enabled: isWhiteboardOpen,
  })

  useWhiteboardOnBookUnitChange({
    selectedBookId,
    selectedUnitId,
    resetWhiteboardPlacementForUnit: resetPlacementForUnitChange,
    setLessonPaperViewMode,
    lessonPaperPanRef,
  })

  useEffect(() => {
    if (!open) setIsWhiteboardMinimized(false)
  }, [open])

  const minimizeWhiteboard = useCallback(() => {
    setIsWhiteboardMinimized(true)
  }, [])

  const expandWhiteboard = useCallback(() => {
    setIsWhiteboardMinimized(false)
  }, [])

  const openWhiteboard = useCallback(() => {
    openWhiteboardWithDefaultPlacement()
    setIsWhiteboardMinimized(false)
    setIsWhiteboardOpen(true)
  }, [openWhiteboardWithDefaultPlacement])

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
    const api = toolbarLaunchApiRef.current
    if (api) {
      api.playExit(() => setIsWhiteboardOpen(false))
      return
    }
    setIsWhiteboardOpen(false)
  }, [])

  const launchMinimizeWhiteboard = useCallback(() => {
    const api = toolbarLaunchApiRef.current
    if (api) {
      api.playExit(minimizeWhiteboard)
      return
    }
    minimizeWhiteboard()
  }, [minimizeWhiteboard])

  const readerViewportAspectRatio = useMemo(() => {
    const r = pageAspectRatio
    if (!Number.isFinite(r) || r <= 0) {
      return isSinglePageMode ? DEFAULT_PAGE_ASPECT_RATIO : DEFAULT_PAGE_ASPECT_RATIO * 2
    }
    return isSinglePageMode ? r : r * 2
  }, [pageAspectRatio, isSinglePageMode])

  const spreadTurnGridRef = useRef<HTMLDivElement | null>(null)
  const turnSlideSeqRef = useRef(0)
  const [turnSlide, setTurnSlide] = useState<SpreadTurnSlidePayload | null>(null)

  const onBeforeCommitPage = useCallback(
    (fromPage: number, toPage: number) => {
      if (!spreadSlideEnabled || typeof window === 'undefined') return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      const direction = (toPage > fromPage ? 1 : -1) as 1 | -1
      const outgoing = resolveSpreadAnchorPages(fromPage, visiblePages, isSinglePageMode)
      turnSlideSeqRef.current += 1
      setTurnSlide({ captureUrl: null, direction, outgoing, seq: turnSlideSeqRef.current })
    },
    [visiblePages, isSinglePageMode],
  )

  const handleTurnSlideComplete = useCallback(() => {
    setTurnSlide(null)
  }, [])

  const { goToPage, goToAdjacentPage, commitPageJump } = useGatedBookNavigation({
    selectedBookId,
    selectedUnitId,
    selectedBook,
    selectedUnit,
    numPages,
    visiblePages,
    isSinglePageMode,
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
    isLessonPaperOpen,
    goToAdjacentPage,
  })

  const {
    notebookReturnPage,
    goToNotebookSourcePage,
    returnToNotebookCurrentPage,
    clearNotebookReturnPage,
  } = useLessonPaperNotebookNavigation({ pageNumber, goToPage })

  useEffect(() => {
    if (open) return
    clearNotebookReturnPage()
  }, [open, clearNotebookReturnPage])

  const handleStartNotebookNote = useCallback(() => {
    ensureNotebookPartOnIntent('start_note')
    scheduleLessonPaperEditorFocus(true)
  }, [ensureNotebookPartOnIntent, scheduleLessonPaperEditorFocus])

  const handleOpenWhiteboardForCapture = useCallback(() => {
    openWhiteboard()
  }, [openWhiteboard])

  const handleOpenTranslateDockForVocab = useCallback(() => {
    ensureNotebookPartOnIntent('vocab_save')
    setTranslateDockOpen(true)
  }, [ensureNotebookPartOnIntent])

  const handleLessonPaperInputWithHtmlSync = useCallback(() => {
    onLessonPaperInput()
    if (lessonPaperEditorRef.current) {
      setLessonPaperHtml(lessonPaperEditorRef.current.innerHTML)
    }
  }, [onLessonPaperInput])

  const { onDocumentLoadSuccess } = useBookPdfPageSync({
    selectedBookId,
    selectedUnitId,
    selectedBook,
    selectedUnit,
    numPages,
    visiblePages,
    isSinglePageMode,
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
    isSinglePageMode,
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
    isSinglePageMode,
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
    isSinglePageMode,
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
    setIsSinglePageMode,
    setPdfDialogOpen: () => undefined,
    getCurrentPageCaptureEl,
    leftPageCaptureRef,
    pageAreaRef,
  })

  useBookOverlayKeyboardShortcuts({
    open,
    onClose,
    isLessonPaperOpen,
    annotationMode,
    setAnnotationMode,
    penStrokeProfile,
    setPenStrokeProfile,
    stampVariant,
    setStampVariant,
    eyedropperVariant,
    setEyedropperVariant,
    isAnnotationRailVisible,
    setIsAnnotationRailVisible,
    isPageListOpen,
    setIsPageListOpen,
    isWhiteboardOpen: isWhiteboardOpen && !isWhiteboardMinimized,
    isWhiteboardSessionOpen: isWhiteboardOpen,
    setIsWhiteboardOpen,
    launchOpenWhiteboard,
    launchExpandWhiteboard,
    launchCloseWhiteboard,
    toggleWhiteboardFullscreen,
    setWhiteboardSlotSide,
    isWhiteboardMinimized,
    pdfDialogOpen,
    regionSelectOpen,
    captionDialogOpen: captionDialog != null,
    translateDockOpen,
    setTranslateDockOpen,
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
    getPageAnnotationRef,
    getActiveAnnotationRef,
  })

  // Side-by-side overlay mode is intentionally disabled for the full-screen notebook experience.
  const isLessonPaperOverlayMode = false
  const isLessonPaperSplitView = isLessonPaperOverlayMode && lessonPaperViewMode === 'split'

  const computeLessonPaperTargetPan = useCallback(
    (mode: 'left' | 'right') => {
      if (!isLessonPaperOverlayMode) return 0
      const stageEl = bookStageRef.current
      const leftEl = leftPageCaptureRef.current
      const rightEl = rightPageCaptureRef.current
      if (!stageEl || !leftEl) return 0

      const viewportW = typeof window !== 'undefined' && Number.isFinite(window.innerWidth) ? window.innerWidth : pageAreaSize.w
      const visibleStageWidth = viewportW / 2
      const visibleStageCenterX = visibleStageWidth / 2
      const stageRect = stageEl.getBoundingClientRect()
      const targetRect = (mode === 'right' ? rightEl : leftEl)?.getBoundingClientRect() ?? leftEl.getBoundingClientRect()
      const targetCenterX = targetRect.left + targetRect.width / 2
      const deltaPan = visibleStageCenterX - targetCenterX
      let nextPan = lessonPaperPanRef.current + deltaPan

      // Clamp so we don't drift the whole spread out of the visible left strip.
      const minPan = lessonPaperPanRef.current + (visibleStageWidth - stageRect.right)
      const maxPan = lessonPaperPanRef.current + (-stageRect.left)
      if (minPan <= maxPan) {
        nextPan = Math.max(minPan, Math.min(maxPan, nextPan))
      }
      return nextPan
    },
    [isLessonPaperOverlayMode, pageAreaSize.w],
  )

  const unitThumbFileUrl = hasResolvedUnit && selectedUnit ? makeUnitFileUrl(selectedUnit.filePath) : ''

  useEffect(() => {
    if (!isLessonPaperOverlayMode) {
      setLessonPaperPanPx(0)
      lessonPaperPanRef.current = 0
      return
    }
    const nextMode: 'left' | 'right' = lessonPaperViewMode === 'right' ? 'right' : 'left'
    const nextPan = computeLessonPaperTargetPan(nextMode)
    lessonPaperPanRef.current = nextPan
    setLessonPaperPanPx(nextPan)
  }, [
    computeLessonPaperTargetPan,
    isLessonPaperOverlayMode,
    lessonPaperViewMode,
    layoutSpreadPageWidth,
    isSinglePageMode,
    pageNumber,
    spreadRightPage,
    pageAreaSize.w,
    pageAreaSize.h,
  ])
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
    WHITEBOARD_NOTEBOOK_SURFACE,
    activePageRowRef,
    annotationMode,
    effectiveAnnotationMode,
    annotationTargetPage,
    applyLessonPaperCommand,
    bookStageRef,
    captionDialog,
    captionDraft,
    captureBusy,
    captureFormat,
    commitPageJump,
    copyLastCaptureToClipboard,
    currentNotebookPageSpanKey,
    eraserLineThicknessStep,
    eraserPixelThicknessStep,
    error,
    getActiveAnnotationRef,
    goToAdjacentPage,
    goToPage,
    handleStartNotebookNote,
    handleOpenWhiteboardForCapture,
    handleOpenTranslateDockForVocab,
    handleLessonPaperInputWithHtmlSync,
    goToNotebookSourcePage,
    returnToNotebookCurrentPage,
    notebookReturnPage,
    lessonPaperHtml,
    handleCaptionSave,
    hasCurriculumOrHistory,
    hasLastImageCapture,
    hasResolvedUnit,
    hideChromeForCapture,
    interactiveVocabPack,
    isAnnotationRailVisible,
    isLessonPaperOpen,
    isLessonPaperOverlayMode,
    isLessonPaperSplitView,
    isMounted,
    open,
    isPageListOpen,
    isSinglePageMode,
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
    lessonPaperBreadcrumb,
    lessonPaperEditVersion,
    lessonPaperEditorRef,
    lessonPaperHeader,
    lessonPaperLastPartContextKeyRef,
    lessonPaperPanPx,
    lessonPaperScrollRef,
    lessonPaperScrollRunwayPx,
    lessonPaperViewMode,
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
    onLessonPaperInput,
    onLessonPaperPaste,
    onPdfPageLoadSuccess,
    onRightAnnotationCaps,
    onSpreadOverlayCaps,
    onWhiteboardCaps,
    pageAreaRef,
    pageCanvasHeightPx,
    pageJumpDraft,
    pageListNumbers,
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
    eyedropperVariant,
    setEyedropperVariant,
    printedJumpBounds,
    regionSelectOpen,
    rightPageCaptureRef,
    runImageCapture,
    runPdfPacketExport,
    scheduleLessonPaperEditorFocus,
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
    handleSetLessonPaperOpen,
    lessonPaperSaveState,
    lessonPaperSectionId,
    notebookEditable,
    activeClassSessionId,
    setIsPageListOpen,
    setIsWhiteboardOpen,
    setJpegQuality,
    setLessonPaperViewMode,
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
    setStampQuestionColor,
    setTextFillColor,
    pickTextFillColor,
    setTextVisualStyle,
    setWatermarkEnabled,
    openWhiteboardWithDefaultPlacement,
    shapeColor,
    shapeStrokeWidthScale,
    showSpreadRightPage,
    spreadDisplayScale,
    spreadGutterPullRatio,
    spreadPageWidth,
    spreadStrokeCaptureEnabled,
    spreadStrokeOverlayRef,
    layoutSpreadPageWidth,
    spreadRightPage,
    stampScale,
    stampVariant,
    stampQuestionColor,
    stickyFontSizeNorm,
    strokeColor,
    strokeWidthScale,
    eraserLineStrokeWidthScale,
    penStrokeWidthScale,
    strokeLineDashStyleForInk,
    coachLessonId: vocabReaderHit?.lesson.id ?? null,
    coachLessonTitle: vocabReaderHit?.lesson.title ?? null,
    coachPartId: vocabReaderHit?.part.id ?? null,
    coachPartTitle: vocabReaderHit?.part.title ?? currentTocPartTitle ?? null,
    studentId,
    studentName,
    suppressChrome,
    textFontSizeNorm,
    textFillColor,
    textVisualStyle,
    toolbarCaps,
    translateDockOpen,
    setTranslateDockOpen,
    unitPageBounds,
    unitThumbFileUrl,
    visiblePages,
    watermarkEnabled,
    leftAnnRef,
    rightAnnRef,
    wbAnnRef,
    wbCaptureRootRef,
    whiteboardStorageKey,
    whiteboardLayoutMode,
    whiteboardSlotSide,
    setWhiteboardSlotSide,
    applyWhiteboardSlotSide,
    registerWhiteboardSlotMotion,
    registerWhiteboardToolbarLaunch,
    toggleWhiteboardFullscreen,
    whiteboardContentHeightPx,
    extendWhiteboardRunway,
    isWhiteboardMinimized,
    minimizeWhiteboard,
    expandWhiteboard,
    openWhiteboard,
    swapWhiteboardSlotSide,
  }
}

export type FullscreenBookOverlayViewModel = ReturnType<typeof useFullscreenBookOverlayController>

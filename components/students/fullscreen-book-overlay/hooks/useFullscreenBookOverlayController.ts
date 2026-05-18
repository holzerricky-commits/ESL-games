'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { BookLibraryPayload } from '@/lib/books/types'
import { patchStudentWorkCaption } from '@/lib/books/book-capture'
import { makeUnitFileUrl, WHITEBOARD_NOTEBOOK_SURFACE } from '../constants'
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
import { useBookNavigation } from './useBookNavigation'
import { useBookPdfPageSync } from './useBookPdfPageSync'
import { useFullscreenOverlayPanels } from './useFullscreenOverlayPanels'
import { usePdfJsWorker } from './usePdfJsWorker'
import { useLessonPaperPersistence } from './useLessonPaperPersistence'
import { useWhiteboardOnBookUnitChange } from './useWhiteboardOnBookUnitChange'
import { usePdfUnitCacheOnChange } from './usePdfUnitCacheOnChange'
import { useInteractiveVocabPack } from './useInteractiveVocabPack'
import { useBookReaderSpreadModel } from './useBookReaderSpreadModel'
import { useLessonPaperNotebookCanvasScroll } from './useLessonPaperNotebookCanvasScroll'
import { usePageJumpUiSync } from './usePageJumpUiSync'
import { useBookPageAlignmentModel } from './useBookPageAlignmentModel'
import { useSpreadGutterOverlayStyle } from './useSpreadGutterOverlayStyle'
import { useCurrentPageCaptureEl } from './useCurrentPageCaptureEl'
import { preloadAllManifestBrushPatterns } from '@/lib/books/brush-pattern-loader'
import { getFileAlignment, getUnitReaderBounds } from '@/lib/books/page-range'
import {
  clearReaderPrefetchCacheForUnit,
  invalidateReaderPrefetchStaleWidthBucketsForUnit,
  queueReaderPrefetchWindowIdle,
  readerPrefetchWidthBucket,
} from '@/lib/books/reader-page-prefetch-queue'
import { getReaderPrefetchVisiblePageIndices } from '@/lib/books/reader-prefetch-window'
import { getStudentClassSessionById } from '@/lib/students/selectors'
import type { FullscreenBookOverlayProps } from '../types'

/** A4-style portrait default until PDF viewport is primed (see B3). */
const DEFAULT_PAGE_ASPECT_RATIO = 1 / 1.414

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
    onBookOpenPaintTimeout,
  } = props

  const userPresented = presentedProp ?? true
  const deferVisibleBookOpen = open && !userPresented

  useEffect(() => {
    if (!open) return
    preloadAllManifestBrushPatterns()
  }, [open])

  const ANIMATION_MS = 650
  const BOOK_FRAME_VIEWPORT_INSET_X = 0.034
  const BOOK_FRAME_VIEWPORT_INSET_Y = 0.074
  const BOOK_FRAME_VIEWPORT_WIDTH_RATIO = 1 - BOOK_FRAME_VIEWPORT_INSET_X * 2
  const BOOK_FRAME_ASPECT_RATIO = 1264 / 816
  const [library, setLibrary] = useState<BookLibraryPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null)
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [numPages, setNumPages] = useState<number | null>(null)
  const [targetSpreadPageWidth, setTargetSpreadPageWidth] = useState(320)
  const [spreadPageWidth, setSpreadPageWidth] = useState(320)
  const [pageAspectRatio, setPageAspectRatio] = useState(DEFAULT_PAGE_ASPECT_RATIO)
  const [isSinglePageMode, setIsSinglePageMode] = useState(false)
  const [pdfReady, setPdfReady] = useState(false)
  const [isMounted, setIsMounted] = useState(open)
  const [isVisible, setIsVisible] = useState(open)
  /** Phase E1: false after open until first spread `react-pdf` onLoadSuccess; true when idle / closed / terminal skip. */
  const [spreadFirstPaintReady, setSpreadFirstPaintReady] = useState(() => !open)
  /** Bumps so `BookCanvasStage` resets first-spread reporting when reopening or switching unit. */
  const [firstSpreadPaintSession, setFirstSpreadPaintSession] = useState(0)
  const [isPageListOpen, setIsPageListOpen] = useState(false)
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false)
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
  const [lessonPaperOverlayImages, setLessonPaperOverlayImages] = useState<
    Array<{ id: string; src: string; xNorm: number; yNorm: number; widthNorm: number }>
  >([])
  const [lessonPaperDocUpdatedAt, setLessonPaperDocUpdatedAt] = useState<string | null>(null)
  const [lessonPaperBreadcrumb, setLessonPaperBreadcrumb] = useState<string>('')
  const [lessonPaperMode, setLessonPaperMode] = useState<'type' | 'draw' | 'select'>('type')
  const [lessonPaperDrawTool, setLessonPaperDrawTool] = useState<'pen' | 'highlighter'>('pen')
  const [lessonPaperViewMode, setLessonPaperViewMode] = useState<'left' | 'right' | 'split'>('left')
  const [lessonPaperCanvasPageIndex, setLessonPaperCanvasPageIndex] = useState(0)
  // Keep notebook editing independent from page turning in full-screen notebook mode.
  const lessonPaperAutoFollowReadingEnabled = false
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
  const lessonPaperOverlayDragRef = useRef<{
    id: string
    startX: number
    startY: number
    initialXNorm: number
    initialYNorm: number
  } | null>(null)
  const [whiteboardPage, setWhiteboardPage] = useState(1)
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
  const spreadRenderBaseKeyRef = useRef('')
  const leftPageCaptureRef = useRef<HTMLDivElement | null>(null)
  const rightPageCaptureRef = useRef<HTMLDivElement | null>(null)
  const bookStageRef = useRef<HTMLDivElement | null>(null)
  const wbCaptureRootRef = useRef<HTMLDivElement | null>(null)

  const {
    lessonPaperOverlayPageNumber,
    lessonPaperOverlaySize,
    lessonPaperScrollRunwayPx,
    lessonPaperOverlayHostRef,
    lessonPaperScrollRef,
  } = useLessonPaperLayoutController({
    activeClassSessionId,
    isLessonPaperOpen,
  })

  const activeClassSession = activeClassSessionId
    ? getStudentClassSessionById(studentId, activeClassSessionId)
    : null
  const lessonPaperPrimarySectionId = useMemo(
    () => activeClassSession?.lessonNotebookSession?.sections?.[0]?.sectionId ?? null,
    [activeClassSession],
  )

  const lessonPaperDraftStorageKey = useMemo(
    () =>
      activeClassSessionId && lessonPaperPrimarySectionId
        ? `lesson-paper-draft::${studentId}::${activeClassSessionId}::${lessonPaperPrimarySectionId}`
        : null,
    [activeClassSessionId, lessonPaperPrimarySectionId, studentId],
  )

  const { flushLessonPaperSaveNow } = useLessonPaperPersistence({
    studentId,
    activeClassSessionId,
    isLessonPaperOpen,
    lessonPaperEditVersion,
    lessonPaperOverlayImages,
    lessonPaperPrimarySectionId,
    lessonPaperDraftStorageKey,
    lessonPaperDocUpdatedAt,
    lessonPaperAutoFollowReadingEnabled,
    lessonPaperEditorRef,
    lessonPaperHtmlRef,
    lessonPaperHasPendingChangesRef,
    lessonPaperHydratedRef,
    lessonPaperClassRef,
    lessonPaperSaveTimerRef,
    setLessonPaperSectionId,
    setLessonPaperHeader,
    setLessonPaperBreadcrumb,
    setLessonPaperOverlayImages,
    setLessonPaperDocUpdatedAt,
    setLessonPaperHtml,
    setLessonPaperSaveState,
  })

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
    if (lessonPaperMode !== 'type') return
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
  }, [lessonPaperMode])


  const {
    applyLessonPaperCommand,
    onLessonPaperInput,
    onLessonPaperPaste,
  } = useLessonPaperEditorInteractions({
    lessonPaperMode,
    isLessonPaperOpen,
    lessonPaperSectionId,
    lessonPaperEditorRef,
    lessonPaperOverlayHostRef,
    lessonPaperOverlayDragRef,
    lessonPaperLastInputAtRef,
    lessonPaperHtmlRef,
    lessonPaperHasPendingChangesRef,
    setLessonPaperOverlayImages,
    setLessonPaperEditVersion,
    setLessonPaperSaveState,
    scheduleLessonPaperEditorFocus,
    scheduleLessonPaperEditSync,
    setLessonPaperMode,
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

  const onFirstSpreadPaintReady = useCallback(() => {
    setSpreadFirstPaintReady(true)
  }, [])

  useEffect(() => {
    if (!open) {
      setSpreadFirstPaintReady(true)
      prevOpenForFirstPaintRef.current = false
      bookReadyToPresentNotifiedRef.current = false
      return
    }
    if (!prevOpenForFirstPaintRef.current) {
      setSpreadFirstPaintReady(false)
      setFirstSpreadPaintSession((n) => n + 1)
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
      setSpreadFirstPaintReady(false)
      setFirstSpreadPaintSession((n) => n + 1)
    }
    prevSelectedUnitForPaintRef.current = selectedUnitId
  }, [open, selectedUnitId])

  useEffect(() => {
    if (!open) return
    if (!hasCurriculumOrHistory || error || !hasResolvedUnit) {
      setSpreadFirstPaintReady(true)
    }
  }, [open, hasCurriculumOrHistory, error, hasResolvedUnit])

  useEffect(() => {
    if (!open || spreadFirstPaintReady) return
    if (!readerPresentationReady) return
    if (!hasCurriculumOrHistory || error || !hasResolvedUnit) return
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const capMs = mq.matches ? 1500 : 4000
    const id = window.setTimeout(() => {
      if (deferVisibleBookOpen) {
        onBookOpenPaintTimeout?.()
        return
      }
      setSpreadFirstPaintReady(true)
    }, capMs)
    return () => window.clearTimeout(id)
  }, [
    open,
    spreadFirstPaintReady,
    readerPresentationReady,
    hasCurriculumOrHistory,
    error,
    hasResolvedUnit,
    deferVisibleBookOpen,
    onBookOpenPaintTimeout,
  ])

  useEffect(() => {
    if (!open || userPresented || !spreadFirstPaintReady || !onBookReadyToPresent) return
    if (bookReadyToPresentNotifiedRef.current) return
    bookReadyToPresentNotifiedRef.current = true
    onBookReadyToPresent()
  }, [open, userPresented, spreadFirstPaintReady, onBookReadyToPresent])

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
    setWhiteboardPage,
  })

  useArrowKeyPageTurn({
    open,
    isLessonPaperOpen,
    selectedBookId,
    selectedUnitId,
    library,
    numPages,
    isSinglePageMode,
    pageNumber,
    setPageNumber,
  })

  useWhiteboardOnBookUnitChange({
    selectedBookId,
    selectedUnitId,
    pageNumber,
    setWhiteboardPage,
    setLessonPaperViewMode,
    lessonPaperPanRef,
  })

  useBookViewportLayout({
    open,
    pageAspectRatio,
    isLessonPaperOpen,
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
    penColorSource,
    penCustomHex,
    pickPenCustomColor,
    textColor,
    setTextColor,
    shapeStrokeSwatchId,
    setShapeStrokeSwatchId,
    stickyFillColor,
    setStickyFillColor,
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
    eraserPixelThicknessStep,
    setEraserPixelThicknessStep,
    eraserLineThicknessStep,
    setEraserLineThicknessStep,
    textVisualStyle,
    setTextVisualStyle,
    textFillColor,
    setTextFillColor,
    penLineDashStyle,
    setPenLineDashStyle,
    markerLineDashStyle,
    setMarkerLineDashStyle,
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
    clearInkOpen,
    setClearInkOpen,
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
    clearTargetPage,
    clearInkSpreadPagePair,
    spreadStrokeCaptureEnabled,
    onSpreadOverlayCaps,
    onLeftAnnotationCaps,
    onRightAnnotationCaps,
    onWhiteboardCaps,
    getActiveAnnotationRef,
    lessonPaperOverlayMode,
  } = useAnnotationController({
    studentId,
    pageNumber,
    isSinglePageMode,
    isWhiteboardOpen,
    whiteboardPage,
    lessonPaperMode,
    lessonPaperDrawTool,
    showSpreadRight: showSpreadRightPage,
    spreadRightPage,
  })

  const onEyedropperPick = useEyedropperPick({
    pageNumber,
    spreadRightPage,
    isWhiteboardOpen,
    whiteboardPage,
    leftPageCaptureRef,
    rightPageCaptureRef,
    wbCaptureRootRef,
    pickPenCustomColor,
    setAnnotationMode,
    eyedropperVariant,
  })

  useLessonPaperContextHeadings({
    isLessonPaperOpen,
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
    if (!Number.isFinite(targetSpreadPageWidth) || !(targetSpreadPageWidth > 0)) {
      return Math.max(1, Math.floor(spreadPageWidth))
    }
    return Math.max(1, Math.floor(Math.min(spreadPageWidth, targetSpreadPageWidth)))
  }, [spreadPageWidth, targetSpreadPageWidth])

  useEffect(() => {
    if (!open || !selectedUnitId) return
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
    const indices = getReaderPrefetchVisiblePageIndices({
      anchorPage: pageNumber,
      visiblePages,
      readerBounds,
    })
    queueReaderPrefetchWindowIdle({
      fileUrl,
      unitId: selectedUnit.id,
      pages: indices,
      widthPx: w,
      shouldProceed: () => openRef.current,
    })
  }, [open, pdfReady, selectedUnit, numPages, selectedBook, pageNumber, visiblePages, layoutSpreadPageWidth])

  const pageCanvasHeightPx =
    layoutSpreadPageWidth > 0 && Number.isFinite(pageAspectRatio) && pageAspectRatio > 0
      ? Math.max(1, Math.round(layoutSpreadPageWidth / pageAspectRatio))
      : 1

  const spreadGutterOverlayStyle = useSpreadGutterOverlayStyle({
    pageAreaSize,
    layoutSpreadPageWidth,
    pageCanvasHeightPx,
  })

  const { goToPage, goToAdjacentPage, commitPageJump } = useBookNavigation({
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
    setPageNumber,
  })

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
    whiteboardPage,
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
    lessonPaperMode,
    annotationMode,
    setAnnotationMode,
    stampVariant,
    setStampVariant,
    eyedropperVariant,
    setEyedropperVariant,
    isAnnotationRailVisible,
    setIsAnnotationRailVisible,
    isPageListOpen,
    setIsPageListOpen,
    isWhiteboardOpen,
    setIsWhiteboardOpen,
    clearInkOpen,
    pdfDialogOpen,
    regionSelectOpen,
    captionDialogOpen: captionDialog != null,
    setClearInkOpen,
    penThicknessStep,
    setPenThicknessStep,
    markerThicknessStep,
    setMarkerThicknessStep,
    eraserPixelThicknessStep,
    setEraserPixelThicknessStep,
    toolbarCaps,
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
  const spreadDisplayScale =
    layoutSpreadPageWidth > 0 && Number.isFinite(targetSpreadPageWidth) && targetSpreadPageWidth > 0
      ? Math.max(0.1, targetSpreadPageWidth / layoutSpreadPageWidth)
      : 1

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
    BOOK_FRAME_ASPECT_RATIO,
    BOOK_FRAME_VIEWPORT_INSET_X,
    BOOK_FRAME_VIEWPORT_INSET_Y,
    BOOK_FRAME_VIEWPORT_WIDTH_RATIO,
    PdfPage,
    WHITEBOARD_NOTEBOOK_SURFACE,
    activePageRowRef,
    annotationMode,
    annotationTargetPage,
    applyLessonPaperCommand,
    bookStageRef,
    captionDialog,
    captionDraft,
    captureBusy,
    captureFormat,
    clearInkOpen,
    clearInkSpreadPagePair,
    clearTargetPage,
    commitPageJump,
    copyLastCaptureToClipboard,
    currentNotebookPageSpanKey,
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
    isAnnotationRailVisible,
    isLessonPaperOpen,
    isLessonPaperOverlayMode,
    isLessonPaperSplitView,
    isMounted,
    open,
    isPageListOpen,
    isSinglePageMode,
    isVisible,
    isWhiteboardOpen,
    userPresented,
    firstSpreadPaintSession,
    onFirstSpreadPaintReady,
    readerPresentationReady,
    spreadFirstPaintReady,
    jpegQuality,
    lessonPaperBreadcrumb,
    lessonPaperDrawTool,
    lessonPaperEditorRef,
    lessonPaperHeader,
    lessonPaperLastPartContextKeyRef,
    lessonPaperMode,
    lessonPaperOverlayDragRef,
    lessonPaperOverlayHostRef,
    lessonPaperOverlayImages,
    lessonPaperOverlayMode,
    lessonPaperOverlayPageNumber,
    lessonPaperOverlaySize,
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
    penColorSource,
    penCustomHex,
    pickPenCustomColor,
    onEyedropperPick,
    textColor,
    setTextColor,
    shapeStrokeSwatchId,
    setShapeStrokeSwatchId,
    stickyFillColor,
    setStickyFillColor,
    penColor,
    penInkStyle,
    penThicknessStep,
    penLineDashStyle,
    setPenLineDashStyle,
    markerLineDashStyle,
    setMarkerLineDashStyle,
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
    setClearInkOpen,
    setEraserLineThicknessStep,
    setEraserPixelThicknessStep,
    setHideChromeForCapture,
    setIsAnnotationRailVisible,
    setIsLessonPaperOpen,
    setIsPageListOpen,
    setIsWhiteboardOpen,
    setJpegQuality,
    setLessonPaperDrawTool,
    setLessonPaperMode,
    setLessonPaperViewMode,
    setMarkerThicknessStep,
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
    setTextVisualStyle,
    setWatermarkEnabled,
    setWhiteboardPage,
    shapeColor,
    shapeStrokeWidthScale,
    showSpreadRightPage,
    spreadDisplayScale,
    spreadGutterOverlayStyle,
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
    studentId,
    studentName,
    suppressChrome,
    textFontSizeNorm,
    textFillColor,
    textVisualStyle,
    toolbarCaps,
    unitPageBounds,
    unitThumbFileUrl,
    visiblePages,
    watermarkEnabled,
    leftAnnRef,
    rightAnnRef,
    wbAnnRef,
    wbCaptureRootRef,
    whiteboardPage,
  }
}

export type FullscreenBookOverlayViewModel = ReturnType<typeof useFullscreenBookOverlayController>

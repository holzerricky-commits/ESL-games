'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { BookLibraryPayload } from '@/lib/books/types'
import { patchStudentWorkCaption } from '@/lib/books/book-capture'
import { makeUnitFileUrl, WHITEBOARD_NOTEBOOK_SURFACE } from '../constants'
import { useArrowKeyPageTurn } from './useArrowKeyPageTurn'
import { useAnnotationController } from './useAnnotationController'
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
import { useNotesWhiteboardOnBookUnitChange } from './useNotesWhiteboardOnBookUnitChange'
import { usePdfUnitCacheOnChange } from './usePdfUnitCacheOnChange'
import { useInteractiveVocabPack } from './useInteractiveVocabPack'
import { useBookReaderSpreadModel } from './useBookReaderSpreadModel'
import { useLessonPaperNotebookCanvasScroll } from './useLessonPaperNotebookCanvasScroll'
import { usePageJumpUiSync } from './usePageJumpUiSync'
import { useBookPageAlignmentModel } from './useBookPageAlignmentModel'
import { useSpreadGutterOverlayStyle } from './useSpreadGutterOverlayStyle'
import { useCurrentPageCaptureEl } from './useCurrentPageCaptureEl'
import { getStudentClassSessionById } from '@/lib/students/selectors'
import type { FullscreenBookOverlayProps } from '../types'

const PdfDocument = dynamic(() => import('react-pdf').then((mod) => mod.Document), {
  ssr: false,
})
const PdfPage = dynamic(() => import('react-pdf').then((mod) => mod.Page), {
  ssr: false,
})
const PDF_DOCUMENT_OPTIONS = { wasmUrl: '/wasm/' } as const

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
  } = props

  const ANIMATION_MS = 650
  const DEFAULT_PAGE_ASPECT_RATIO = 1 / 1.414
  const BOOK_FRAME_VIEWPORT_INSET_X = 0.048
  const BOOK_FRAME_VIEWPORT_INSET_Y = 0.097
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
  const [isPageListOpen, setIsPageListOpen] = useState(false)
  const [isNotesOpen, setIsNotesOpen] = useState(false)
  const [notesPage, setNotesPage] = useState(1)
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
  const {
    annotationMode,
    setAnnotationMode,
    stampVariant,
    setStampVariant,
    penColor,
    setPenColor,
    markerColor,
    setMarkerColor,
    penThicknessStep,
    setPenThicknessStep,
    markerThicknessStep,
    setMarkerThicknessStep,
    eraserPixelThicknessStep,
    setEraserPixelThicknessStep,
    eraserLineThicknessStep,
    setEraserLineThicknessStep,
    annotationTargetPage,
    setAnnotationTargetPage,
    clearInkOpen,
    setClearInkOpen,
    isAnnotationRailVisible,
    setIsAnnotationRailVisible,
    leftAnnRef,
    rightAnnRef,
    wbAnnRef,
    strokeWidthScale,
    strokeColor,
    shapeStrokeWidthScale,
    stampScale,
    textFontSizeNorm,
    stickyFontSizeNorm,
    shapeColor,
    toolbarCaps,
    clearTargetPage,
    onLeftAnnotationCaps,
    onRightAnnotationCaps,
    onWhiteboardCaps,
    getActiveAnnotationRef,
    lessonPaperOverlayMode,
  } = useAnnotationController({
    pageNumber,
    isSinglePageMode,
    isWhiteboardOpen,
    whiteboardPage,
    lessonPaperMode,
    lessonPaperDrawTool,
  })
  const prevUnitCacheRef = useRef<{ unitId: string; fileUrl: string } | null>(null)
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

  useEffect(() => {
    if (open) return
    flushLessonPaperSaveNow()
  }, [flushLessonPaperSaveNow, open])

  useEffect(() => {
    if (isLessonPaperOpen) return
    flushLessonPaperSaveNow()
  }, [flushLessonPaperSaveNow, isLessonPaperOpen])

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

  useFullscreenOverlayPanels({
    animationMs: ANIMATION_MS,
    open,
    setIsMounted,
    setIsVisible,
    setIsPageListOpen,
    setIsNotesOpen,
    setIsWhiteboardOpen,
    isLessonPaperOpen,
    setLessonPaperViewMode,
    lessonPaperPanRef,
    isNotesOpen,
    isWhiteboardOpen,
    isPageListOpen,
    pageNumber,
    isSinglePageMode,
    numPages,
    library,
    selectedBookId,
    selectedUnitId,
    setNotesPage,
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

  useNotesWhiteboardOnBookUnitChange({
    selectedBookId,
    selectedUnitId,
    pageNumber,
    setNotesPage,
    setWhiteboardPage,
    setLessonPaperViewMode,
    lessonPaperPanRef,
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

  usePdfUnitCacheOnChange({ open, selectedUnit, prevUnitCacheRef })

  const spreadGutterOverlayStyle = useSpreadGutterOverlayStyle({
    pageAreaSize,
    spreadPageWidth,
    pageAspectRatio,
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

  /** Reader may resolve from book ids, unit refs, or session history — do not gate the frame on book ids alone. */
  const hasCurriculumOrHistory =
    assignedBookIds.length > 0 || assignedUnitRefs.length > 0 || curriculumHistory.length > 0
  const hasResolvedUnit = !!selectedUnit
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
  const pageCanvasHeightPx = spreadPageWidth / pageAspectRatio
  const spreadDisplayScale =
    spreadPageWidth > 0 && Number.isFinite(targetSpreadPageWidth)
      ? Math.max(0.1, targetSpreadPageWidth / spreadPageWidth)
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
    spreadPageWidth,
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
    PdfDocument,
    PdfPage,
    PDF_DOCUMENT_OPTIONS,
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
    isNotesOpen,
    isPageListOpen,
    isSinglePageMode,
    isVisible,
    isWhiteboardOpen,
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
    markerThicknessStep,
    notesPage,
    numPages,
    numberingMode,
    onDocumentLoadSuccess,
    onLeftAnnotationCaps,
    onLessonPaperInput,
    onLessonPaperPaste,
    onPdfPageLoadSuccess,
    onRightAnnotationCaps,
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
    penColor,
    penThicknessStep,
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
    setIsNotesOpen,
    setIsPageListOpen,
    setIsWhiteboardOpen,
    setJpegQuality,
    setLessonPaperDrawTool,
    setLessonPaperMode,
    setLessonPaperViewMode,
    setMarkerColor,
    setMarkerThicknessStep,
    setNotesPage,
    setPageJumpDraft,
    setPageJumpFocused,
    setPageListScrollRoot,
    setPdfDialogOpen,
    setPdfFrom,
    setPdfTo,
    setPenColor,
    setPenThicknessStep,
    setRegionSelectOpen,
    setStampVariant,
    setWatermarkEnabled,
    setWhiteboardPage,
    shapeColor,
    shapeStrokeWidthScale,
    showSpreadRightPage,
    spreadDisplayScale,
    spreadGutterOverlayStyle,
    spreadPageWidth,
    spreadRightPage,
    stampScale,
    stampVariant,
    stickyFontSizeNorm,
    strokeColor,
    strokeWidthScale,
    studentId,
    studentName,
    suppressChrome,
    textFontSizeNorm,
    toolbarCaps,
    unitPageBounds,
    unitThumbFileUrl,
    visiblePages,
    watermarkEnabled,
    wbAnnRef,
    wbCaptureRootRef,
    whiteboardPage,
  }
}

export type FullscreenBookOverlayViewModel = ReturnType<typeof useFullscreenBookOverlayController>

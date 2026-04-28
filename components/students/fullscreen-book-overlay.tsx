'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  LayoutTemplate,
  List,
  NotebookPen,
  Redo2,
  Trash2,
  Undo2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  ANNOTATION_PEN_SWATCHES,
  ANNOTATION_MARKER_SWATCHES,
} from '@/lib/books/annotation-palettes'
import type { StampVariant } from '@/lib/books/annotation-command-types'
import {
  ANNOTATION_PEN_STROKE_WIDTH_STEPS,
  ANNOTATION_STROKE_WIDTH_STEPS,
  type AnnotationStrokeThicknessStep,
  type BookAnnotationInteractionMode,
} from '@/lib/books/annotation-storage'

const ANNOTATION_TEXT_FONT_NORM_STEPS = [0.016, 0.02, 0.024, 0.028, 0.032, 0.038, 0.046] as const
import type { BookLibraryPayload } from '@/lib/books/types'
import {
  mapPdfPageToDisplayLabel,
  mapPdfSpreadToDisplayLabel,
  resolveAlignedAnchorPage,
  type PageNumberingMode,
} from '@/lib/books/page-numbering'
import {
  buildPageAlignmentRuntime,
} from '@/lib/books/page-alignment-runtime'
import {
  clampPdfPage,
  clampPdfPageToVisible,
  getFileAlignment,
  getUnitReaderBounds,
  getVisiblePdfPages,
} from '@/lib/books/page-range'
import {
  applyWatermarkToCanvas,
  buildExportBaseName,
  buildPdfPacketBaseName,
  canvasToBlob,
  captureElementToCanvas,
  copyImageBlobToClipboard,
  cropCanvas,
  domRectToCanvasCrop,
  patchStudentWorkCaption,
  relativePathUnderStudentWork,
  settleLayout,
  uploadStudentWorkBlob,
  type BookCaptureFormat,
} from '@/lib/books/book-capture'
import { getSavedUnitPage, saveUnitPage } from '@/lib/books/progress'
import {
  clearPdfLoadCacheForFileUrl,
  clearThumbnailCacheForUnit,
  PDF_THUMB_WIDTH,
} from '@/lib/books/pdf-thumbnail-cache'
import { BookCaptureMenu } from '@/components/students/book-capture-menu'
import { BookCaptureRegionOverlay } from '@/components/students/book-capture-region-overlay'
import { BookAnnotationToolbar } from '@/components/students/book-annotation-toolbar'
import {
  BookPageAnnotationLayer,
  type AnnotationCapabilities,
  type BookPageAnnotationHandle,
} from '@/components/students/book-page-annotation-layer'
import { BookPageNotesPanel } from '@/components/students/book-page-notes-panel'
import { PdfPageThumbnail } from '@/components/students/pdf-page-thumbnail'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const PdfDocument = dynamic(() => import('react-pdf').then((mod) => mod.Document), {
  ssr: false,
})
const PdfPage = dynamic(() => import('react-pdf').then((mod) => mod.Page), {
  ssr: false,
})
const PDF_DOCUMENT_OPTIONS = { wasmUrl: '/wasm/' } as const

interface FullscreenBookOverlayProps {
  studentId: string
  assignedBookIds: string[]
  assignedUnitRefs?: Array<{ bookId: string; unitId: string }>
  curriculumHistory?: Array<{
    id: string
    bookId: string
    unitId: string
    page: number
    openedAt: string
    closedAt?: string
  }>
  /** Display name for watermarks and export metadata. */
  studentName?: string
  numberingMode?: PageNumberingMode
  open: boolean
  onClose: () => void
}

function makeUnitFileUrl(filePath: string): string {
  return `/api/book-file?path=${encodeURIComponent(filePath)}`
}

/** Dot-grid notebook paper (dots only, no lines or grid squares). */
const WHITEBOARD_NOTEBOOK_SURFACE: Pick<CSSProperties, 'backgroundColor' | 'backgroundImage' | 'backgroundSize'> = {
  backgroundColor: '#f8f7f4',
  backgroundImage:
    'radial-gradient(circle, rgba(72, 52, 38, 0.2) 0.65px, transparent 0.78px)',
  backgroundSize: '20px 20px',
}

export function FullscreenBookOverlay({
  studentId,
  assignedBookIds,
  assignedUnitRefs = [],
  curriculumHistory = [],
  studentName,
  numberingMode = 'mapped',
  open,
  onClose,
}: FullscreenBookOverlayProps) {
  const ANIMATION_MS = 420
  const DEFAULT_PAGE_ASPECT_RATIO = 1 / 1.414
  const SINGLE_PAGE_BREAKPOINT = 1100
  const BOOK_FRAME_ASPECT_RATIO = 1264 / 816
  const [library, setLibrary] = useState<BookLibraryPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null)
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [numPages, setNumPages] = useState<number | null>(null)
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
  const [whiteboardPage, setWhiteboardPage] = useState(1)
  const [wbCaps, setWbCaps] = useState<AnnotationCapabilities>({ canUndo: false, canRedo: false })
  const [pageAreaSize, setPageAreaSize] = useState({ w: 0, h: 0 })
  const pageAreaRef = useRef<HTMLDivElement | null>(null)
  const activePageRowRef = useRef<HTMLButtonElement | null>(null)
  const [pageJumpDraft, setPageJumpDraft] = useState('1')
  const [pageJumpFocused, setPageJumpFocused] = useState(false)
  const [pageListScrollRoot, setPageListScrollRoot] = useState<HTMLDivElement | null>(null)
  const [annotationMode, setAnnotationMode] = useState<BookAnnotationInteractionMode>('pen')
  const [stampVariant, setStampVariant] = useState<StampVariant>('check')
  const [penColor, setPenColor] = useState<string>(ANNOTATION_PEN_SWATCHES[0])
  const [markerColor, setMarkerColor] = useState<string>(ANNOTATION_MARKER_SWATCHES[0])
  const [penThicknessStep, setPenThicknessStep] = useState<AnnotationStrokeThicknessStep>(3)
  const [markerThicknessStep, setMarkerThicknessStep] = useState<AnnotationStrokeThicknessStep>(3)
  const [eraserPixelThicknessStep, setEraserPixelThicknessStep] = useState<AnnotationStrokeThicknessStep>(3)
  const [eraserLineThicknessStep, setEraserLineThicknessStep] = useState<AnnotationStrokeThicknessStep>(3)
  const [annotationTargetPage, setAnnotationTargetPage] = useState(pageNumber)
  const [annCapsByPage, setAnnCapsByPage] = useState<Record<number, AnnotationCapabilities>>({})
  const [clearInkOpen, setClearInkOpen] = useState(false)
  const leftAnnRef = useRef<BookPageAnnotationHandle>(null)
  const rightAnnRef = useRef<BookPageAnnotationHandle>(null)
  const wbAnnRef = useRef<BookPageAnnotationHandle>(null)
  const prevUnitCacheRef = useRef<{ unitId: string; fileUrl: string } | null>(null)
  const leftPageCaptureRef = useRef<HTMLDivElement | null>(null)
  const rightPageCaptureRef = useRef<HTMLDivElement | null>(null)
  const wbCaptureRootRef = useRef<HTMLDivElement | null>(null)
  const lastCaptureBlobRef = useRef<Blob | null>(null)

  const [captureFormat, setCaptureFormat] = useState<BookCaptureFormat>('png')
  const [jpegQuality, setJpegQuality] = useState(0.88)
  const [hideChromeForCapture, setHideChromeForCapture] = useState(true)
  const [watermarkEnabled, setWatermarkEnabled] = useState(false)
  const [suppressChrome, setSuppressChrome] = useState(false)
  const [regionSelectOpen, setRegionSelectOpen] = useState(false)
  const [captureBusy, setCaptureBusy] = useState(false)
  const [captionDialog, setCaptionDialog] = useState<{ fileRel: string } | null>(null)
  const [captionDraft, setCaptionDraft] = useState('')
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false)
  const [pdfFrom, setPdfFrom] = useState('1')
  const [pdfTo, setPdfTo] = useState('1')
  const [pdfExporting, setPdfExporting] = useState(false)
  const [pdfProgressLabel, setPdfProgressLabel] = useState<string | null>(null)
  const [hasLastImageCapture, setHasLastImageCapture] = useState(false)

  const strokeWidthScale =
    annotationMode === 'pen'
      ? ANNOTATION_PEN_STROKE_WIDTH_STEPS[penThicknessStep]
      : annotationMode === 'marker'
        ? ANNOTATION_STROKE_WIDTH_STEPS[markerThicknessStep]
        : annotationMode === 'eraser-line'
          ? ANNOTATION_STROKE_WIDTH_STEPS[eraserLineThicknessStep]
          : annotationMode === 'eraser'
            ? ANNOTATION_STROKE_WIDTH_STEPS[eraserPixelThicknessStep]
            : ANNOTATION_STROKE_WIDTH_STEPS[markerThicknessStep]

  const strokeColor =
    annotationMode === 'pen' ? penColor : annotationMode === 'marker' ? markerColor : undefined

  const shapeStrokeWidthScale = ANNOTATION_STROKE_WIDTH_STEPS[markerThicknessStep]
  const stampScale = ANNOTATION_STROKE_WIDTH_STEPS[markerThicknessStep]
  const textFontSizeNorm = ANNOTATION_TEXT_FONT_NORM_STEPS[penThicknessStep]
  const stickyFontSizeNorm = ANNOTATION_TEXT_FONT_NORM_STEPS[markerThicknessStep]
  const shapeColor = penColor

  const setCapsForPage = useCallback((page: number, caps: AnnotationCapabilities) => {
    setAnnCapsByPage((prev) => {
      const cur = prev[page]
      if (cur?.canUndo === caps.canUndo && cur?.canRedo === caps.canRedo) return prev
      return { ...prev, [page]: caps }
    })
  }, [])

  const onLeftAnnotationCaps = useCallback(
    (caps: AnnotationCapabilities) => setCapsForPage(pageNumber, caps),
    [pageNumber, setCapsForPage],
  )
  const onRightAnnotationCaps = useCallback(
    (caps: AnnotationCapabilities) => setCapsForPage(pageNumber + 1, caps),
    [pageNumber, setCapsForPage],
  )

  useEffect(() => {
    setAnnotationTargetPage(pageNumber)
  }, [pageNumber, isSinglePageMode])

  const activeAnnotationPage = isSinglePageMode ? pageNumber : annotationTargetPage
  const activeAnnCaps = annCapsByPage[activeAnnotationPage] ?? { canUndo: false, canRedo: false }
  const toolbarCaps = isWhiteboardOpen ? wbCaps : activeAnnCaps
  const clearTargetPage = isWhiteboardOpen ? whiteboardPage : activeAnnotationPage

  const onWhiteboardCaps = useCallback((caps: AnnotationCapabilities) => {
    setWbCaps(caps)
  }, [])

  function getActiveAnnotationRef() {
    if (isWhiteboardOpen) return wbAnnRef
    if (isSinglePageMode) return leftAnnRef
    return annotationTargetPage === pageNumber + 1 ? rightAnnRef : leftAnnRef
  }

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    if (open) {
      setIsMounted(true)
      timeoutId = setTimeout(() => setIsVisible(true), 16)
    } else {
      setIsVisible(false)
      timeoutId = setTimeout(() => setIsMounted(false), ANIMATION_MS)
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      setIsPageListOpen(false)
      setIsNotesOpen(false)
      setIsWhiteboardOpen(false)
    }
  }, [open])

  useEffect(() => {
    if (!isNotesOpen) return
    if (isSinglePageMode) {
      setNotesPage(pageNumber)
      return
    }
    if (numPages == null || !library || !selectedBookId || !selectedUnitId) return
    const book = library.books.find((b) => b.id === selectedBookId)
    const unit = book?.units.find((u) => u.id === selectedUnitId)
    if (!unit) return
    const cap = Math.min(numPages, getUnitReaderBounds(unit, numPages, book ?? undefined).max)
    setNotesPage((p) => {
      const right = pageNumber + 1
      if (p === pageNumber || (right <= cap && p === right)) return p
      return pageNumber
    })
  }, [pageNumber, isSinglePageMode, numPages, isNotesOpen, library, selectedBookId, selectedUnitId])

  useEffect(() => {
    if (!isWhiteboardOpen) return
    if (isSinglePageMode) {
      setWhiteboardPage(pageNumber)
      return
    }
    if (numPages == null || !library || !selectedBookId || !selectedUnitId) return
    const book = library.books.find((b) => b.id === selectedBookId)
    const unit = book?.units.find((u) => u.id === selectedUnitId)
    if (!unit) return
    const cap = Math.min(numPages, getUnitReaderBounds(unit, numPages, book ?? undefined).max)
    setWhiteboardPage((p) => {
      const right = pageNumber + 1
      if (p === pageNumber || (right <= cap && p === right)) return p
      return pageNumber
    })
  }, [pageNumber, isSinglePageMode, numPages, isWhiteboardOpen, library, selectedBookId, selectedUnitId])

  useEffect(() => {
    if (isNotesOpen) setIsWhiteboardOpen(false)
  }, [isNotesOpen])

  useEffect(() => {
    if (isWhiteboardOpen) setIsNotesOpen(false)
  }, [isWhiteboardOpen])

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (isNotesOpen) {
        e.preventDefault()
        setIsNotesOpen(false)
        return
      }
      if (isWhiteboardOpen) {
        e.preventDefault()
        setIsWhiteboardOpen(false)
        return
      }
      if (!isPageListOpen) return
      e.preventDefault()
      setIsPageListOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, isPageListOpen, isNotesOpen, isWhiteboardOpen])

  useEffect(() => {
    if (!selectedBookId || !selectedUnitId) return
    setNotesPage(pageNumber)
    setWhiteboardPage(pageNumber)
    // Intentionally omit pageNumber from deps: only reset the notes target when the focused book/unit changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBookId, selectedUnitId])

  useEffect(() => {
    let active = true
    async function setupPdfWorker() {
      const { pdfjs } = await import('react-pdf')
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
      if (active) setPdfReady(true)
    }
    void setupPdfWorker()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!open) return
    let active = true
    async function loadLibrary() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/books')
        const payload = (await res.json()) as BookLibraryPayload | { error: string }
        if (!res.ok) {
          const message = 'error' in payload ? payload.error : 'Could not load books.'
          throw new Error(message)
        }
        if (!active) return
        const lib = payload as BookLibraryPayload
        setLibrary(lib)

        const booksById = new Map(lib.books.map((book) => [book.id, book]))
        const sortedHistory = [...curriculumHistory].sort(
          (a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime(),
        )
        const assignedBookIdSet = new Set(assignedBookIds)
        const historyCandidates =
          assignedBookIds.length > 0
            ? sortedHistory.filter((entry) => assignedBookIdSet.has(entry.bookId))
            : sortedHistory

        let selectedBook = null as (typeof lib.books)[number] | null
        let selectedUnit: (typeof lib.books)[number]['units'][number] | null = null
        let initialPage: number | null = null

        for (const ref of assignedUnitRefs) {
          const book = booksById.get(ref.bookId)
          if (!book) continue
          const unit = book.units.find((u) => u.id === ref.unitId)
          if (!unit) continue
          selectedBook = book
          selectedUnit = unit
          initialPage = null
          break
        }

        if (!selectedBook || !selectedUnit) {
          for (const bookId of assignedBookIds) {
            const book = booksById.get(bookId)
            if (!book) continue
            if (book.units.length > 0) {
              selectedBook = book
              selectedUnit = book.units[0] ?? null
              initialPage = null
              break
            }
            if (!selectedBook) {
              selectedBook = book
            }
          }
        }

        if (!selectedBook || !selectedUnit) {
          for (const entry of historyCandidates) {
            const book = booksById.get(entry.bookId)
            if (!book) continue
            const unit = book.units.find((u) => u.id === entry.unitId)
            if (!unit) continue
            selectedBook = book
            selectedUnit = unit
            initialPage = Number.isFinite(entry.page) ? Math.max(1, Math.floor(entry.page)) : 1
            break
          }
        }

        setSelectedBookId(selectedBook?.id ?? null)
        setSelectedUnitId(selectedUnit?.id ?? null)
        if (selectedUnit && selectedBook) {
          const bounds = getUnitReaderBounds(selectedUnit, null, selectedBook ?? undefined)
          const seededPage = initialPage ?? getSavedUnitPage(selectedBook.id, selectedUnit.id)
          setPageNumber(clampPdfPage(seededPage, bounds))
        } else {
          setPageNumber(1)
        }
        setNumPages(null)
      } catch (e) {
        if (!active) return
        setError(e instanceof Error ? e.message : 'Could not load books.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadLibrary()
    return () => {
      active = false
    }
  }, [assignedBookIds, assignedUnitRefs, curriculumHistory, open])

  useEffect(() => {
    if (!open) return
    const area = pageAreaRef.current
    if (!area) return
    function syncPageWidth() {
      const el = pageAreaRef.current
      if (!el) return
      const bounds = el.getBoundingClientRect()
      setPageAreaSize({ w: bounds.width, h: bounds.height })
      const useSinglePageMode = bounds.width < SINGLE_PAGE_BREAKPOINT
      setIsSinglePageMode(useSinglePageMode)
      const safeHeight = bounds.height * 0.985
      const minWidth = useSinglePageMode ? 420 : 300
      if (useSinglePageMode) {
        const widthBased = bounds.width * 0.985
        const heightBased = safeHeight * pageAspectRatio
        setSpreadPageWidth(Math.floor(Math.max(minWidth, Math.min(widthBased, heightBased))))
        return
      }
      const spreadGap = 0
      const perPageWidth = (bounds.width - spreadGap) / 2
      const widthBased = perPageWidth * 0.995
      const heightBased = safeHeight * pageAspectRatio
      setSpreadPageWidth(Math.floor(Math.max(minWidth, Math.min(widthBased, heightBased))))
    }
    syncPageWidth()
    const observer = new ResizeObserver(syncPageWidth)
    observer.observe(area)
    window.addEventListener('resize', syncPageWidth)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', syncPageWidth)
    }
  }, [open, pageAspectRatio])
  function onPdfPageLoadSuccess(page: { originalWidth?: number; originalHeight?: number; width: number; height: number }) {
    const rawWidth = page.originalWidth ?? page.width
    const rawHeight = page.originalHeight ?? page.height
    if (!rawWidth || !rawHeight) return
    const nextRatio = rawWidth / rawHeight
    if (!Number.isFinite(nextRatio) || nextRatio <= 0) return
    setPageAspectRatio(nextRatio)
  }


  const selectedUnit = useMemo(() => {
    if (!library || !selectedBookId || !selectedUnitId) return null
    const book = library.books.find((item) => item.id === selectedBookId)
    return book?.units.find((unit) => unit.id === selectedUnitId) ?? null
  }, [library, selectedBookId, selectedUnitId])

  const selectedBook = useMemo(() => {
    if (!library || !selectedBookId) return null
    return library.books.find((item) => item.id === selectedBookId) ?? null
  }, [library, selectedBookId])

  const unitPageBounds = useMemo(() => {
    if (!selectedUnit) return { min: 1, max: Number.MAX_SAFE_INTEGER }
    return getUnitReaderBounds(selectedUnit, numPages, selectedBook ?? undefined)
  }, [selectedUnit, numPages, selectedBook])

  const visiblePages = useMemo(
    () => (selectedUnit ? getVisiblePdfPages(selectedUnit, numPages, selectedBook ?? undefined) : []),
    [selectedUnit, numPages, selectedBook],
  )
  const leftVisiblePageIndex = useMemo(() => {
    const idx = visiblePages.indexOf(pageNumber)
    return idx >= 0 ? idx : 0
  }, [visiblePages, pageNumber])
  const spreadRightPage = !isSinglePageMode ? (visiblePages[leftVisiblePageIndex + 1] ?? null) : null
  const showSpreadRightPage = spreadRightPage != null

  const pageListNumbers = useMemo(() => visiblePages, [visiblePages])

  const pageAlignmentRuntime = useMemo(() => {
    if (numPages == null || numPages < 1 || !selectedUnit || !selectedBook) {
      return buildPageAlignmentRuntime(null, [], [])
    }
    const { notCountedPdfPages, hiddenPdfPages } = getFileAlignment(selectedBook, selectedUnit.filePath)
    return buildPageAlignmentRuntime(numPages, hiddenPdfPages, notCountedPdfPages)
  }, [numPages, selectedBook, selectedUnit])

  const printedJumpBounds = useMemo(() => {
    if (numberingMode === 'original') {
      return { min: 1, max: Math.max(1, numPages ?? 1), usePrinted: false as const }
    }
    const rt = pageAlignmentRuntime
    if (!rt.effectiveTotal) {
      return { min: 1, max: Math.max(1, numPages ?? 1), usePrinted: false as const }
    }
    let minP = Number.MAX_SAFE_INTEGER
    let maxP = 1
    for (const pdf of visiblePages) {
      const e = rt.effectivePageByPdf.get(pdf)
      if (e == null) continue
      minP = Math.min(minP, e)
      maxP = Math.max(maxP, e)
    }
    if (minP === Number.MAX_SAFE_INTEGER) {
      return { min: 1, max: Math.max(1, rt.effectiveTotal), usePrinted: true as const }
    }
    return { min: minP, max: maxP, usePrinted: true as const }
  }, [visiblePages, pageAlignmentRuntime, numPages, numberingMode])

  useEffect(() => {
    if (!open || !selectedUnit) return
    const fileUrl = makeUnitFileUrl(selectedUnit.filePath)
    const prev = prevUnitCacheRef.current
    if (prev && prev.unitId !== selectedUnit.id) {
      clearThumbnailCacheForUnit(prev.unitId)
      clearPdfLoadCacheForFileUrl(prev.fileUrl)
    }
    prevUnitCacheRef.current = { unitId: selectedUnit.id, fileUrl }
  }, [open, selectedUnit])

  const spreadGutterOverlayStyle = useMemo(() => {
    const { w: aw, h: ah } = pageAreaSize
    if (aw <= 0) {
      return { left: 0, top: 0, width: '100%', height: '100%' }
    }
    const overlapPx = aw * 0.026
    const clusterW = Math.max(0, Math.min(spreadPageWidth * 2 - overlapPx, aw))
    const pageH = spreadPageWidth / pageAspectRatio
    const clusterH = Math.min(pageH, ah * 0.985)
    return {
      left: '50%',
      top: '50%',
      width: clusterW,
      height: clusterH,
      transform: 'translate(-50%, -50%)',
    }
  }, [pageAreaSize, spreadPageWidth, pageAspectRatio])

  function goToPage(nextPage: number) {
    if (!selectedBookId || !selectedUnitId || !selectedUnit) return
    const bounds = getUnitReaderBounds(selectedUnit, numPages, selectedBook ?? undefined)
    let normalizedNext = clampPdfPageToVisible(nextPage, visiblePages, bounds)
    if (!isSinglePageMode) {
      const idx = visiblePages.indexOf(normalizedNext)
      normalizedNext = idx >= 0 ? visiblePages[Math.max(0, idx - (idx % 2))] ?? normalizedNext : normalizedNext
    }
    setPageNumber(normalizedNext)
    saveUnitPage(selectedBookId, selectedUnitId, normalizedNext)
  }

  function goToAdjacentPage(direction: -1 | 1) {
    if (!visiblePages.length) return
    const step = isSinglePageMode ? 1 : 2
    const currentIndex = Math.max(0, visiblePages.indexOf(pageNumber))
    const nextIndex = Math.max(0, Math.min(currentIndex + direction * step, visiblePages.length - 1))
    const nextPage = visiblePages[nextIndex] ?? pageNumber
    goToPage(nextPage)
  }

  const commitPageJump = useCallback(() => {
    const raw = pageJumpDraft.trim()
    const rt = pageAlignmentRuntime
    const { min: effMin, max: effMax, usePrinted } = printedJumpBounds

    const clampPrinted = (n: number) => Math.max(effMin, Math.min(effMax, Math.floor(n)))

    const resolvePrintedToPdf = (printed: number): number | null => {
      if (!usePrinted) return Number.isFinite(printed) ? printed : null
      const e = clampPrinted(printed)
      const pdf = resolveAlignedAnchorPage(e, selectedBook ?? undefined, selectedUnit ?? undefined, numPages, numberingMode)
      return pdf != null && Number.isFinite(pdf) ? pdf : null
    }

    const spreadMatch = raw.match(/^(\d+)\s*-\s*(\d+)\s*$/)
    const singleMatch = raw.match(/^(\d+)$/)

    if (usePrinted) {
      if (!isSinglePageMode && spreadMatch) {
        const pdf = resolvePrintedToPdf(parseInt(spreadMatch[1]!, 10))
        if (pdf != null) goToPage(pdf)
        return
      }
      if (singleMatch) {
        const pdf = resolvePrintedToPdf(parseInt(singleMatch[1]!, 10))
        if (pdf != null) goToPage(pdf)
        return
      }
      if (spreadMatch) {
        const pdf = resolvePrintedToPdf(parseInt(spreadMatch[1]!, 10))
        if (pdf != null) goToPage(pdf)
        return
      }
      const loose = raw.match(/^(\d+)/)
      if (loose) {
        const pdf = resolvePrintedToPdf(parseInt(loose[1]!, 10))
        if (pdf != null) goToPage(pdf)
      }
      return
    }

    const m = raw.match(/^(\d+)/)
    if (!m) return
    const n = parseInt(m[1]!, 10)
    if (!Number.isFinite(n)) return
    goToPage(n)
  }, [pageJumpDraft, pageAlignmentRuntime, printedJumpBounds, isSinglePageMode, goToPage, selectedBook, selectedUnit, numPages, numberingMode])

  function onDocumentLoadSuccess(meta: { numPages: number }) {
    setNumPages(meta.numPages)
    if (!selectedBookId || !selectedUnitId || !selectedUnit) return
    const bounds = getUnitReaderBounds(selectedUnit, meta.numPages, selectedBook ?? undefined)
    const nextVisible = getVisiblePdfPages(selectedUnit, meta.numPages, selectedBook ?? undefined)
    let bounded = clampPdfPageToVisible(pageNumber, nextVisible, bounds)
    if (!isSinglePageMode) {
      const idx = nextVisible.indexOf(bounded)
      bounded = idx >= 0 ? nextVisible[Math.max(0, idx - (idx % 2))] ?? bounded : bounded
    }
    if (bounded !== pageNumber) {
      setPageNumber(bounded)
    }
    saveUnitPage(selectedBookId, selectedUnitId, bounded)
  }

  useEffect(() => {
    if (!selectedBookId || !selectedUnitId || !selectedUnit) return
    const bounds = getUnitReaderBounds(selectedUnit, numPages, selectedBook ?? undefined)
    let bounded = clampPdfPageToVisible(pageNumber, visiblePages, bounds)
    if (!isSinglePageMode) {
      const idx = visiblePages.indexOf(bounded)
      bounded = idx >= 0 ? visiblePages[Math.max(0, idx - (idx % 2))] ?? bounded : bounded
    }
    if (bounded === pageNumber) return
    setPageNumber(bounded)
    saveUnitPage(selectedBookId, selectedUnitId, bounded)
  }, [isSinglePageMode, numPages, pageNumber, selectedBookId, selectedBook, selectedUnitId, selectedUnit, visiblePages])

  useEffect(() => {
    if (!isPageListOpen) return
    activePageRowRef.current?.scrollIntoView({ block: 'nearest' })
  }, [isPageListOpen, pageNumber, numPages, isSinglePageMode])

  useEffect(() => {
    if (pageJumpFocused) return
    setPageJumpDraft(
      mapPdfSpreadToDisplayLabel(
        pageNumber,
        spreadRightPage,
        isSinglePageMode,
        selectedBook,
        selectedUnit,
        numPages,
        numberingMode,
      ),
    )
  }, [pageNumber, isSinglePageMode, numPages, pageJumpFocused, spreadRightPage, pageAlignmentRuntime, selectedBook, selectedUnit, numberingMode])

  const getCurrentPageCaptureEl = useCallback((): HTMLElement | null => {
    if (isWhiteboardOpen && wbCaptureRootRef.current) return wbCaptureRootRef.current
    if (isSinglePageMode) return leftPageCaptureRef.current
    if (spreadRightPage != null && annotationTargetPage === spreadRightPage) return rightPageCaptureRef.current
    return leftPageCaptureRef.current
  }, [isWhiteboardOpen, isSinglePageMode, annotationTargetPage, pageNumber, spreadRightPage])

  const formatWatermarkDateLine = useCallback(() => {
    const d = new Date()
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  }, [])

  const runImageCapture = useCallback(
    async (opts: { kind: 'full' | 'page' | 'region'; regionCss?: { x: number; y: number; width: number; height: number } }) => {
      const rootEl =
        opts.kind === 'full' || opts.kind === 'region' ? pageAreaRef.current : getCurrentPageCaptureEl()
      if (!rootEl) {
        toast.error('Nothing to capture yet.')
        return
      }
      if (!selectedBookId || !selectedUnit) {
        toast.error('Open a book unit first.')
        return
      }
      const metaPage = isWhiteboardOpen
        ? whiteboardPage
        : isSinglePageMode
          ? pageNumber
          : annotationTargetPage

      setCaptureBusy(true)
      const prevLaser = annotationMode === 'laser'
      if (prevLaser) setAnnotationMode('pen')
      const useSuppress = hideChromeForCapture
      if (useSuppress) setSuppressChrome(true)
      await settleLayout()
      await settleLayout()

      try {
        let canvas = await captureElementToCanvas(rootEl)
        if (opts.kind === 'region' && opts.regionCss) {
          const cropPx = domRectToCanvasCrop(
            canvas,
            opts.regionCss,
            rootEl.offsetWidth,
            rootEl.offsetHeight,
          )
          canvas = cropCanvas(canvas, cropPx)
        }
        if (watermarkEnabled && studentName?.trim()) {
          canvas = applyWatermarkToCanvas(
            canvas,
            `${studentName.trim()} · ${formatWatermarkDateLine()}`,
          )
        }
        const blob = await canvasToBlob(canvas, captureFormat, jpegQuality)
        lastCaptureBlobRef.current = blob
        setHasLastImageCapture(true)
        const base = buildExportBaseName({
          bookId: selectedBookId,
          unitId: selectedUnit.id,
          page: metaPage,
          kind: opts.kind === 'full' ? 'full' : opts.kind === 'page' ? 'page' : 'region',
        })
        const { relativePath } = await uploadStudentWorkBlob({
          studentId,
          baseName: base,
          blob,
          category: 'exports-book-review',
          meta: {
            bookId: selectedBookId,
            unitId: selectedUnit.id,
            page: metaPage,
            captureKind: opts.kind,
            format: captureFormat,
            watermarked: watermarkEnabled,
            studentName: studentName?.trim(),
            exportedAt: new Date().toISOString(),
            unitTitle: selectedUnit.title,
          },
        })
        toast.success(`Saved ${relativePath}`)
        setCaptionDialog({ fileRel: relativePathUnderStudentWork(relativePath) })
        setCaptionDraft('')
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Capture failed'
        toast.error(msg)
      } finally {
        if (useSuppress) setSuppressChrome(false)
        if (prevLaser) setAnnotationMode('laser')
        setCaptureBusy(false)
        await settleLayout()
      }
    },
    [
      selectedBookId,
      selectedUnit,
      annotationMode,
      hideChromeForCapture,
      watermarkEnabled,
      studentName,
      captureFormat,
      jpegQuality,
      studentId,
      getCurrentPageCaptureEl,
      formatWatermarkDateLine,
      isWhiteboardOpen,
      whiteboardPage,
      isSinglePageMode,
      pageNumber,
      annotationTargetPage,
    ],
  )

  const runPdfPacketExport = useCallback(async () => {
    if (isWhiteboardOpen) {
      toast.error('Close the whiteboard before exporting a page-range PDF.')
      return
    }
    if (!selectedBookId || !selectedUnit || numPages == null) {
      toast.error('Open a book unit first.')
      return
    }
    const bounds = getUnitReaderBounds(selectedUnit, numPages, selectedBook ?? undefined)
    const from = Math.max(bounds.min, Math.min(bounds.max, parseInt(pdfFrom, 10) || bounds.min))
    const to = Math.max(from, Math.min(bounds.max, parseInt(pdfTo, 10) || from))
    if (to - from + 1 > 40) {
      toast.error('Select at most 40 pages for one PDF.')
      return
    }

    const prevSpread = isSinglePageMode
    const prevPage = pageNumber
    const prevLaser = annotationMode === 'laser'
    if (prevLaser) setAnnotationMode('pen')

    setPdfExporting(true)
    setPdfDialogOpen(false)
    setCaptureBusy(true)
    const useSuppress = hideChromeForCapture
    if (useSuppress) setSuppressChrome(true)

    const jpegDataUrls: string[] = []
    let pageW = 0
    let pageH = 0

    try {
      setIsSinglePageMode(true)
      await settleLayout()

      for (let p = from; p <= to; p++) {
        setPdfProgressLabel(`Rendering page ${p} of ${to}…`)
        setPageNumber(p)
        await new Promise<void>((r) => setTimeout(() => r(), 420))
        await settleLayout()
        await settleLayout()

        const el = leftPageCaptureRef.current
        if (!el) throw new Error('Page surface not ready')
        let canvas = await captureElementToCanvas(el)
        if (watermarkEnabled && studentName?.trim()) {
          canvas = applyWatermarkToCanvas(
            canvas,
            `${studentName.trim()} · ${formatWatermarkDateLine()}`,
          )
        }
        if (p === from) {
          pageW = canvas.width
          pageH = canvas.height
        }
        jpegDataUrls.push(canvas.toDataURL('image/jpeg', 0.92))
      }

      const { jsPDF } = await import('jspdf/dist/jspdf.es.min.js')
      const orientation = pageW >= pageH ? 'landscape' : 'portrait'
      const doc = new jsPDF({
        orientation,
        unit: 'px',
        format: [pageW, pageH],
      })
      jpegDataUrls.forEach((dataUrl, i) => {
        if (i > 0) doc.addPage([pageW, pageH], orientation === 'landscape' ? 'l' : 'p')
        doc.addImage(dataUrl, 'JPEG', 0, 0, pageW, pageH, undefined, 'FAST')
      })
      const pdfBlob = doc.output('blob')
      const base = buildPdfPacketBaseName({
        bookId: selectedBookId,
        unitId: selectedUnit.id,
        pageFrom: from,
        pageTo: to,
      })
      const typedPdf = new File([pdfBlob], `${base}.pdf`, { type: 'application/pdf' })
      const { relativePath } = await uploadStudentWorkBlob({
        studentId,
        baseName: base,
        blob: typedPdf,
        category: 'exports-book-review',
        meta: {
          bookId: selectedBookId,
          unitId: selectedUnit.id,
          pageFrom: from,
          pageTo: to,
          captureKind: 'pdf-packet',
          format: 'pdf',
          watermarked: watermarkEnabled,
          studentName: studentName?.trim(),
          exportedAt: new Date().toISOString(),
          unitTitle: selectedUnit.title,
        },
      })
      toast.success(`Saved ${relativePath}`)
      setCaptionDialog({ fileRel: relativePathUnderStudentWork(relativePath) })
      setCaptionDraft('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'PDF export failed'
      toast.error(msg)
    } finally {
      setIsSinglePageMode(prevSpread)
      setPageNumber(prevPage)
      if (selectedBookId && selectedUnitId && numPages != null && selectedUnit) {
        const bounds = getUnitReaderBounds(selectedUnit, numPages, selectedBook ?? undefined)
        const bounded = clampPdfPage(prevPage, bounds)
        saveUnitPage(selectedBookId, selectedUnitId, bounded)
      }
      if (useSuppress) setSuppressChrome(false)
      if (prevLaser) setAnnotationMode('laser')
      setPdfProgressLabel(null)
      setPdfExporting(false)
      setCaptureBusy(false)
      await settleLayout()
    }
  }, [
    selectedBookId,
    selectedBook,
    selectedUnit,
    numPages,
    pdfFrom,
    pdfTo,
    isSinglePageMode,
    pageNumber,
    studentId,
    hideChromeForCapture,
    watermarkEnabled,
    studentName,
    formatWatermarkDateLine,
    annotationMode,
    isWhiteboardOpen,
    selectedUnitId,
  ])

  const copyLastCaptureToClipboard = useCallback(async () => {
    const b = lastCaptureBlobRef.current
    if (!b) return
    try {
      let clipBlob: Blob = b
      if (b.type !== 'image/png') {
        const url = URL.createObjectURL(b)
        try {
          const img = document.createElement('img')
          img.decoding = 'async'
          img.src = url
          await img.decode()
          const c = document.createElement('canvas')
          c.width = img.naturalWidth
          c.height = img.naturalHeight
          c.getContext('2d')?.drawImage(img, 0, 0)
          clipBlob = await canvasToBlob(c, 'png')
        } finally {
          URL.revokeObjectURL(url)
        }
      }
      await copyImageBlobToClipboard(clipBlob)
      toast.success('Copied to clipboard')
    } catch {
      toast.error('Clipboard copy failed.')
    }
  }, [])

  if (!isMounted) return null

  /** Reader may resolve from book ids, unit refs, or session history — do not gate the frame on book ids alone. */
  const hasCurriculumOrHistory =
    assignedBookIds.length > 0 || assignedUnitRefs.length > 0 || curriculumHistory.length > 0
  const hasResolvedUnit = !!selectedUnit

  const unitThumbFileUrl = hasResolvedUnit && selectedUnit ? makeUnitFileUrl(selectedUnit.filePath) : ''
  const pageCanvasHeightPx = spreadPageWidth / pageAspectRatio

  return (
    <div
      className={`absolute inset-0 z-50 p-0 transition-opacity duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {hasResolvedUnit && numPages != null ? (
        <>
          <div
            className={`absolute inset-y-0 left-0 z-50 flex min-h-0 w-[min(148px,calc(100vw-12px))] flex-col border-r border-[#4a3421]/18 bg-gradient-to-b from-[#faf6ef] to-[#e8dfd2] shadow-[4px_0_16px_rgba(12,6,2,0.12)] transition-transform duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none [scrollbar-gutter:stable] ${
              isPageListOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'
            }`}
            aria-hidden={!isPageListOpen}
          >
            <header className="flex shrink-0 items-center justify-between gap-1.5 border-b border-[#4a3421]/12 px-2 py-2">
              <p className="min-w-0 truncate text-[11px] font-semibold leading-tight text-[#3d2918]">
                {selectedUnit?.title}
              </p>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7 shrink-0 rounded-md border-[#5c4030]/25 bg-white/50 p-0 text-[#3d2918] hover:bg-white/80"
                onClick={() => setIsPageListOpen(false)}
                aria-label="Close page list"
              >
                <X size={14} />
              </Button>
            </header>
            <div
              id="book-page-list"
              ref={setPageListScrollRoot}
              className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-2 py-2 [scrollbar-color:rgba(107,78,50,0.3)_transparent] [scrollbar-width:thin]"
              role="list"
            >
              {pageListNumbers.map((p) => {
                const rowActive = isSinglePageMode
                  ? p === pageNumber
                  : p === pageNumber || (showSpreadRightPage && p === spreadRightPage)
                return (
                  <button
                    key={p}
                    type="button"
                    ref={p === pageNumber ? activePageRowRef : undefined}
                    role="listitem"
                    onClick={() => goToPage(p)}
                    className={`flex w-full flex-col items-center gap-0.5 rounded-md py-1.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-600/45 focus-visible:ring-offset-1 focus-visible:ring-offset-[#faf6ef] ${
                      rowActive
                        ? 'bg-amber-200/35 ring-1 ring-amber-700/25'
                        : 'hover:bg-[#5c4030]/[0.06]'
                    }`}
                  >
                    <PdfPageThumbnail
                      fileUrl={unitThumbFileUrl}
                      unitId={selectedUnit!.id}
                      pageNumber={p}
                      width={PDF_THUMB_WIDTH}
                      scrollRoot={pageListScrollRoot}
                      pdfReady={pdfReady}
                      label={`Page ${mapPdfPageToDisplayLabel(p, selectedBook, selectedUnit, numPages, numberingMode)}`}
                    />
                    <span
                      className={`tabular-nums text-[10px] leading-none ${
                        rowActive ? 'font-semibold text-[#2a1d12]' : 'font-medium text-[#5c4030]/85'
                      }`}
                    >
                      {mapPdfPageToDisplayLabel(p, selectedBook, selectedUnit, numPages, numberingMode)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
          {isPageListOpen ? (
            <button
              type="button"
              onClick={() => setIsPageListOpen(false)}
              aria-label="Close page list"
              className="absolute inset-0 z-40 bg-[#120a03]/45"
            />
          ) : null}
        </>
      ) : null}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={`relative z-10 transition-all duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
          }`}
        >
          <div
            className="relative mx-auto max-w-full shrink-0"
            style={{
              width: `min(100vw, calc(100vh * ${BOOK_FRAME_ASPECT_RATIO}))`,
              aspectRatio: '1264 / 816',
            }}
          >
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onClose}
          aria-label="Close book overlay"
          className="absolute right-2 top-2 z-30 h-9 w-9 rounded-full bg-[var(--card)]/95"
        >
          <X size={16} />
        </Button>

        {hasResolvedUnit ? (
          <div
            className={cn(suppressChrome && 'pointer-events-none invisible opacity-0')}
            aria-hidden={suppressChrome}
          >
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={numPages == null}
              onClick={() => {
                setIsNotesOpen(false)
                setIsWhiteboardOpen(false)
                setIsPageListOpen(true)
              }}
              aria-expanded={isPageListOpen}
              aria-controls={numPages != null ? 'book-page-list' : undefined}
              aria-label={numPages == null ? 'Loading pages' : 'Open page list'}
              className={`absolute left-2 top-2 z-[60] h-9 w-9 rounded-full bg-[var(--card)]/95 ${
                isPageListOpen ? 'invisible pointer-events-none' : ''
              }`}
            >
              <List size={16} />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={numPages == null}
              onClick={() => {
                setIsPageListOpen(false)
                setIsWhiteboardOpen(false)
                setNotesPage(isSinglePageMode ? pageNumber : annotationTargetPage)
                setIsNotesOpen(true)
              }}
              aria-expanded={isNotesOpen}
              aria-label={numPages == null ? 'Loading pages' : 'Open page notes'}
              className={`absolute left-[3.25rem] top-2 z-[60] h-9 w-9 rounded-full bg-[var(--card)]/95 ${
                isNotesOpen || isPageListOpen || isWhiteboardOpen ? 'invisible pointer-events-none' : ''
              }`}
            >
              <NotebookPen size={16} />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={numPages == null}
              onClick={() => {
                setIsPageListOpen(false)
                setIsNotesOpen(false)
                setWhiteboardPage(isSinglePageMode ? pageNumber : annotationTargetPage)
                setIsWhiteboardOpen(true)
              }}
              aria-expanded={isWhiteboardOpen}
              aria-label={numPages == null ? 'Loading pages' : 'Open whiteboard'}
              className={`absolute left-[5.75rem] top-2 z-[60] h-9 w-9 rounded-full bg-[var(--card)]/95 ${
                isWhiteboardOpen || isPageListOpen ? 'invisible pointer-events-none' : ''
              }`}
            >
              <LayoutTemplate size={16} />
            </Button>
          </div>
        ) : null}

        {/* eslint-disable-next-line @next/next/no-img-element -- decorative frame asset from local public folder */}
        <img
          src="/Full%20Screen%20Book%20Overlay/Book%20Opened.png"
          alt="Open book frame"
          className="pointer-events-none block h-full w-full select-none object-contain drop-shadow-[0_22px_44px_rgba(0,0,0,0.42)]"
          draggable={false}
        />

        <div className="absolute left-[4.8%] right-[4.8%] top-[9.7%] bottom-[9.7%] overflow-visible">
          {isWhiteboardOpen && selectedBookId && numPages != null ? (
            <div
              className={cn(
                'pointer-events-auto absolute bottom-full left-0 right-0 z-[20] mb-1 flex items-center justify-between gap-2 px-0.5 pb-0.5',
                suppressChrome && 'pointer-events-none invisible opacity-0',
              )}
            >
              <div className="flex min-w-0 flex-1 items-center justify-center gap-1">
                {!isSinglePageMode && showSpreadRightPage && spreadRightPage != null ? (
                  <div className="flex gap-1" role="tablist" aria-label="Whiteboard page">
                    <Button
                      type="button"
                      size="sm"
                      variant={whiteboardPage === pageNumber ? 'default' : 'outline'}
                      className={
                        whiteboardPage === pageNumber
                          ? 'h-7 bg-[#5c4030] px-2 text-xs text-white hover:bg-[#5c4030]/90'
                          : 'h-7 border-[#5c4030]/25 bg-white/80 px-2 text-xs text-[#3d2918]'
                      }
                      onClick={() => setWhiteboardPage(pageNumber)}
                    >
                      Page {mapPdfPageToDisplayLabel(pageNumber, selectedBook, selectedUnit, numPages, numberingMode)}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={whiteboardPage === spreadRightPage ? 'default' : 'outline'}
                      className={
                        whiteboardPage === spreadRightPage
                          ? 'h-7 bg-[#5c4030] px-2 text-xs text-white hover:bg-[#5c4030]/90'
                          : 'h-7 border-[#5c4030]/25 bg-white/80 px-2 text-xs text-[#3d2918]'
                      }
                      onClick={() => setWhiteboardPage(spreadRightPage)}
                    >
                      Page {mapPdfPageToDisplayLabel(spreadRightPage, selectedBook, selectedUnit, numPages, numberingMode)}
                    </Button>
                  </div>
                ) : (
                  <span className="text-[11px] font-semibold tabular-nums text-[#3d2918]">
                    Whiteboard · Page {mapPdfPageToDisplayLabel(whiteboardPage, selectedBook, selectedUnit, numPages, numberingMode)}
                  </span>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 shrink-0 border-[#5c4030]/25 bg-white/80 text-[11px] text-[#3d2918]"
                onClick={() => setIsWhiteboardOpen(false)}
              >
                Done
              </Button>
            </div>
          ) : null}
          <div ref={pageAreaRef} className="absolute inset-0 overflow-hidden">
          {!hasCurriculumOrHistory ? (
            <div className="flex h-full items-center justify-center">
              <div className="max-w-md rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)]/92 p-6 text-center backdrop-blur-sm">
                <p className="text-base font-semibold text-foreground">No curriculum assigned yet for this student.</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Assign a curriculum book first in the teacher plan screen.
                </p>
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
                <p className="mt-2 text-sm text-muted-foreground">
                  Add unit PDF files to this book folder in `book-library` and try again.
                </p>
              </div>
            </div>
          ) : !pdfReady ? (
            <p className="p-6 text-sm text-muted-foreground">Preparing PDF viewer...</p>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <PdfDocument
                className={`h-full w-full ${isWhiteboardOpen ? 'pointer-events-none' : ''}`}
                file={makeUnitFileUrl(selectedUnit.filePath)}
                options={PDF_DOCUMENT_OPTIONS}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={<p className="p-6 text-sm text-muted-foreground">Loading PDF...</p>}
                error={<p className="p-6 text-sm text-[var(--brand-red)]">Could not open this PDF unit.</p>}
              >
                {isSinglePageMode ? (
                  <div className="flex h-full w-full items-center justify-center">
                    <div ref={leftPageCaptureRef} className="relative inline-block">
                      <PdfPage
                        pageNumber={pageNumber}
                        width={spreadPageWidth}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        onLoadSuccess={onPdfPageLoadSuccess}
                      />
                      {selectedBookId ? (
                        <BookPageAnnotationLayer
                          ref={leftAnnRef}
                          studentId={studentId}
                          bookId={selectedBookId}
                          unitId={selectedUnit!.id}
                          pageNumber={pageNumber}
                          widthPx={spreadPageWidth}
                          heightPx={pageCanvasHeightPx}
                          mode={annotationMode}
                          stampVariant={stampVariant}
                          strokeWidthScale={strokeWidthScale}
                          shapeStrokeWidthScale={shapeStrokeWidthScale}
                          stampScale={stampScale}
                          strokeColor={strokeColor}
                          shapeColor={shapeColor}
                          textFontSizeNorm={textFontSizeNorm}
                          stickyFontSizeNorm={stickyFontSizeNorm}
                          defaultStickyWNorm={0.22}
                          defaultStickyHNorm={0.14}
                          onPointerSessionStart={() => setAnnotationTargetPage(pageNumber)}
                          onCapabilitiesChange={onLeftAnnotationCaps}
                        />
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="relative h-full w-full min-h-0">
                    <div className="grid h-full w-full grid-cols-2 gap-0">
                      <div className="mr-[-2.6%] flex h-full items-center justify-end">
                        <div ref={leftPageCaptureRef} className="relative inline-block">
                          <PdfPage
                            pageNumber={pageNumber}
                            width={spreadPageWidth}
                            renderTextLayer={false}
                            renderAnnotationLayer={false}
                            onLoadSuccess={onPdfPageLoadSuccess}
                          />
                          {selectedBookId ? (
                            <BookPageAnnotationLayer
                              ref={leftAnnRef}
                              studentId={studentId}
                              bookId={selectedBookId}
                              unitId={selectedUnit!.id}
                              pageNumber={pageNumber}
                              widthPx={spreadPageWidth}
                              heightPx={pageCanvasHeightPx}
                              mode={annotationMode}
                              stampVariant={stampVariant}
                              strokeWidthScale={strokeWidthScale}
                              shapeStrokeWidthScale={shapeStrokeWidthScale}
                              stampScale={stampScale}
                              strokeColor={strokeColor}
                              shapeColor={shapeColor}
                              textFontSizeNorm={textFontSizeNorm}
                              stickyFontSizeNorm={stickyFontSizeNorm}
                              defaultStickyWNorm={0.22}
                              defaultStickyHNorm={0.14}
                              onPointerSessionStart={() => setAnnotationTargetPage(pageNumber)}
                              onCapabilitiesChange={onLeftAnnotationCaps}
                            />
                          ) : null}
                        </div>
                      </div>
                      <div className="ml-[-2.6%] flex h-full items-center justify-start">
                        {showSpreadRightPage && spreadRightPage != null ? (
                          <div ref={rightPageCaptureRef} className="relative inline-block">
                            <PdfPage
                              pageNumber={spreadRightPage}
                              width={spreadPageWidth}
                              renderTextLayer={false}
                              renderAnnotationLayer={false}
                              onLoadSuccess={onPdfPageLoadSuccess}
                            />
                            {selectedBookId ? (
                              <BookPageAnnotationLayer
                                ref={rightAnnRef}
                                studentId={studentId}
                                bookId={selectedBookId}
                                unitId={selectedUnit!.id}
                                pageNumber={spreadRightPage}
                                widthPx={spreadPageWidth}
                                heightPx={pageCanvasHeightPx}
                                mode={annotationMode}
                                stampVariant={stampVariant}
                                strokeWidthScale={strokeWidthScale}
                                shapeStrokeWidthScale={shapeStrokeWidthScale}
                                stampScale={stampScale}
                                strokeColor={strokeColor}
                                shapeColor={shapeColor}
                                textFontSizeNorm={textFontSizeNorm}
                                stickyFontSizeNorm={stickyFontSizeNorm}
                                defaultStickyWNorm={0.22}
                                defaultStickyHNorm={0.14}
                                onPointerSessionStart={() => setAnnotationTargetPage(spreadRightPage)}
                                onCapabilitiesChange={onRightAnnotationCaps}
                              />
                            ) : null}
                          </div>
                        ) : (
                          <div className="h-[90%] w-full" aria-hidden />
                        )}
                      </div>
                    </div>
                    <div
                      className="pointer-events-none absolute z-[1]"
                      aria-hidden
                      style={{
                        ...spreadGutterOverlayStyle,
                        backgroundImage:
                          'linear-gradient(90deg, transparent 0%, transparent 42%, rgba(0,0,0,0.03) 44.5%, rgba(0,0,0,0.06) 46%, rgba(0,0,0,0.09) 47.5%, rgba(0,0,0,0.11) 48.5%, rgba(0,0,0,0.13) 49.5%, rgba(0,0,0,0.14) 50%, rgba(0,0,0,0.13) 50.5%, rgba(0,0,0,0.11) 51.5%, rgba(0,0,0,0.09) 52.5%, rgba(0,0,0,0.06) 54%, rgba(0,0,0,0.03) 56.5%, transparent 100%)',
                      }}
                    />
                  </div>
                )}
              </PdfDocument>

              {isWhiteboardOpen && selectedBookId && numPages != null ? (
                <div className="pointer-events-none absolute inset-0 z-[15] flex min-h-0 min-w-0 items-center justify-center">
                    {isSinglePageMode ? (
                      <div
                        ref={wbCaptureRootRef}
                        className="pointer-events-auto relative overflow-hidden border border-[#4a3421]/20 shadow-[0_14px_36px_rgba(0,0,0,0.22)]"
                        style={{
                          width: spreadPageWidth,
                          height: pageCanvasHeightPx,
                          ...WHITEBOARD_NOTEBOOK_SURFACE,
                        }}
                      >
                        <BookPageAnnotationLayer
                          key={`wb-${whiteboardPage}`}
                          ref={wbAnnRef}
                          studentId={studentId}
                          bookId={selectedBookId}
                          unitId={selectedUnit!.id}
                          pageNumber={whiteboardPage}
                          storageChannel="whiteboard"
                          widthPx={spreadPageWidth}
                          heightPx={pageCanvasHeightPx}
                          mode={annotationMode}
                          stampVariant={stampVariant}
                          strokeWidthScale={strokeWidthScale}
                          shapeStrokeWidthScale={shapeStrokeWidthScale}
                          stampScale={stampScale}
                          strokeColor={strokeColor}
                          shapeColor={shapeColor}
                          textFontSizeNorm={textFontSizeNorm}
                          stickyFontSizeNorm={stickyFontSizeNorm}
                          defaultStickyWNorm={0.22}
                          defaultStickyHNorm={0.14}
                          onCapabilitiesChange={onWhiteboardCaps}
                        />
                      </div>
                    ) : (
                      <div ref={wbCaptureRootRef} className="relative grid h-full w-full min-h-0 max-h-full grid-cols-2 gap-0">
                        <div className="mr-[-2.6%] flex h-full items-center justify-end">
                          {whiteboardPage === pageNumber ? (
                            <div
                              className="pointer-events-auto relative overflow-hidden border border-[#4a3421]/20 shadow-[0_14px_36px_rgba(0,0,0,0.22)]"
                              style={{
                                width: spreadPageWidth,
                                height: pageCanvasHeightPx,
                                ...WHITEBOARD_NOTEBOOK_SURFACE,
                              }}
                            >
                              <BookPageAnnotationLayer
                                key={`wb-${whiteboardPage}`}
                                ref={wbAnnRef}
                                studentId={studentId}
                                bookId={selectedBookId}
                                unitId={selectedUnit!.id}
                                pageNumber={whiteboardPage}
                                storageChannel="whiteboard"
                                widthPx={spreadPageWidth}
                                heightPx={pageCanvasHeightPx}
                                mode={annotationMode}
                                stampVariant={stampVariant}
                                strokeWidthScale={strokeWidthScale}
                                shapeStrokeWidthScale={shapeStrokeWidthScale}
                                stampScale={stampScale}
                                strokeColor={strokeColor}
                                shapeColor={shapeColor}
                                textFontSizeNorm={textFontSizeNorm}
                                stickyFontSizeNorm={stickyFontSizeNorm}
                                defaultStickyWNorm={0.22}
                                defaultStickyHNorm={0.14}
                                onCapabilitiesChange={onWhiteboardCaps}
                              />
                            </div>
                          ) : null}
                        </div>
                        <div className="ml-[-2.6%] flex h-full items-center justify-start">
                          {showSpreadRightPage && spreadRightPage != null && whiteboardPage === spreadRightPage ? (
                            <div
                              className="pointer-events-auto relative overflow-hidden border border-[#4a3421]/20 shadow-[0_14px_36px_rgba(0,0,0,0.22)]"
                              style={{
                                width: spreadPageWidth,
                                height: pageCanvasHeightPx,
                                ...WHITEBOARD_NOTEBOOK_SURFACE,
                              }}
                            >
                              <BookPageAnnotationLayer
                                key={`wb-${whiteboardPage}`}
                                ref={wbAnnRef}
                                studentId={studentId}
                                bookId={selectedBookId}
                                unitId={selectedUnit!.id}
                                pageNumber={whiteboardPage}
                                storageChannel="whiteboard"
                                widthPx={spreadPageWidth}
                                heightPx={pageCanvasHeightPx}
                                mode={annotationMode}
                                stampVariant={stampVariant}
                                strokeWidthScale={strokeWidthScale}
                                shapeStrokeWidthScale={shapeStrokeWidthScale}
                                stampScale={stampScale}
                                strokeColor={strokeColor}
                                shapeColor={shapeColor}
                                textFontSizeNorm={textFontSizeNorm}
                                stickyFontSizeNorm={stickyFontSizeNorm}
                                defaultStickyWNorm={0.22}
                                defaultStickyHNorm={0.14}
                                onCapabilitiesChange={onWhiteboardCaps}
                              />
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )}
                </div>
              ) : null}
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
        </div>

        {hasResolvedUnit && numPages != null && selectedBookId ? (
          <div
            className={cn(
              'pointer-events-auto absolute bottom-[12.5%] left-1/2 z-[28] flex max-w-[calc(100vw-12px)] -translate-x-1/2 justify-center px-1',
              suppressChrome && 'pointer-events-none invisible opacity-0',
            )}
            role="toolbar"
            aria-label="Annotation tools"
          >
            <div className="flex max-w-full flex-nowrap items-center gap-1 overflow-x-auto overflow-y-visible rounded-full border border-white/12 bg-black/45 py-1.5 pl-2 pr-2 text-white shadow-sm backdrop-blur-sm [scrollbar-width:thin]">
              <BookAnnotationToolbar
                annotationMode={annotationMode}
                setAnnotationMode={setAnnotationMode}
                stampVariant={stampVariant}
                setStampVariant={setStampVariant}
                penColor={penColor}
                setPenColor={setPenColor}
                markerColor={markerColor}
                setMarkerColor={setMarkerColor}
                penThicknessStep={penThicknessStep}
                setPenThicknessStep={setPenThicknessStep}
                markerThicknessStep={markerThicknessStep}
                setMarkerThicknessStep={setMarkerThicknessStep}
                eraserPixelThicknessStep={eraserPixelThicknessStep}
                setEraserPixelThicknessStep={setEraserPixelThicknessStep}
                eraserLineThicknessStep={eraserLineThicknessStep}
                setEraserLineThicknessStep={setEraserLineThicknessStep}
              />
              <span className="mx-0.5 h-6 w-px shrink-0 bg-white/25" aria-hidden />
              <BookCaptureMenu
                disabled={!pdfReady}
                busy={captureBusy}
                captureFormat={captureFormat}
                onCaptureFormatChange={setCaptureFormat}
                jpegQuality={jpegQuality}
                onJpegQualityChange={setJpegQuality}
                hideChromeForCapture={hideChromeForCapture}
                onHideChromeForCaptureChange={setHideChromeForCapture}
                watermarkEnabled={watermarkEnabled}
                onWatermarkEnabledChange={setWatermarkEnabled}
                studentDisplayName={studentName}
                onSaveFullStage={() => runImageCapture({ kind: 'full' })}
                onSaveCurrentPage={() => runImageCapture({ kind: 'page' })}
                onSelectRegion={() => setRegionSelectOpen(true)}
                onCopyLastCapture={() => copyLastCaptureToClipboard()}
                canCopyLast={hasLastImageCapture}
                onExportPdfPacket={() => {
                  if (numPages != null && selectedUnit) {
                    const b = getUnitReaderBounds(selectedUnit, numPages, selectedBook ?? undefined)
                    setPdfFrom(String(b.min))
                    setPdfTo(String(b.max))
                  }
                  setPdfDialogOpen(true)
                }}
              />
              <span className="mx-0.5 h-6 w-px shrink-0 bg-white/25" aria-hidden />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-full text-white hover:bg-white/15 disabled:opacity-35"
                disabled={!toolbarCaps.canUndo}
                aria-label={isWhiteboardOpen ? 'Undo whiteboard' : 'Undo annotation'}
                onClick={() => getActiveAnnotationRef().current?.undo()}
              >
                <Undo2 className="h-4 w-4" strokeWidth={2} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-full text-white hover:bg-white/15 disabled:opacity-35"
                disabled={!toolbarCaps.canRedo}
                aria-label={isWhiteboardOpen ? 'Redo whiteboard' : 'Redo annotation'}
                onClick={() => getActiveAnnotationRef().current?.redo()}
              >
                <Redo2 className="h-4 w-4" strokeWidth={2} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-full text-white hover:bg-white/15"
                aria-label={isWhiteboardOpen ? 'Clear whiteboard for this page' : 'Clear all ink on this page'}
                onClick={() => setClearInkOpen(true)}
              >
                <Trash2 className="h-4 w-4" strokeWidth={2} />
              </Button>
            </div>

            <AlertDialog open={clearInkOpen} onOpenChange={setClearInkOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {isWhiteboardOpen ? 'Clear this whiteboard?' : 'Clear this page?'}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {isWhiteboardOpen ? (
                      <>
                        Remove everything on the whiteboard for page {clearTargetPage}. PDF ink on the book is not
                        affected. Undo history for this whiteboard will be cleared as well.
                      </>
                    ) : (
                      <>
                        Remove all annotations on page {clearTargetPage}. The undo history for this page will be
                        cleared as well.
                      </>
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-[var(--brand-red)] text-white hover:bg-[var(--brand-red)]/90"
                    onClick={() => {
                      getActiveAnnotationRef().current?.clear()
                      setClearInkOpen(false)
                    }}
                  >
                    {isWhiteboardOpen ? 'Clear whiteboard' : 'Clear page'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : null}

        {hasResolvedUnit && numPages != null ? (
          <div
            className={cn(
              'pointer-events-auto absolute bottom-[5.5%] left-1/2 z-[25] flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-white shadow-sm backdrop-blur-sm',
              suppressChrome && 'pointer-events-none invisible opacity-0',
            )}
            role="group"
            aria-label="Page navigation"
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-full text-white hover:bg-white/15"
              disabled={!visiblePages.length || pageNumber === (visiblePages[0] ?? pageNumber)}
              onClick={() => goToAdjacentPage(-1)}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="text"
              inputMode="numeric"
              value={pageJumpDraft}
              onChange={(e) => setPageJumpDraft(e.target.value)}
              onFocus={() => {
                setPageJumpFocused(true)
                setPageJumpDraft(
                  mapPdfSpreadToDisplayLabel(
                    pageNumber,
                    spreadRightPage,
                    isSinglePageMode,
                    selectedBook,
                    selectedUnit,
                    numPages,
                    numberingMode,
                  ),
                )
              }}
              onBlur={() => {
                setPageJumpFocused(false)
                commitPageJump()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  ;(e.target as HTMLInputElement).blur()
                }
              }}
              aria-label={printedJumpBounds.usePrinted ? 'Go to printed page' : 'Go to PDF page'}
              aria-valuemin={printedJumpBounds.usePrinted ? printedJumpBounds.min : 1}
              aria-valuemax={
                printedJumpBounds.usePrinted
                  ? printedJumpBounds.max
                  : Math.min(numPages ?? 1, unitPageBounds.max)
              }
              className="h-8 min-w-[5.5rem] max-w-[8rem] border-0 bg-transparent text-center text-sm font-medium text-white shadow-none focus-visible:ring-2 focus-visible:ring-white/40"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-full text-white hover:bg-white/15"
              disabled={!visiblePages.length || pageNumber === (visiblePages[visiblePages.length - 1] ?? pageNumber)}
              onClick={() => goToAdjacentPage(1)}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
          </div>
        </div>
      </div>

      {hasResolvedUnit && numPages != null && selectedBookId ? (
        <BookPageNotesPanel
          open={isNotesOpen}
          onClose={() => setIsNotesOpen(false)}
          studentId={studentId}
          bookId={selectedBookId}
          unitId={selectedUnit!.id}
          notesPage={notesPage}
          onNotesPageChange={setNotesPage}
          numPages={Math.min(numPages, unitPageBounds.max)}
          spreadLeftPage={pageNumber}
          isSinglePageMode={isSinglePageMode}
        />
      ) : null}

      <Dialog open={pdfDialogOpen} onOpenChange={setPdfDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Export page range as PDF</DialogTitle>
            <DialogDescription>
              Captures each page in single-page layout (up to 40 pages) and saves one PDF under{' '}
              <code className="text-xs">student-work/…/exports/book-review/</code>.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="pdf-from">From page</Label>
              <Input
                id="pdf-from"
                type="number"
                min={1}
                max={numPages ?? 1}
                value={pdfFrom}
                onChange={(e) => setPdfFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pdf-to">To page</Label>
              <Input
                id="pdf-to"
                type="number"
                min={1}
                max={numPages ?? 1}
                value={pdfTo}
                onChange={(e) => setPdfTo(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPdfDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void runPdfPacketExport()}>
              Export PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={captionDialog != null}
        onOpenChange={(o) => {
          if (!o) setCaptionDialog(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Optional caption</DialogTitle>
            <DialogDescription>
              Add a short note for this file. It is stored in the sidecar <code className="text-xs">.meta.json</code> next
              to the image or PDF.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={captionDraft}
            onChange={(e) => setCaptionDraft(e.target.value)}
            rows={3}
            placeholder="e.g. Review irregular verbs on this page"
            className="resize-none"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCaptionDialog(null)}>
              Skip
            </Button>
            <Button
              type="button"
              onClick={async () => {
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
              }}
            >
              Save caption
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

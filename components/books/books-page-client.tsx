'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import { CheckCircle2, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import type {
  BookLessonPartRecord,
  BookLessonRecord,
  BookLibraryPayload,
  BookRecord,
  BookUnitRecord,
} from '@/lib/books/types'
import { mapPdfPageToDisplayLabel, type PageNumberingMode } from '@/lib/books/page-numbering'
import { clampPdfPage, clampPdfPageToVisible, getFileAlignment, getUnitReaderBounds, getVisiblePdfPages } from '@/lib/books/page-range'
import { buildPageAlignmentRuntime, resolveEffectiveAnchorToPdfPage } from '@/lib/books/page-alignment-runtime'
import { getSavedUnitPage, saveUnitPage } from '@/lib/books/progress'
import { appendStudentCurriculumSession } from '@/lib/students/selectors'
import { BookStructureWizard } from '@/components/books/book-structure-wizard'
import { BookDropUpload } from '@/components/books/book-drop-upload'
import { PdfPageThumbnail } from '@/components/students/pdf-page-thumbnail'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { bookHasTocMapping } from '@/lib/books/strip-book-toc-mapping'

const PdfDocument = dynamic(() => import('react-pdf').then((mod) => mod.Document), {
  ssr: false,
})
const PdfPage = dynamic(() => import('react-pdf').then((mod) => mod.Page), {
  ssr: false,
})
const PDF_DOCUMENT_OPTIONS = { wasmUrl: '/wasm/' } as const

interface SelectedUnitState {
  bookId: string
  unitId: string
}

function makeUnitFileUrl(filePath: string): string {
  return `/api/book-file?path=${encodeURIComponent(filePath)}`
}

function estimatePageByIndex(min: number, max: number, idx: number, total: number): number {
  if (max <= min) return min
  if (total <= 1) return min
  const clampedIdx = Math.max(0, Math.min(idx, total - 1))
  const span = max - min
  const ratio = clampedIdx / (total - 1)
  return min + Math.round(span * ratio)
}

function formatPageSpan(
  start: number | null,
  end: number | null,
  book?: BookRecord | null,
  unit?: BookUnitRecord | null,
  totalPdfPages?: number | null,
  mode: PageNumberingMode = 'mapped',
): string {
  if (start == null) return 'pages —'
  const left = mapPdfPageToDisplayLabel(start, book, unit, totalPdfPages ?? null, mode)
  if (end == null || end <= start) return `p${left}`
  const right = mapPdfPageToDisplayLabel(end, book, unit, totalPdfPages ?? null, mode)
  return `p${left}-${right}`
}

function pageRangeForIndex<T extends { startPageHint?: number; endPageHint?: number }>(
  items: T[],
  index: number,
  fallbackStart?: number | null,
  fallbackEnd?: number | null,
): { start: number | null; end: number | null } {
  const current = items[index]
  const start = typeof current?.startPageHint === 'number'
    ? Math.round(current.startPageHint)
    : (fallbackStart ?? null)
  const explicitEnd = typeof current?.endPageHint === 'number'
    ? Math.round(current.endPageHint)
    : null
  if (explicitEnd != null) return { start, end: explicitEnd }
  const next = items
    .slice(index + 1)
    .find((item) => typeof item.startPageHint === 'number' && Number.isFinite(item.startPageHint))
  const nextStart = typeof next?.startPageHint === 'number' ? Math.round(next.startPageHint) : null
  return {
    start,
    end: nextStart != null ? Math.max(start ?? 1, nextStart - 1) : (fallbackEnd ?? null),
  }
}

function resolveStartHintWithAlignment(
  min: number,
  max: number,
  hint: number | null | undefined,
  book: BookRecord | null | undefined,
  unit: BookUnitRecord,
  totalPdfPages: number | null,
): number | null {
  if (typeof hint !== 'number' || !Number.isFinite(hint)) return null
  const rounded = Math.round(hint)
  const raw = clampPdfPage(rounded, { min, max })
  const { notCountedPdfPages, hiddenPdfPages } = getFileAlignment(book, unit.filePath)
  if (!notCountedPdfPages.length && !hiddenPdfPages.length) return raw
  const runtime = buildPageAlignmentRuntime(totalPdfPages, hiddenPdfPages, notCountedPdfPages)
  const mapped = resolveEffectiveAnchorToPdfPage(rounded, runtime)
  if (mapped == null) return raw
  return clampPdfPage(mapped, { min, max })
}

export function BooksPageClient() {
  const numberingMode: PageNumberingMode = 'mapped'
  const searchParams = useSearchParams()
  const selectedStudentId = searchParams.get('student')
  const requestedBookId = searchParams.get('book')
  const requestedUnitId = searchParams.get('unit')
  const [library, setLibrary] = useState<BookLibraryPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selected, setSelected] = useState<SelectedUnitState | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [numPages, setNumPages] = useState<number | null>(null)
  const [viewerWidth, setViewerWidth] = useState(900)
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null)
  const [pdfReady, setPdfReady] = useState(false)
  /** Book sections expanded in the left sidebar; collapsed by default. */
  const [expandedBookIds, setExpandedBookIds] = useState<Set<string>>(() => new Set())
  /** Unit rows that show their lesson list in the sidebar. */
  const [expandedUnitIds, setExpandedUnitIds] = useState<Set<string>>(() => new Set())
  /** `unitId|lessonId` keys whose part lists are visible. */
  const [expandedLessonKeys, setExpandedLessonKeys] = useState<Set<string>>(() => new Set())
  const [structureWizardOpen, setStructureWizardOpen] = useState(false)
  const [structureWizardTarget, setStructureWizardTarget] = useState<{ bookId: string; filePath: string | null } | null>(null)
  const [readerLessonId, setReaderLessonId] = useState<string | null>(null)
  const [readerPartId, setReaderPartId] = useState<string | null>(null)
  const selectedRef = useRef<SelectedUnitState | null>(null)
  const pageNumberRef = useRef(1)
  const sessionStartedAtRef = useRef<string | null>(null)

  const loadLibrary = useCallback(async (options?: { preserveSelection?: boolean }) => {
    setLoading(true)
    setLoadError(null)
    const preserveSelection = options?.preserveSelection ?? false
    try {
      const response = await fetch('/api/books')
      const payload = (await response.json()) as BookLibraryPayload | { error: string }
      if (!response.ok) {
        const errorMessage = 'error' in payload ? payload.error : 'Failed to load books.'
        throw new Error(errorMessage)
      }
      const resolved = payload as BookLibraryPayload
      setLibrary(resolved)
      const books = resolved.books
      if (preserveSelection) {
        const current = selectedRef.current
        if (!current) return
        const book = books.find((b) => b.id === current.bookId)
        const sameUnit = book?.units.find((u) => u.id === current.unitId)
        if (!book || !sameUnit) return
        const saved = getSavedUnitPage(book.id, sameUnit.id)
        const bounds = getUnitReaderBounds(sameUnit, null, book)
        setSelected({ bookId: book.id, unitId: sameUnit.id })
        setPageNumber(clampPdfPage(saved, bounds))
        return
      }
      const targetBook = requestedBookId
        ? books.find((book) => book.id === requestedBookId) ?? books[0]
        : books[0]
      const targetUnit = requestedUnitId
        ? targetBook?.units.find((unit) => unit.id === requestedUnitId) ?? targetBook?.units[0]
        : targetBook?.units[0]
      if (targetBook && targetUnit) {
        const saved = getSavedUnitPage(targetBook.id, targetUnit.id)
        const bounds = getUnitReaderBounds(targetUnit, null, targetBook)
        setSelected({ bookId: targetBook.id, unitId: targetUnit.id })
        setPageNumber(clampPdfPage(saved, bounds))
        setSessionStartedAt(new Date().toISOString())
        setExpandedUnitIds(new Set([targetUnit.id]))
        setExpandedLessonKeys(new Set())
        setReaderLessonId(null)
        setReaderPartId(null)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load books.'
      setLoadError(message)
    } finally {
      setLoading(false)
    }
  }, [requestedBookId, requestedUnitId])

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
    void loadLibrary()
  }, [loadLibrary])

  useEffect(() => {
    function syncWidth() {
      const target = Math.min(window.innerWidth - 420, 980)
      setViewerWidth(Math.max(320, target))
    }
    syncWidth()
    window.addEventListener('resize', syncWidth)
    return () => window.removeEventListener('resize', syncWidth)
  }, [])

  const selectedBook: BookRecord | null = useMemo(() => {
    if (!library || !selected) return null
    return library.books.find((book) => book.id === selected.bookId) ?? null
  }, [library, selected])

  const selectedUnit: BookUnitRecord | null = useMemo(() => {
    if (!selectedBook || !selected) return null
    return selectedBook.units.find((unit) => unit.id === selected.unitId) ?? null
  }, [selectedBook, selected])

  const readerBreadcrumb = useMemo(() => {
    if (!selectedUnit) return { lesson: null as BookLessonRecord | null, part: null as BookLessonPartRecord | null }
    const lessons = selectedUnit.lessons ?? []
    const lesson = readerLessonId ? (lessons.find((l) => l.id === readerLessonId) ?? null) : null
    const part =
      lesson && readerPartId ? (lesson.parts?.find((p) => p.id === readerPartId) ?? null) : null
    return { lesson, part }
  }, [selectedUnit, readerLessonId, readerPartId])

  const readerBounds = useMemo(
    () =>
      selectedUnit ? getUnitReaderBounds(selectedUnit, numPages, selectedBook ?? undefined) : { min: 1, max: 1 },
    [selectedUnit, numPages, selectedBook],
  )
  const visiblePages = useMemo(
    () => (selectedUnit ? getVisiblePdfPages(selectedUnit, numPages, selectedBook ?? undefined) : []),
    [selectedUnit, numPages, selectedBook],
  )
  const currentSpreadLeftPage = useMemo(() => {
    if (!visiblePages.length) return pageNumber
    const idx = Math.max(0, visiblePages.indexOf(pageNumber))
    return visiblePages[idx] ?? pageNumber
  }, [pageNumber, visiblePages])
  const currentSpreadRightPage = useMemo(() => {
    if (!visiblePages.length) return null
    const idx = Math.max(0, visiblePages.indexOf(currentSpreadLeftPage))
    return visiblePages[idx + 1] ?? null
  }, [currentSpreadLeftPage, visiblePages])

  useEffect(() => {
    selectedRef.current = selected
  }, [selected])

  useEffect(() => {
    pageNumberRef.current = pageNumber
  }, [pageNumber])

  useEffect(() => {
    sessionStartedAtRef.current = sessionStartedAt
  }, [sessionStartedAt])

  function pushSessionHistory(entry: {
    bookId: string
    unitId: string
    page: number
    openedAt: string
    closedAt?: string
  }) {
    if (!selectedStudentId) return
    appendStudentCurriculumSession(selectedStudentId, entry)
  }

  function closeCurrentSession(currentPage: number, options?: { resetState?: boolean }) {
    const currentSelected = selectedRef.current
    const startedAt = sessionStartedAtRef.current
    if (!currentSelected || !startedAt) return
    pushSessionHistory({
      bookId: currentSelected.bookId,
      unitId: currentSelected.unitId,
      page: currentPage,
      openedAt: startedAt,
      closedAt: new Date().toISOString(),
    })
    if (options?.resetState !== false) {
      setSessionStartedAt(null)
    }
  }

  function lessonPartKey(unitId: string, lessonId: string) {
    return `${unitId}|${lessonId}`
  }

  function openUnit(bookId: string, unitId: string, initialPdfPage?: number) {
    closeCurrentSession(pageNumber)
    setReaderLessonId(null)
    setReaderPartId(null)
    const currentSelected = selectedRef.current
    const currentBook = currentSelected ? library?.books.find((b) => b.id === currentSelected.bookId) : null
    const currentUnit = currentSelected ? currentBook?.units.find((u) => u.id === currentSelected.unitId) : null
    const book = library?.books.find((b) => b.id === bookId)
    const unit = book?.units.find((u) => u.id === unitId)
    const saved = getSavedUnitPage(bookId, unitId)
    const bounds = unit ? getUnitReaderBounds(unit, null, book ?? undefined) : { min: 1, max: Number.MAX_SAFE_INTEGER }
    const target = initialPdfPage != null ? initialPdfPage : saved
    const bounded = clampPdfPageToVisible(target, unit ? getVisiblePdfPages(unit, null, book ?? undefined) : [], bounds)
    const fileChanged =
      currentUnit?.filePath != null && unit?.filePath != null
        ? currentUnit.filePath !== unit.filePath
        : true
    setSelected({ bookId, unitId })
    setPageNumber(bounded)
    saveUnitPage(bookId, unitId, bounded)
    if (fileChanged) setNumPages(null)
    setSessionStartedAt(new Date().toISOString())
  }

  function toggleUnitExpanded(unitId: string) {
    setExpandedUnitIds((prev) => {
      const next = new Set(prev)
      if (next.has(unitId)) next.delete(unitId)
      else next.add(unitId)
      return next
    })
  }

  function toggleBookExpanded(bookId: string) {
    setExpandedBookIds((prev) => {
      const next = new Set(prev)
      if (next.has(bookId)) next.delete(bookId)
      else next.add(bookId)
      return next
    })
  }

  function toggleLessonPartsExpanded(unitId: string, lessonId: string) {
    const key = lessonPartKey(unitId, lessonId)
    setExpandedLessonKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function selectLessonForReading(bookId: string, unit: BookUnitRecord, lesson: BookLessonRecord) {
    const book = library?.books.find((b) => b.id === bookId)
    const bounds = getUnitReaderBounds(unit, numPages, book ?? undefined)
    const lessons = unit.lessons ?? []
    const lessonIdx = Math.max(0, lessons.findIndex((l) => l.id === lesson.id))
    const page =
      resolveStartHintWithAlignment(bounds.min, bounds.max, lesson.startPageHint, book, unit, numPages) ??
      lesson.pdfPageRange?.start ??
      estimatePageByIndex(bounds.min, bounds.max, lessonIdx, lessons.length || 1)
    openUnit(bookId, unit.id, page)
    setExpandedBookIds((prev) => new Set(prev).add(bookId))
    setExpandedUnitIds((prev) => new Set(prev).add(unit.id))
    setExpandedLessonKeys((prev) => new Set(prev).add(lessonPartKey(unit.id, lesson.id)))
    setReaderLessonId(lesson.id)
    setReaderPartId(null)
  }

  function selectPartForReading(
    bookId: string,
    unit: BookUnitRecord,
    lesson: BookLessonRecord,
    part: BookLessonPartRecord,
  ) {
    const book = library?.books.find((b) => b.id === bookId)
    const bounds = getUnitReaderBounds(unit, numPages, book ?? undefined)
    const parts = lesson.parts ?? []
    const partIdx = Math.max(0, parts.findIndex((p) => p.id === part.id))
    const lessonPage =
      resolveStartHintWithAlignment(bounds.min, bounds.max, lesson.startPageHint, book, unit, numPages) ??
      lesson.pdfPageRange?.start ??
      estimatePageByIndex(bounds.min, bounds.max, Math.max(0, (unit.lessons ?? []).findIndex((l) => l.id === lesson.id)), (unit.lessons ?? []).length || 1)
    const page =
      resolveStartHintWithAlignment(lessonPage, bounds.max, part.startPageHint, book, unit, numPages) ??
      part.pdfPageRange?.start ??
      (parts.length > 0 ? estimatePageByIndex(lessonPage, bounds.max, partIdx, parts.length) : lessonPage)
    openUnit(bookId, unit.id, page)
    setExpandedBookIds((prev) => new Set(prev).add(bookId))
    setExpandedUnitIds((prev) => new Set(prev).add(unit.id))
    setExpandedLessonKeys((prev) => new Set(prev).add(lessonPartKey(unit.id, lesson.id)))
    setReaderLessonId(lesson.id)
    setReaderPartId(part.id)
  }

  function goToPage(nextPage: number) {
    if (!selected || !selectedUnit) return
    const bounds = getUnitReaderBounds(selectedUnit, numPages, selectedBook ?? undefined)
    const bounded = clampPdfPageToVisible(nextPage, visiblePages, bounds)
    setPageNumber(bounded)
    saveUnitPage(selected.bookId, selected.unitId, bounded)
  }

  function goToNeighborPage(direction: -1 | 1, step = 1) {
    if (!selected || !selectedUnit) return
    if (!visiblePages.length) {
      goToPage(pageNumber + direction * step)
      return
    }
    const currentIndex = Math.max(0, visiblePages.indexOf(pageNumber))
    const nextIndex = Math.max(0, Math.min(currentIndex + direction * step, visiblePages.length - 1))
    const nextPage = visiblePages[nextIndex] ?? pageNumber
    goToPage(nextPage)
  }

  function onDocumentLoadSuccess(meta: { numPages: number }) {
    setNumPages(meta.numPages)
    if (!selected || !selectedUnit) return
    const bounds = getUnitReaderBounds(selectedUnit, meta.numPages, selectedBook ?? undefined)
    const nextVisiblePages = getVisiblePdfPages(selectedUnit, meta.numPages, selectedBook ?? undefined)
    const bounded = clampPdfPageToVisible(pageNumber, nextVisiblePages, bounds)
    if (bounded !== pageNumber) {
      setPageNumber(bounded)
    }
    saveUnitPage(selected.bookId, selected.unitId, bounded)
  }

  function handleManifestSaved(payload: BookLibraryPayload) {
    setLibrary(payload)
    const cur = selectedRef.current
    if (!cur) return
    const book = payload.books.find((b) => b.id === cur.bookId)
    if (!book) return
    const sameUnit = book.units.find((u) => u.id === cur.unitId)
    const nextUnit = sameUnit ?? book.units[0]
    if (!nextUnit) return
    const bounds = getUnitReaderBounds(nextUnit, null, book ?? undefined)
    const saved = getSavedUnitPage(book.id, nextUnit.id)
    setSelected({ bookId: book.id, unitId: nextUnit.id })
    setPageNumber(clampPdfPage(saved, bounds))
    setNumPages(null)
  }

  function openStructureWizardForBook(book: BookRecord) {
    setStructureWizardTarget({ bookId: book.id, filePath: book.units[0]?.filePath ?? null })
    setStructureWizardOpen(true)
  }

  useEffect(() => {
    return () => {
      closeCurrentSession(pageNumberRef.current, { resetState: false })
    }
  }, [])

  if (loading) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-6">
        <p className="text-sm text-muted-foreground">Loading local books...</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-6">
        <p className="text-base font-semibold text-foreground">Could not load books</p>
        <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
      </div>
    )
  }

  const books = library?.books ?? []

  if (books.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-6">
        <p className="text-base font-semibold text-foreground">No units found yet</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Add PDFs under `book-library/BookName/Unit-01.pdf`, or create `book-library/books.json`.
          The template file `books.example.json` is ignored by the app.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Books and units</CardTitle>
          {selectedStudentId ? (
            <p className="text-xs text-muted-foreground">
              Student context active. Session history will be tracked for this student.
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          <BookDropUpload
            onUploadComplete={async () => {
              await loadLibrary({ preserveSelection: true })
            }}
          />
          {library ? (
            <BookStructureWizard
              library={library}
              preferredBookId={structureWizardTarget?.bookId ?? selected?.bookId ?? null}
              preferredFilePath={structureWizardTarget?.filePath ?? selectedUnit?.filePath ?? null}
              onManifestSaved={handleManifestSaved}
              open={structureWizardOpen}
              onOpenChange={(nextOpen) => {
                setStructureWizardOpen(nextOpen)
                if (!nextOpen) setStructureWizardTarget(null)
              }}
            />
          ) : null}
          {books.map((book) => {
            const coverPath = book.units[0]?.filePath
            const coverUrl = coverPath ? makeUnitFileUrl(coverPath) : null
            const mapped = bookHasTocMapping(book)
            const lessonCount = book.units.reduce((sum, unit) => sum + (unit.lessons?.length ?? 0), 0)
            const bookOpen = expandedBookIds.has(book.id)
            return (
            <section key={book.id} className="space-y-2">
              <div className="flex gap-2.5">
                {coverUrl && pdfReady ? (
                  <div className="flex shrink-0 flex-col items-center gap-0.5">
                    <PdfPageThumbnail
                      fileUrl={coverUrl}
                      unitId={`${book.id}-cover`}
                      pageNumber={1}
                      width={56}
                      pdfReady={pdfReady}
                      label="Cover"
                      className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] shadow-sm"
                    />
                    <span className="text-[10px] font-medium text-muted-foreground">Cover</span>
                    {mapped ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-green)]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--brand-green)]">
                        <CheckCircle2 className="h-3 w-3" />
                        Mapped
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-start gap-1">
                        <button
                          type="button"
                          className="mt-0.5 inline-flex shrink-0 items-center justify-center rounded-sm p-0.5 text-muted-foreground transition hover:text-foreground"
                          aria-expanded={bookOpen}
                          aria-label={bookOpen ? `Collapse ${book.title}` : `Expand ${book.title}`}
                          onClick={() => toggleBookExpanded(book.id)}
                        >
                          <ChevronDown
                            className={cn('h-4 w-4 transition-transform', !bookOpen && '-rotate-90')}
                          />
                        </button>
                        <h3 className="text-sm font-semibold leading-tight text-foreground">{book.title}</h3>
                      </div>
                      {mapped ? (
                        <p className="mt-0.5 text-[11px] font-medium text-[var(--brand-green)]">
                          Structure mapped · {book.units.length} unit{book.units.length === 1 ? '' : 's'} · {lessonCount} lesson{lessonCount === 1 ? '' : 's'}
                        </p>
                      ) : (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">Structure not mapped yet</p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant={mapped ? 'outline' : 'secondary'}
                      size="sm"
                      className="h-7 shrink-0 px-2 text-xs"
                      onClick={() => openStructureWizardForBook(book)}
                    >
                      {mapped ? 'View/Edit' : 'Map'}
                    </Button>
                  </div>
                  {book.description ? (
                    <p className="text-xs text-muted-foreground">{book.description}</p>
                  ) : null}
                </div>
              </div>
              {bookOpen ? (
              <div className="space-y-1">
                {book.units.map((unit) => {
                  const active = selected?.bookId === book.id && selected?.unitId === unit.id
                  const resumePage = getSavedUnitPage(book.id, unit.id)
                  const unitOpen = expandedUnitIds.has(unit.id)
                  const lessons = unit.lessons ?? []
                  const unitStart = unit.startPageHint ?? unit.pdfPageRange?.start ?? 1
                  const contentStart = unit.pdfContentStart ?? unitStart
                  const coverPages = Math.max(0, contentStart - unitStart)
                  const unitCoverUrl = makeUnitFileUrl(unit.filePath)
                  return (
                    <div
                      key={unit.id}
                      className={cn(
                        'overflow-hidden rounded-lg border text-left transition-colors',
                        active
                          ? 'border-[var(--brand-blue)] bg-[var(--brand-blue)]/10'
                          : 'border-[var(--border)] bg-[var(--surface-2)]',
                      )}
                    >
                      <div className="flex items-stretch gap-0">
                        {pdfReady ? (
                          <div className="flex w-12 shrink-0 flex-col items-center justify-center border-r border-[var(--border)]/70 bg-background/40 px-1 py-1">
                            <PdfPageThumbnail
                              fileUrl={unitCoverUrl}
                              unitId={`${unit.id}-cover`}
                              pageNumber={unitStart}
                              width={36}
                              pdfReady={pdfReady}
                              label="Unit cover"
                              className="rounded-sm border border-[var(--border)]/70"
                            />
                            <span className="mt-0.5 text-[9px] text-muted-foreground">Cover</span>
                          </div>
                        ) : null}
                        <button
                          type="button"
                          className="flex shrink-0 items-center justify-center px-1.5 text-muted-foreground hover:text-foreground"
                          aria-expanded={unitOpen}
                          aria-label={unitOpen ? 'Hide lessons' : 'Show lessons'}
                          onClick={() => toggleUnitExpanded(unit.id)}
                        >
                          <ChevronDown
                            className={cn('h-4 w-4 transition-transform', unitOpen && 'rotate-180')}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            openUnit(book.id, unit.id)
                            setExpandedBookIds((prev) => new Set(prev).add(book.id))
                            setExpandedUnitIds((prev) => new Set(prev).add(unit.id))
                          }}
                          className={cn(
                            'min-w-0 flex-1 px-2 py-2 text-left text-sm transition-colors',
                            active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                          )}
                        >
                          <span className="block font-medium">{unit.title}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            Open · saved page {resumePage}
                          </span>
                          {coverPages > 0 ? (
                            <span className="mt-0.5 block text-[11px] text-muted-foreground">
                              {coverPages} cover page{coverPages === 1 ? '' : 's'} before Lesson 1
                            </span>
                          ) : null}
                        </button>
                      </div>
                      {unitOpen ? (
                        <div className="border-t border-[var(--border)] bg-background/30 px-1 py-1">
                          {lessons.length === 0 ? (
                            <p className="px-2 py-1.5 text-xs text-muted-foreground">
                              No lessons mapped for this unit. Use “Map units from TOC” to add an outline.
                            </p>
                          ) : (
                            <ul className="space-y-0.5">
                              {lessons.map((lesson, lessonIndex) => {
                                const lk = lessonPartKey(unit.id, lesson.id)
                                const partsOpen = expandedLessonKeys.has(lk)
                                const parts = lesson.parts ?? []
                                const lessonRange = pageRangeForIndex(lessons, lessonIndex)
                                return (
                                  <li key={lesson.id} className="rounded-md">
                                    <div className="flex items-start gap-0">
                                      <button
                                        type="button"
                                        className={cn(
                                          'mt-0.5 flex shrink-0 items-center justify-center p-1 text-muted-foreground hover:text-foreground',
                                          parts.length === 0 && 'pointer-events-none opacity-25',
                                        )}
                                        aria-expanded={partsOpen}
                                        aria-label={partsOpen ? 'Hide parts' : 'Show parts'}
                                        disabled={parts.length === 0}
                                        onClick={() => toggleLessonPartsExpanded(unit.id, lesson.id)}
                                      >
                                        <ChevronDown
                                          className={cn(
                                            'h-3.5 w-3.5 transition-transform',
                                            partsOpen && 'rotate-180',
                                          )}
                                        />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => selectLessonForReading(book.id, unit, lesson)}
                                        className={cn(
                                          'min-w-0 flex-1 rounded px-1.5 py-1 text-left text-xs leading-snug transition-colors',
                                          active &&
                                            readerLessonId === lesson.id &&
                                            readerPartId == null
                                            ? 'bg-[var(--brand-blue)]/20 font-medium text-foreground'
                                            : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
                                        )}
                                      >
                                        <span className="inline-flex min-w-0 items-center gap-1.5">
                                          <span className="truncate">{lesson.title || 'Lesson'}</span>
                                          <span className="shrink-0 rounded bg-background/70 px-1 py-0.5 text-[10px] font-medium text-muted-foreground">
                                            {formatPageSpan(lessonRange.start, lessonRange.end, book, unit, numPages, numberingMode)}
                                          </span>
                                        </span>
                                      </button>
                                    </div>
                                    {partsOpen && parts.length > 0 ? (
                                      <ul className="ml-5 border-l border-[var(--border)]/80 py-0.5 pl-2">
                                        {parts.map((part, partIndex) => {
                                          const partRange = pageRangeForIndex(parts, partIndex, lessonRange.start, lessonRange.end)
                                          return (
                                          <li key={part.id}>
                                            <button
                                              type="button"
                                              onClick={() => selectPartForReading(book.id, unit, lesson, part)}
                                              className={cn(
                                                'w-full rounded px-1.5 py-1 text-left text-[11px] leading-snug transition-colors',
                                                active && readerPartId === part.id
                                                  ? 'bg-[var(--brand-blue)]/20 font-medium text-foreground'
                                                  : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
                                              )}
                                            >
                                              <span className="inline-flex min-w-0 items-center gap-1.5">
                                                <span className="truncate">{part.title || 'Part'}</span>
                                                <span className="shrink-0 rounded bg-background/70 px-1 py-0.5 text-[10px] font-medium text-muted-foreground">
                                                  {formatPageSpan(partRange.start, partRange.end, book, unit, numPages, numberingMode)}
                                                </span>
                                              </span>
                                            </button>
                                          </li>
                                          )
                                        })}
                                      </ul>
                                    ) : null}
                                  </li>
                                )
                              })}
                            </ul>
                          )}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
              ) : null}
            </section>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base leading-snug">
            <span className="block">
              {selectedBook?.title ?? 'Book'}
              {selectedUnit ? ` — ${selectedUnit.title}` : ''}
            </span>
            {readerBreadcrumb.lesson ? (
              <span className="mt-0.5 block text-sm font-normal text-muted-foreground">
                {readerBreadcrumb.lesson.title}
                {readerBreadcrumb.part ? ` — ${readerBreadcrumb.part.title}` : ''}
              </span>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {selectedUnit ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                      onClick={() => goToNeighborPage(-1, 2)}
                      disabled={!visiblePages.length || currentSpreadLeftPage === (visiblePages[0] ?? currentSpreadLeftPage)}
                >
                  <ChevronLeft size={16} />
                  Prev
                </Button>
                <Button
                  type="button"
                  variant="outline"
                      onClick={() => goToNeighborPage(1, 2)}
                      disabled={!visiblePages.length || currentSpreadRightPage == null}
                >
                  Next
                  <ChevronRight size={16} />
                </Button>
                <span className="text-sm text-muted-foreground">
                  PDF page {currentSpreadRightPage != null ? `${currentSpreadLeftPage}-${currentSpreadRightPage}` : `${currentSpreadLeftPage}`}
                  {numPages != null ? ` / ${numPages}` : ''}
                </span>
              </div>

              <div className="overflow-auto rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-2">
                {pdfReady ? (
                  <PdfDocument
                    file={makeUnitFileUrl(selectedUnit.filePath)}
                    options={PDF_DOCUMENT_OPTIONS}
                    onLoadSuccess={onDocumentLoadSuccess}
                    loading={<p className="p-6 text-sm text-muted-foreground">Loading PDF...</p>}
                    error={<p className="p-6 text-sm text-[var(--brand-red)]">Could not open this PDF unit.</p>}
                  >
                    <div className="grid gap-2 xl:grid-cols-2">
                      <PdfPage
                        pageNumber={currentSpreadLeftPage}
                        width={Math.max(320, Math.floor(viewerWidth / 2) - 8)}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                      />
                      {currentSpreadRightPage != null ? (
                        <PdfPage
                          pageNumber={currentSpreadRightPage}
                          width={Math.max(320, Math.floor(viewerWidth / 2) - 8)}
                          renderTextLayer={false}
                          renderAnnotationLayer={false}
                        />
                      ) : null}
                    </div>
                  </PdfDocument>
                ) : (
                  <p className="p-6 text-sm text-muted-foreground">Preparing PDF viewer...</p>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Select a unit to start reading.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

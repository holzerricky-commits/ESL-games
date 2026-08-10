'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  formatEffectivePageSpan,
  mapPdfPageToDisplayLabel,
  mapPdfSpreadToDisplayLabel,
  resolveMappedPageToPdfPage,
} from '@/lib/books/page-numbering'
import { clampPdfPageToVisible, getUnitReaderBounds, getVisiblePdfPages } from '@/lib/books/page-range'
import type { BookLibraryPayload, BookRecord } from '@/lib/books/types'
import {
  getStudentSectionOptions,
  getStudentTeachingOpenPdfPageForBookUnit,
  resolveStudentSectionAtMappedBookPage,
  updateStudentCurriculumBookStart,
} from '@/lib/students/selectors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const PdfDocument = dynamic(() => import('react-pdf').then((mod) => mod.Document), { ssr: false })
const PdfPage = dynamic(() => import('react-pdf').then((mod) => mod.Page), { ssr: false })
const PDF_DOCUMENT_OPTIONS = { wasmUrl: '/wasm/' } as const
const SPREAD_PAGE_WIDTH = 320

function makeUnitFileUrl(filePath: string): string {
  return `/api/book-file?path=${encodeURIComponent(filePath)}`
}

function parseMappedPage(value: string): number | null {
  const n = Math.floor(Number(value.trim()))
  return Number.isFinite(n) && n >= 1 ? n : null
}

function resolveInitialUnitId(
  book: BookRecord,
  library: BookLibraryPayload,
  studentId: string,
  initialUnitId: string | undefined,
  initialPage: number | undefined,
): string {
  const units = book.units ?? []
  if (initialPage != null) {
    const section = resolveStudentSectionAtMappedBookPage(studentId, library, book.id, initialPage)
    if (section?.unitId) return section.unitId
  }
  if (initialUnitId && units.some((u) => u.id === initialUnitId)) return initialUnitId
  return units[0]?.id ?? ''
}

export interface StudentCurriculumBookPreviewProps {
  book: BookRecord
  library: BookLibraryPayload
  studentId: string
  pdfReady: boolean
  /** Book / mapped page (not raw PDF index). */
  initialUnitId?: string
  initialPage?: number
  onClose: () => void
  onStartSaved?: () => void
}

export function StudentCurriculumBookPreview({
  book,
  library,
  studentId,
  pdfReady,
  initialUnitId,
  initialPage,
  onClose,
  onStartSaved,
}: StudentCurriculumBookPreviewProps) {
  const units = book.units ?? []
  const [unitId, setUnitId] = useState(() =>
    resolveInitialUnitId(book, library, studentId, initialUnitId, initialPage),
  )
  const [pageNumber, setPageNumber] = useState(1)
  const [numPagesByUnit, setNumPagesByUnit] = useState<Record<string, number>>({})
  const [pageInput, setPageInput] = useState('1')
  const [isSavingStart, setIsSavingStart] = useState(false)
  const [showBrowseList, setShowBrowseList] = useState(false)
  const [browsePick, setBrowsePick] = useState('')
  const windowScrollYRef = useRef(0)
  const initialMappedPageRef = useRef(initialPage)
  const pendingMappedPageRef = useRef<number | undefined>(initialPage)
  const pendingBoundaryNavRef = useRef<'first' | 'last' | null>(null)

  useEffect(() => {
    initialMappedPageRef.current = initialPage
    if (initialPage != null) {
      const section = resolveStudentSectionAtMappedBookPage(studentId, library, book.id, initialPage)
      if (section?.unitId) {
        setUnitId(section.unitId)
        pendingMappedPageRef.current = initialPage
      }
    }
  }, [initialPage, studentId, library, book.id])

  const unit = units.find((u) => u.id === unitId) ?? units[0] ?? null
  const numPages = unit ? (numPagesByUnit[unit.id] ?? null) : null
  const fileUrl = unit ? makeUnitFileUrl(unit.filePath) : null

  const bounds = useMemo(
    () => (unit ? getUnitReaderBounds(unit, numPages, book) : { min: 1, max: 1 }),
    [unit, numPages, book],
  )

  const visiblePages = useMemo(
    () => (unit ? getVisiblePdfPages(unit, numPages, book) : []),
    [unit, numPages, book],
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

  const browseOptions = useMemo(() => {
    return getStudentSectionOptions(studentId, library).filter((o) => o.bookId === book.id)
  }, [studentId, library, book.id])

  const bookPageTotal = useMemo(() => {
    let max = 0
    for (const o of browseOptions) {
      const end = o.endPageHint ?? o.startPageHint
      if (typeof end === 'number' && Number.isFinite(end)) {
        max = Math.max(max, Math.floor(end))
      }
    }
    for (const u of units) {
      const pages = numPagesByUnit[u.id]
      if (pages == null || pages < 1) continue
      const label = mapPdfPageToDisplayLabel(pages, book, u, pages, 'mapped')
      const n = parseMappedPage(label)
      if (n != null) max = Math.max(max, n)
      else max = Math.max(max, pages)
    }
    return Math.max(1, max)
  }, [browseOptions, units, numPagesByUnit, book])

  const unitIndex = units.findIndex((u) => u.id === unitId)
  const hasPrevUnit = unitIndex > 0
  const hasNextUnit = unitIndex >= 0 && unitIndex < units.length - 1

  const mappedInputForPdf = useCallback(
    (pdfPage: number, forUnit = unit) => {
      if (!forUnit || numPages == null) return String(pdfPage)
      const pages = numPagesByUnit[forUnit.id]
      return mapPdfPageToDisplayLabel(pdfPage, book, forUnit, pages ?? numPages, 'mapped')
    },
    [book, unit, numPages, numPagesByUnit],
  )

  const goToPage = useCallback(
    (targetPdf: number) => {
      windowScrollYRef.current = window.scrollY
      const next = clampPdfPageToVisible(targetPdf, visiblePages, bounds)
      setPageNumber(next)
      setPageInput(mappedInputForPdf(next))
    },
    [visiblePages, bounds, mappedInputForPdf],
  )

  const switchToUnit = useCallback(
    (nextUnitId: string, opts?: { mappedPage?: number; boundary?: 'first' | 'last' }) => {
      windowScrollYRef.current = window.scrollY
      pendingMappedPageRef.current = opts?.mappedPage
      pendingBoundaryNavRef.current = opts?.boundary ?? null
      setUnitId(nextUnitId)
    },
    [],
  )

  const goToMappedBookPage = useCallback(
    (mappedPage: number) => {
      const section = resolveStudentSectionAtMappedBookPage(studentId, library, book.id, mappedPage)
      const targetUnitId = section?.unitId ?? unitId
      const targetUnit = units.find((u) => u.id === targetUnitId) ?? unit
      if (!targetUnit) return

      if (targetUnit.id !== unitId) {
        switchToUnit(targetUnit.id, { mappedPage })
        return
      }

      const pages = numPagesByUnit[targetUnit.id] ?? numPages
      if (pages == null) {
        pendingMappedPageRef.current = mappedPage
        return
      }
      const pdf = resolveMappedPageToPdfPage(mappedPage, book, targetUnit, pages) ?? mappedPage
      goToPage(pdf)
    },
    [studentId, library, book, unitId, unit, units, numPagesByUnit, numPages, switchToUnit, goToPage],
  )

  useLayoutEffect(() => {
    window.scrollTo({ top: windowScrollYRef.current, left: 0, behavior: 'instant' })
  }, [pageNumber, unitId])

  function onDocumentLoadSuccess(meta: { numPages: number }) {
    if (!unit) return
    setNumPagesByUnit((prev) => ({ ...prev, [unit.id]: meta.numPages }))

    const b = getUnitReaderBounds(unit, meta.numPages, book)
    const vis = getVisiblePdfPages(unit, meta.numPages, book)

    let targetPdf: number

    const pendingMapped = pendingMappedPageRef.current
    if (pendingMapped != null) {
      pendingMappedPageRef.current = undefined
      targetPdf = resolveMappedPageToPdfPage(pendingMapped, book, unit, meta.numPages) ?? pendingMapped
    } else if (pendingBoundaryNavRef.current === 'first') {
      pendingBoundaryNavRef.current = null
      targetPdf = vis[0] ?? b.min
    } else if (pendingBoundaryNavRef.current === 'last') {
      pendingBoundaryNavRef.current = null
      const last = vis[vis.length - 1] ?? b.max
      const prevIdx = Math.max(0, vis.indexOf(last) - 1)
      targetPdf = vis[prevIdx] ?? last
    } else {
      const mappedStart = initialMappedPageRef.current
      if (mappedStart != null) {
        targetPdf = resolveMappedPageToPdfPage(mappedStart, book, unit, meta.numPages) ?? mappedStart
        initialMappedPageRef.current = undefined
      } else {
        const resume = getStudentTeachingOpenPdfPageForBookUnit(studentId, book.id, unit.id, library, meta.numPages)
        if (resume != null) {
          targetPdf = resume
        } else {
          targetPdf = b.min
        }
      }
    }

    const clamped = clampPdfPageToVisible(targetPdf, vis, b)
    setPageNumber(clamped)
    setPageInput(mapPdfPageToDisplayLabel(clamped, book, unit, meta.numPages, 'mapped'))
  }

  const spreadLabel = unit
    ? mapPdfSpreadToDisplayLabel(
        currentSpreadLeftPage,
        currentSpreadRightPage,
        book,
        unit,
        numPages,
        'mapped',
      )
    : String(currentSpreadLeftPage)

  const atStartOfUnit =
    visiblePages.length > 0
      ? currentSpreadLeftPage <= visiblePages[0]!
      : pageNumber <= bounds.min

  const atEndOfUnit =
    visiblePages.length > 0
      ? currentSpreadRightPage == null &&
        currentSpreadLeftPage >= visiblePages[visiblePages.length - 1]!
      : numPages != null
        ? pageNumber >= bounds.max
        : false

  const atFirst = atStartOfUnit && !hasPrevUnit
  const atLast = atEndOfUnit && !hasNextUnit

  const goToNeighbor = useCallback(
    (direction: -1 | 1) => {
      windowScrollYRef.current = window.scrollY
      const step = 2

      if (direction === 1 && atEndOfUnit && hasNextUnit) {
        const nextUnit = units[unitIndex + 1]
        if (nextUnit) switchToUnit(nextUnit.id, { boundary: 'first' })
        return
      }

      if (direction === -1 && atStartOfUnit && hasPrevUnit) {
        const prevUnit = units[unitIndex - 1]
        if (prevUnit) switchToUnit(prevUnit.id, { boundary: 'last' })
        return
      }

      if (!visiblePages.length) {
        goToPage(pageNumber + direction * step)
        return
      }
      const currentIndex = Math.max(0, visiblePages.indexOf(pageNumber))
      const nextIndex = Math.max(0, Math.min(currentIndex + direction * step, visiblePages.length - 1))
      goToPage(visiblePages[nextIndex] ?? pageNumber)
    },
    [
      atEndOfUnit,
      atStartOfUnit,
      hasNextUnit,
      hasPrevUnit,
      units,
      unitIndex,
      switchToUnit,
      visiblePages,
      goToPage,
      pageNumber,
    ],
  )

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
      const target = event.target
      if (target instanceof HTMLElement) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
          return
        }
      }
      if (event.key === 'ArrowLeft') {
        if (atFirst) return
        event.preventDefault()
        goToNeighbor(-1)
        return
      }
      if (event.key === 'ArrowRight') {
        if (atLast) return
        event.preventDefault()
        goToNeighbor(1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [atFirst, atLast, goToNeighbor])

  function commitPageInput() {
    const parsed = parseMappedPage(pageInput)
    if (parsed == null) {
      setPageInput(mappedInputForPdf(pageNumber))
      return
    }
    goToMappedBookPage(parsed)
  }

  function preventNavFocusScroll(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
  }

  function mappedCandidatesForSave(): number[] {
    const out: number[] = []
    const add = (n: number | null) => {
      if (n != null && !out.includes(n)) out.push(n)
    }

    const leftLabel = mappedInputForPdf(currentSpreadLeftPage)
    if (leftLabel !== '·') add(parseMappedPage(leftLabel))

    if (currentSpreadRightPage != null) {
      const rightLabel = mappedInputForPdf(currentSpreadRightPage)
      if (rightLabel !== '·') add(parseMappedPage(rightLabel))
    }

    add(parseMappedPage(pageInput))
    return out
  }

  async function saveAsStart() {
    if (!unit) return
    const candidates = mappedCandidatesForSave()
    if (!candidates.length) {
      toast.error('This page is not in the lesson map. Try another page or pick from the list.')
      return
    }

    setIsSavingStart(true)
    try {
      let section = null
      let mappedPage: number | null = null
      for (const candidate of candidates) {
        section = resolveStudentSectionAtMappedBookPage(studentId, library, book.id, candidate)
        if (section) {
          mappedPage = candidate
          break
        }
      }
      if (!section || mappedPage == null) {
        toast.error('No lesson matches this page. Try another page or pick from the list.')
        return
      }
      const result = updateStudentCurriculumBookStart(
        studentId,
        { bookId: book.id, sectionId: section.id, mappedPage },
        library,
      )
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Starting place saved for this book.')
      setShowBrowseList(false)
      onStartSaved?.()
    } finally {
      setIsSavingStart(false)
    }
  }

  async function saveBrowsePick() {
    const id = browsePick.trim()
    if (!id) return
    setIsSavingStart(true)
    try {
      const section = browseOptions.find((o) => o.id === id)
      if (!section) {
        toast.error('Pick a lesson from the list.')
        return
      }
      const result = updateStudentCurriculumBookStart(
        studentId,
        {
          bookId: book.id,
          sectionId: section.id,
          mappedPage: section.startPageHint ?? null,
        },
        library,
      )
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Starting place saved for this book.')
      setShowBrowseList(false)
      onStartSaved?.()
    } finally {
      setIsSavingStart(false)
    }
  }

  const pageTotalLabel = String(bookPageTotal)

  return (
    <div className="border-t border-[var(--border)] bg-[var(--surface-2)]/40">
      <div className="sticky top-0 z-10 space-y-2 border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={atFirst}
            onMouseDown={preventNavFocusScroll}
            onClick={() => goToNeighbor(-1)}
            aria-label="Previous pages"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={atLast}
            onMouseDown={preventNavFocusScroll}
            onClick={() => goToNeighbor(1)}
            aria-label="Next pages"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
            <Input
              type="number"
              min={1}
              max={bookPageTotal}
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commitPageInput()
                }
              }}
              onBlur={commitPageInput}
              className="h-8 w-14 px-1.5 text-center text-xs tabular-nums text-foreground"
              aria-label="Book page number"
            />
            <span aria-hidden>/</span>
            <span className="min-w-[1.5rem]" title="Total book pages">
              {pageTotalLabel}
            </span>
          </div>

          <span className="sr-only">
            Viewing {spreadLabel} of {pageTotalLabel}
          </span>

          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => setShowBrowseList((v) => !v)}
            >
              {showBrowseList ? 'Hide list' : 'List'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 text-xs"
              disabled={isSavingStart || !unit}
              onClick={() => void saveAsStart()}
            >
              {isSavingStart ? 'Saving…' : 'Save start'}
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close preview">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {showBrowseList ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-foreground"
              value={browsePick}
              onChange={(e) => setBrowsePick(e.target.value)}
            >
              <option value="">Pick a lesson…</option>
              {browseOptions.map((o) => {
                const u = book.units.find((un) => un.id === o.unitId)
                const unitPages = u ? numPagesByUnit[u.id] : null
                const span =
                  u && typeof o.startPageHint === 'number'
                    ? formatEffectivePageSpan(
                        o.startPageHint,
                        o.endPageHint ?? null,
                        book,
                        u,
                        unitPages,
                        'mapped',
                      )
                    : ''
                const suffix = span && span !== 'pages —' && !span.startsWith('pages —') ? ` · ${span}` : ''
                return (
                  <option key={o.id} value={o.id}>
                    {o.pathLabel}
                    {suffix}
                  </option>
                )
              })}
            </select>
            <Button
              type="button"
              size="sm"
              onClick={() => void saveBrowsePick()}
              disabled={!browsePick.trim() || isSavingStart}
            >
              Save start
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex justify-center p-4">
        {!pdfReady ? (
          <p className="py-12 text-sm text-muted-foreground">Loading…</p>
        ) : !unit || !fileUrl ? (
          <p className="py-12 text-sm text-muted-foreground">No pages for this book.</p>
        ) : (
          <div
            className="w-full max-w-[680px] rounded-lg border border-[var(--border)] bg-background p-2 shadow-sm"
            style={{ minHeight: Math.round(SPREAD_PAGE_WIDTH * 1.414) + 16 }}
          >
            <PdfDocument
              key={`${book.id}-${unit.id}`}
              file={fileUrl}
              options={PDF_DOCUMENT_OPTIONS}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={<p className="p-8 text-sm text-muted-foreground">Opening…</p>}
              error={<p className="p-8 text-sm text-[var(--brand-red)]">Could not open this PDF.</p>}
            >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <PdfPage
                  pageNumber={currentSpreadLeftPage}
                  width={SPREAD_PAGE_WIDTH}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
                {currentSpreadRightPage != null ? (
                  <PdfPage
                    pageNumber={currentSpreadRightPage}
                    width={SPREAD_PAGE_WIDTH}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />
                ) : (
                  <div className="hidden min-h-[452px] sm:block" aria-hidden />
                )}
              </div>
            </PdfDocument>
          </div>
        )}
      </div>
    </div>
  )
}

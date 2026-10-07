'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { BookPartCheckPinOverlay } from '@/components/books/book-part-check-pin-overlay'
import { Button } from '@/components/ui/button'
import { useReadingCheckHotspotPlacement } from '@/components/students/fullscreen-book-overlay/hooks/useReadingCheckHotspotPlacement'
import {
  dispatchReadingCheckHotspotPlaceResult,
} from '@/lib/books/reading-check-hotspot-placement-events'
import {
  listReadingCheckLivePinsOnSpread,
  type ReadingCheckStop,
} from '@/lib/books/reading-check-pack'
import { mapPdfPageToDisplayLabel, mapPdfSpreadToDisplayLabel } from '@/lib/books/page-numbering'
import {
  isOutlineSinglePageRange,
  resolveOutlinePrintedPdfRange,
} from '@/lib/books/story-thumb-pdf-page'
import type { BookRecord, BookUnitRecord } from '@/lib/books/types'
import { cn } from '@/lib/utils'

const PdfDocument = dynamic(() => import('react-pdf').then((mod) => mod.Document), { ssr: false })
const PdfPage = dynamic(() => import('react-pdf').then((mod) => mod.Page), { ssr: false })
const PDF_DOCUMENT_OPTIONS = { wasmUrl: '/wasm/' } as const

const FILL_WIDTH_MIN_PAGE = 140

function parseDisplayPage(label: string | null | undefined): number | null {
  if (!label) return null
  const trimmed = label.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const n = Number(trimmed)
  return Number.isFinite(n) && n >= 1 ? n : null
}

function spreadLeftForPdf(
  pdfPage: number,
  startPdf: number,
  endPdf: number,
  singlePage: boolean,
): number {
  if (singlePage) return startPdf
  const clamped = Math.min(endPdf, Math.max(startPdf, Math.floor(pdfPage)))
  const left = startPdf + Math.floor((clamped - startPdf) / 2) * 2
  const maxLeft = Math.max(startPdf, endPdf - 1)
  return Math.min(maxLeft, Math.max(startPdf, left))
}

export interface BookPartLiveSpreadPreviewProps {
  fileUrl: string
  unitId: string
  book: BookRecord
  unit: BookUnitRecord
  pdfReady: boolean
  totalPdfPages: number | null
  /** Printed / display page range for this part. */
  printedStart: number | null
  printedEnd: number | null
  onPdfNumPages?: (numPages: number) => void
  /**
   * When set, loads this URL instead of `fileUrl` (e.g. searchable sidecar).
   * Remounts the document when it changes.
   */
  documentUrl?: string | null
  /** Enable react-pdf text layer so words can be selected (after Make selectable). */
  enableTextLayer?: boolean
  className?: string
  /** When Checks is the active desk job: pins + click-to-place on this spread. */
  checksPlacement?: {
    storyId: string
    bookId: string
    unitId: string
    stops: ReadingCheckStop[]
    activeStopId: string | null
    onSelectStop?: (stopId: string) => void
  } | null
  /** Jump the spread to this PDF page (active check). */
  focusPdfPage?: number | null
}

/**
 * Live react-pdf spread for the part prep desk (right panel).
 * Clamped to the part page range; turn by two like the outline thumb preview.
 */
export function BookPartLiveSpreadPreview({
  fileUrl,
  unitId,
  book,
  unit,
  pdfReady,
  totalPdfPages,
  printedStart,
  printedEnd,
  onPdfNumPages,
  documentUrl = null,
  enableTextLayer = false,
  className,
  checksPlacement = null,
  focusPdfPage = null,
}: BookPartLiveSpreadPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pageWidth, setPageWidth] = useState(FILL_WIDTH_MIN_PAGE)
  const activeFileUrl = documentUrl?.trim() || fileUrl

  const pdfRange = useMemo(
    () => resolveOutlinePrintedPdfRange(printedStart, printedEnd, book, unit, totalPdfPages),
    [printedStart, printedEnd, book, unit, totalPdfPages],
  )
  const singlePage = isOutlineSinglePageRange(printedStart, printedEnd)

  const startPdf = pdfRange?.startPdf ?? 1
  const endPdf = pdfRange?.endPdf ?? startPdf
  const mappingReady = totalPdfPages != null && totalPdfPages >= 1 && printedStart != null
  const showNav = !singlePage && endPdf > startPdf

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => {
      const containerWidth = el.clientWidth
      if (containerWidth <= 0) return
      const pageCount = singlePage ? 1 : 2
      const gap = checksPlacement ? 0 : 8
      const available = containerWidth - gap * (pageCount - 1)
      const perPage = Math.floor(available / pageCount)
      setPageWidth(Math.max(FILL_WIDTH_MIN_PAGE, perPage))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [singlePage, checksPlacement])

  const [leftPdf, setLeftPdf] = useState(startPdf)

  useEffect(() => {
    setLeftPdf(startPdf)
  }, [startPdf, endPdf, unitId, activeFileUrl])

  useEffect(() => {
    if (focusPdfPage == null || !Number.isFinite(focusPdfPage)) return
    setLeftPdf(spreadLeftForPdf(focusPdfPage, startPdf, endPdf, singlePage))
  }, [focusPdfPage, startPdf, endPdf, singlePage])

  const rightPdf = singlePage ? null : Math.min(leftPdf + 1, endPdf)
  const leftDisplayPage = parseDisplayPage(
    mapPdfPageToDisplayLabel(leftPdf, book, unit, totalPdfPages, 'mapped'),
  )
  const rightDisplayPage =
    rightPdf != null
      ? parseDisplayPage(mapPdfPageToDisplayLabel(rightPdf, book, unit, totalPdfPages, 'mapped'))
      : null
  const counterLabel = useMemo(
    () => mapPdfSpreadToDisplayLabel(leftPdf, rightPdf, book, unit, totalPdfPages, 'mapped'),
    [leftPdf, rightPdf, book, unit, totalPdfPages],
  )

  const checksEnabled = Boolean(checksPlacement)
  const {
    readingCheckHotspotPlacementActive,
    placeReadingCheckHotspotAt,
  } = useReadingCheckHotspotPlacement({
    enabled: checksEnabled,
    bookId: checksPlacement?.bookId ?? null,
    unitId: checksPlacement?.unitId ?? null,
    selectedBook: book,
    selectedUnit: unit,
    totalPdfPages,
    leftPdfPage: leftPdf,
    rightPdfPage: rightPdf,
    minimizeWhiteboard: () => undefined,
  })

  const livePins = useMemo(() => {
    if (!checksPlacement) return []
    return listReadingCheckLivePinsOnSpread(checksPlacement.stops, {
      leftPdfPage: leftPdf,
      rightPdfPage: rightPdf,
      leftDisplayPage,
      rightDisplayPage,
    })
  }, [checksPlacement, leftDisplayPage, leftPdf, rightDisplayPage, rightPdf])

  const emitPinMove = useCallback(
    (stopId: string, pdfPage: number, center: [number, number], pageSide: 'left' | 'right') => {
      if (!checksPlacement) return
      const displayLabel = mapPdfPageToDisplayLabel(pdfPage, book, unit, totalPdfPages, 'mapped')
      dispatchReadingCheckHotspotPlaceResult({
        stopId,
        storyId: checksPlacement.storyId,
        bookId: checksPlacement.bookId,
        unitId: checksPlacement.unitId,
        pdfPage,
        x: center[0],
        y: center[1],
        pageSide,
        displayPage: parseDisplayPage(displayLabel),
      })
    },
    [book, checksPlacement, totalPdfPages, unit],
  )

  const handlePlace = useCallback(
    (pdfPage: number, center: [number, number], _pageSide: 'left' | 'right') => {
      placeReadingCheckHotspotAt(pdfPage, center)
    },
    [placeReadingCheckHotspotAt],
  )

  function goPrev() {
    setLeftPdf((p) => Math.max(startPdf, p - 2))
  }

  function goNext() {
    const maxLeft = singlePage ? startPdf : Math.max(startPdf, endPdf - 1)
    setLeftPdf((p) => Math.min(maxLeft, p + 2))
  }

  const canPrev = showNav && leftPdf > startPdf
  const canNext = showNav && !singlePage && leftPdf < Math.max(startPdf, endPdf - 1)

  const pageClass = cn(
    'relative rounded-2xl bg-white shadow-[0_16px_40px_-20px_rgba(0,0,0,0.35)]',
    enableTextLayer && !checksEnabled ? 'overflow-visible' : 'overflow-hidden',
  )

  function renderPage(pageNumber: number, pageSide: 'left' | 'right', extraClass?: string) {
    return (
      <div className={cn('min-w-0', pageClass, extraClass)} style={{ width: pageWidth }}>
        <PdfPage
          pageNumber={pageNumber}
          width={pageWidth}
          renderTextLayer={enableTextLayer && !readingCheckHotspotPlacementActive}
          renderAnnotationLayer={false}
          className={enableTextLayer && !checksEnabled ? 'select-text' : undefined}
        />
        {checksPlacement ? (
          <BookPartCheckPinOverlay
            pdfPage={pageNumber}
            pageSide={pageSide}
            placementActive={readingCheckHotspotPlacementActive}
            livePins={livePins}
            activeStopId={checksPlacement.activeStopId}
            onPlace={handlePlace}
            onMovePin={emitPinMove}
            onSelectStop={checksPlacement.onSelectStop}
          />
        ) : null}
      </div>
    )
  }

  if (!pdfReady) {
    return (
      <div
        className={cn(
          'flex min-h-[320px] w-full items-center justify-center rounded-[28px] bg-[var(--surface-2)] text-sm text-muted-foreground',
          className,
        )}
      >
        Loading PDF tools…
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative flex w-full flex-col items-center gap-4 rounded-[28px] bg-[var(--surface-2)] p-4 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.2)] sm:p-6',
        className,
      )}
    >
      {!mappingReady ? (
        <div
          className="flex w-full items-center justify-center rounded-2xl bg-[var(--surface-3)] px-2 text-center text-[13px] text-muted-foreground"
          style={{ minHeight: Math.round(pageWidth * 1.414) }}
        >
          {printedStart == null ? 'Set pages on the left' : 'Loading page map…'}
        </div>
      ) : (
        <PdfDocument
          key={activeFileUrl}
          file={activeFileUrl}
          options={PDF_DOCUMENT_OPTIONS}
          loading={
            <div
              className="w-full animate-pulse rounded-2xl bg-[var(--surface-3)]"
              style={{ minHeight: Math.round(pageWidth * 1.414) }}
            />
          }
          onLoadSuccess={(meta) => onPdfNumPages?.(meta.numPages)}
        >
          {singlePage ? (
            renderPage(startPdf, 'right', 'mx-auto')
          ) : (
            <div className={cn('flex w-full items-stretch justify-center', checksEnabled ? 'gap-0' : 'gap-2')}>
              {renderPage(leftPdf, 'left')}
              {rightPdf != null ? renderPage(rightPdf, 'right') : null}
            </div>
          )}
        </PdfDocument>
      )}

      {mappingReady && showNav ? (
        <div className="flex items-center gap-3">
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="h-11 w-11 shrink-0 rounded-full"
            disabled={!canPrev}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              goPrev()
            }}
            aria-label="Previous spread"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span className="min-w-[4rem] text-center text-[13px] font-medium tabular-nums text-muted-foreground">
            {counterLabel}
          </span>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="h-11 w-11 shrink-0 rounded-full"
            disabled={!canNext}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              goNext()
            }}
            aria-label="Next spread"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      ) : mappingReady ? (
        <span className="text-[12px] font-medium tabular-nums text-muted-foreground">{counterLabel}</span>
      ) : null}
      {checksEnabled ? (
        <p className="text-center text-[12px] text-muted-foreground">
          {readingCheckHotspotPlacementActive
            ? 'Tap the page to drop this check.'
            : 'Pins sit on the real pages. Drag one, or tap the pin icon then the beat.'}
        </p>
      ) : enableTextLayer ? (
        <p className="text-center text-[12px] text-muted-foreground">
          Try selecting a word on the page to confirm selectable text.
        </p>
      ) : null}
    </div>
  )
}

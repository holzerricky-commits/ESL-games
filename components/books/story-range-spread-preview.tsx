'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PdfPageThumbnail } from '@/components/students/pdf-page-thumbnail'
import { Button } from '@/components/ui/button'
import { mapPdfPageToDisplayLabel, mapPdfSpreadToDisplayLabel } from '@/lib/books/page-numbering'
import type { BookRecord, BookUnitRecord } from '@/lib/books/types'
import { cn } from '@/lib/utils'

const PdfDocument = dynamic(() => import('react-pdf').then((mod) => mod.Document), { ssr: false })
const PDF_DOCUMENT_OPTIONS = { wasmUrl: '/wasm/' } as const

const DEFAULT_THUMB_WIDTH = 78

export interface StoryRangeSpreadPreviewProps {
  fileUrl: string
  unitId: string
  book: BookRecord
  unit: BookUnitRecord
  pdfReady: boolean
  totalPdfPages: number | null
  /** Already-mapped PDF indices (from resolveReadingStoryRange / resolveStoryDisplayRangeToPdfPages). */
  startPdfPage: number
  endPdfPage: number
  /** Printed / display start from the edit fields (for Add page). */
  rangeStartDisplay: number
  /** Printed / display end from the edit fields (for Add page). */
  rangeEndDisplay: number
  onRangeChange: (startDisplay: number, endDisplay: number) => void
  /** Report PDF length so printed→PDF mapping can run (Stories may open before Outline). */
  onPdfNumPages?: (numPages: number) => void
  /** Page thumb width; default 78. */
  thumbWidth?: number
  /** Larger chrome for prep desk / hero use. */
  size?: 'sm' | 'lg'
  /** Show the page counter between prev/next. Default true. */
  showCounterLabel?: boolean
  className?: string
}

function displayNumberForPdfPage(
  pdfPage: number,
  book: BookRecord,
  unit: BookUnitRecord,
  totalPdfPages: number | null,
): number | null {
  const label = mapPdfPageToDisplayLabel(pdfPage, book, unit, totalPdfPages, 'mapped')
  if (label === '·') return null
  const n = Math.floor(Number(label))
  return Number.isFinite(n) && n >= 1 ? n : Math.max(1, Math.floor(pdfPage))
}

export function StoryRangeSpreadPreview({
  fileUrl,
  unitId,
  book,
  unit,
  pdfReady,
  totalPdfPages,
  startPdfPage,
  endPdfPage,
  rangeStartDisplay,
  rangeEndDisplay,
  onRangeChange,
  onPdfNumPages,
  thumbWidth = DEFAULT_THUMB_WIDTH,
  size = 'sm',
  showCounterLabel = true,
  className,
}: StoryRangeSpreadPreviewProps) {
  const startDisplay = Math.min(rangeStartDisplay, rangeEndDisplay)
  const endDisplay = Math.max(rangeStartDisplay, rangeEndDisplay)
  const startPdf = Math.max(1, Math.floor(startPdfPage))
  const endPdf = Math.max(startPdf, Math.floor(endPdfPage))
  const maxPdf =
    totalPdfPages != null && totalPdfPages >= 1 ? Math.floor(totalPdfPages) : Math.max(endPdf, startPdf + 40)

  const mappingReady = totalPdfPages != null && totalPdfPages >= 1
  const isLg = size === 'lg'
  const gap = isLg ? 8 : 4
  const sideNav = isLg
  const navBtnClass = cn('shrink-0 rounded-full', isLg ? 'h-11 w-11' : 'h-8 w-8')
  const navIconClass = isLg ? 'h-5 w-5' : 'h-4 w-4'
  const spreadWidth = thumbWidth * 2 + gap
  const navButtonPx = isLg ? 44 : 32
  const sideGapPx = 12
  /** Side arrows sit outside the spread; account for button + gap on each side. */
  const outerWidth = sideNav ? spreadWidth + navButtonPx * 2 + sideGapPx * 2 : spreadWidth

  const [leftPdf, setLeftPdf] = useState(() => startPdf)

  useEffect(() => {
    setLeftPdf(Math.max(1, Math.min(startPdf, maxPdf)))
  }, [startPdf, maxPdf, unitId, fileUrl])

  const rightPdf = leftPdf < maxPdf ? leftPdf + 1 : null

  const counterLabel = useMemo(
    () => mapPdfSpreadToDisplayLabel(leftPdf, rightPdf, book, unit, totalPdfPages, 'mapped'),
    [leftPdf, rightPdf, book, unit, totalPdfPages],
  )

  function pageInRange(pdfPage: number): boolean {
    return pdfPage >= startPdf && pdfPage <= endPdf
  }

  function addPage(pdfPage: number) {
    const display = displayNumberForPdfPage(pdfPage, book, unit, totalPdfPages)
    if (display == null) return
    if (display < startDisplay) {
      onRangeChange(display, endDisplay)
      return
    }
    if (display > endDisplay) {
      onRangeChange(startDisplay, display)
    }
  }

  function goPrev() {
    setLeftPdf((p) => Math.max(1, p - 2))
  }

  function goNext() {
    setLeftPdf((p) => Math.min(Math.max(1, maxPdf - 1), p + 2))
  }

  const canPrev = leftPdf > 1
  const canNext = rightPdf != null ? rightPdf < maxPdf : leftPdf < maxPdf

  const spreadPages = (
    <div className="flex items-stretch" style={{ width: spreadWidth, gap }}>
      <SpreadPageSlot
        fileUrl={fileUrl}
        unitId={unitId}
        pdfPage={leftPdf}
        pdfReady={pdfReady}
        thumbWidth={thumbWidth}
        inRange={pageInRange(leftPdf)}
        size={size}
        onAdd={() => addPage(leftPdf)}
      />
      {rightPdf != null ? (
        <SpreadPageSlot
          fileUrl={fileUrl}
          unitId={unitId}
          pdfPage={rightPdf}
          pdfReady={pdfReady}
          thumbWidth={thumbWidth}
          inRange={pageInRange(rightPdf)}
          size={size}
          onAdd={() => addPage(rightPdf)}
        />
      ) : (
        <div
          className={cn(
            'flex items-center justify-center bg-[var(--surface-3)] text-muted-foreground',
            isLg ? 'rounded-2xl text-[13px]' : 'rounded-xl text-[11px]',
          )}
          style={{ width: thumbWidth, aspectRatio: '1 / 1.414' }}
        >
          End
        </div>
      )}
    </div>
  )

  return (
    <div className={cn(!sideNav && (isLg ? 'space-y-4' : 'space-y-2'), className)} style={{ width: outerWidth }}>
      {/* Hidden load so Stories can set numPages without visiting Outline */}
      {pdfReady && onPdfNumPages && totalPdfPages == null ? (
        <div className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0" aria-hidden>
          <PdfDocument
            file={fileUrl}
            options={PDF_DOCUMENT_OPTIONS}
            onLoadSuccess={(meta) => onPdfNumPages(meta.numPages)}
            loading={null}
          >
            {null}
          </PdfDocument>
        </div>
      ) : null}

      {!mappingReady ? (
        <div
          className={cn(
            'flex items-center justify-center bg-[var(--surface-3)] px-2 text-center text-muted-foreground',
            isLg ? 'rounded-2xl text-[13px]' : 'rounded-xl text-[11px]',
          )}
          style={{ minHeight: Math.round(thumbWidth * 1.414) }}
        >
          Loading page map…
        </div>
      ) : sideNav ? (
        <div className="flex items-center gap-3">
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className={navBtnClass}
            disabled={!canPrev}
            onClick={goPrev}
            aria-label="Previous spread"
          >
            <ChevronLeft className={navIconClass} />
          </Button>
          {spreadPages}
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className={navBtnClass}
            disabled={!canNext}
            onClick={goNext}
            aria-label="Next spread"
          >
            <ChevronRight className={navIconClass} />
          </Button>
          {!showCounterLabel ? <span className="sr-only">{counterLabel}</span> : null}
        </div>
      ) : (
        <>
          {spreadPages}
          <div
            className={cn(
              'flex items-center gap-2',
              showCounterLabel ? 'justify-between' : 'justify-center',
            )}
          >
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className={navBtnClass}
              disabled={!canPrev}
              onClick={goPrev}
              aria-label="Previous spread"
            >
              <ChevronLeft className={navIconClass} />
            </Button>
            {showCounterLabel ? (
              <span
                className={cn(
                  'min-w-0 truncate text-center font-medium tabular-nums text-muted-foreground',
                  isLg ? 'text-[15px]' : 'text-[12px]',
                )}
              >
                {counterLabel}
              </span>
            ) : (
              <span className="sr-only">{counterLabel}</span>
            )}
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className={navBtnClass}
              disabled={!canNext}
              onClick={goNext}
              aria-label="Next spread"
            >
              <ChevronRight className={navIconClass} />
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

function SpreadPageSlot({
  fileUrl,
  unitId,
  pdfPage,
  pdfReady,
  thumbWidth,
  inRange,
  size,
  onAdd,
}: {
  fileUrl: string
  unitId: string
  pdfPage: number
  pdfReady: boolean
  thumbWidth: number
  inRange: boolean
  size: 'sm' | 'lg'
  onAdd: () => void
}) {
  const isLg = size === 'lg'
  return (
    <div className="relative shrink-0">
      <div className={cn(!inRange && 'opacity-40')}>
        <PdfPageThumbnail
          fileUrl={fileUrl}
          unitId={unitId}
          pageNumber={pdfPage}
          width={thumbWidth}
          pdfReady={pdfReady}
          label={`p${pdfPage}`}
          className={cn(
            isLg
              ? 'rounded-2xl shadow-[0_16px_40px_-20px_rgba(0,0,0,0.35)]'
              : 'rounded-lg shadow-[0_8px_24px_-12px_rgba(0,0,0,0.25)]',
          )}
          eager
        />
      </div>
      {!inRange ? (
        <div
          className={cn(
            'absolute inset-0 flex flex-col items-center justify-end gap-1 bg-background/55',
            isLg ? 'rounded-2xl p-3' : 'rounded-lg p-1.5',
          )}
        >
          <span className={cn('font-medium text-muted-foreground', isLg ? 'text-[12px]' : 'text-[10px]')}>
            Outside
          </span>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className={cn('rounded-full', isLg ? 'h-8 px-3 text-[12px]' : 'h-7 px-2.5 text-[11px]')}
            onClick={onAdd}
          >
            Add page
          </Button>
        </div>
      ) : null}
    </div>
  )
}

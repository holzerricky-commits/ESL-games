'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { BookBrowseCornerButton } from '@/components/books/book-browse-spread-preview'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PdfPageThumbnail } from '@/components/students/pdf-page-thumbnail'
import { Button } from '@/components/ui/button'
import { mapPdfSpreadToDisplayLabel } from '@/lib/books/page-numbering'
import {
  isOutlineSinglePageRange,
  resolveOutlinePrintedPdfRange,
} from '@/lib/books/story-thumb-pdf-page'
import type { BookRecord, BookUnitRecord } from '@/lib/books/types'
import { cn } from '@/lib/utils'

const PdfDocument = dynamic(() => import('react-pdf').then((mod) => mod.Document), { ssr: false })
const PDF_DOCUMENT_OPTIONS = { wasmUrl: '/wasm/' } as const

const DEFAULT_THUMB_WIDTH = 118
const FILL_WIDTH_MIN_PAGE = 120

export interface BookPartOutlineSpreadPreviewProps {
  fileUrl: string
  unitId: string
  book: BookRecord
  unit: BookUnitRecord
  pdfReady: boolean
  totalPdfPages: number | null
  /** Printed/effective page range from the lesson outline. */
  printedStart: number | null
  printedEnd: number | null
  onPdfNumPages?: (numPages: number) => void
  thumbWidth?: number
  /** Size each page to fill the container width. */
  fillWidth?: boolean
  size?: 'sm' | 'lg'
  className?: string
  /** Overlay on the right page (or sole page) to open the full book reader. */
  openBookAction?: { label: string; onClick: () => void }
}

export function BookPartOutlineSpreadPreview({
  fileUrl,
  unitId,
  book,
  unit,
  pdfReady,
  totalPdfPages,
  printedStart,
  printedEnd,
  onPdfNumPages,
  thumbWidth = DEFAULT_THUMB_WIDTH,
  fillWidth = false,
  size = 'lg',
  className,
  openBookAction,
}: BookPartOutlineSpreadPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [filledPageWidth, setFilledPageWidth] = useState(thumbWidth)

  const pdfRange = useMemo(
    () => resolveOutlinePrintedPdfRange(printedStart, printedEnd, book, unit, totalPdfPages),
    [printedStart, printedEnd, book, unit, totalPdfPages],
  )
  const singlePage = isOutlineSinglePageRange(printedStart, printedEnd)

  const startPdf = pdfRange?.startPdf ?? 1
  const endPdf = pdfRange?.endPdf ?? startPdf
  const mappingReady = totalPdfPages != null && totalPdfPages >= 1

  const isLg = size === 'lg'
  const gap = isLg ? 8 : 4
  const navBtnClass = cn('shrink-0 rounded-full', isLg ? 'h-11 w-11' : 'h-8 w-8')
  const navIconClass = isLg ? 'h-5 w-5' : 'h-4 w-4'
  const navButtonPx = isLg ? 44 : 32
  const sideGapPx = 12
  const showNav = !singlePage && endPdf > startPdf
  const useOverlayNav = fillWidth && showNav

  useEffect(() => {
    if (!fillWidth) {
      setFilledPageWidth(thumbWidth)
      return
    }
    const el = containerRef.current
    if (!el) return
    const measure = () => {
      const containerWidth = el.clientWidth
      if (containerWidth <= 0) return
      const navChrome = useOverlayNav ? 0 : showNav ? navButtonPx * 2 + sideGapPx * 2 : 0
      const pageCount = singlePage ? 1 : 2
      const available = containerWidth - navChrome - gap * (pageCount - 1)
      const perPage = Math.floor(available / pageCount)
      setFilledPageWidth(Math.max(FILL_WIDTH_MIN_PAGE, perPage))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [fillWidth, thumbWidth, showNav, useOverlayNav, singlePage, navButtonPx, sideGapPx, gap])

  const effectiveThumbWidth = fillWidth ? filledPageWidth : thumbWidth
  const spreadWidth = singlePage ? effectiveThumbWidth : effectiveThumbWidth * 2 + gap
  const outerWidth = showNav && !useOverlayNav ? spreadWidth + navButtonPx * 2 + sideGapPx * 2 : spreadWidth

  const [leftPdf, setLeftPdf] = useState(startPdf)

  useEffect(() => {
    setLeftPdf(startPdf)
  }, [startPdf, unitId, fileUrl])

  const rightPdf = singlePage ? null : Math.min(leftPdf + 1, endPdf)
  const counterLabel = useMemo(
    () => mapPdfSpreadToDisplayLabel(leftPdf, rightPdf, book, unit, totalPdfPages, 'mapped'),
    [leftPdf, rightPdf, book, unit, totalPdfPages],
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

  const thumbClass = cn(
    isLg
      ? 'rounded-2xl shadow-[0_16px_40px_-20px_rgba(0,0,0,0.35)]'
      : 'rounded-lg shadow-[0_8px_24px_-12px_rgba(0,0,0,0.25)]',
  )

  const openBookButton = openBookAction ? (
    <BookBrowseCornerButton
      label={openBookAction.label}
      onClick={openBookAction.onClick}
      icon="fullscreen"
      placement="bottom-right"
      hoverScope="page"
    />
  ) : null

  const spreadPages = singlePage ? (
    <div className={cn('group/page relative', fillWidth ? 'w-full' : undefined)}>
      <PdfPageThumbnail
        fileUrl={fileUrl}
        unitId={unitId}
        pageNumber={startPdf}
        width={effectiveThumbWidth}
        fitHeight
        objectFit="contain"
        pdfReady={pdfReady}
        label={`p${startPdf}`}
        className={cn('h-full w-full border-0', thumbClass)}
        eager
      />
      {openBookButton}
    </div>
  ) : (
    <div
      className={cn('flex items-stretch', fillWidth ? 'w-full' : undefined)}
      style={fillWidth ? { gap } : { width: spreadWidth, gap }}
    >
      <div className={cn('relative min-w-0', fillWidth ? 'flex-1' : undefined)}>
        <PdfPageThumbnail
          fileUrl={fileUrl}
          unitId={unitId}
          pageNumber={leftPdf}
          width={effectiveThumbWidth}
          fitHeight
          objectFit="contain"
          pdfReady={pdfReady}
          label={`p${leftPdf}`}
          className={cn('border-0', fillWidth ? 'w-full' : undefined, thumbClass)}
          eager
        />
      </div>
      {rightPdf != null ? (
        <div className={cn('group/page relative min-w-0', fillWidth ? 'flex-1' : undefined)}>
          <PdfPageThumbnail
            fileUrl={fileUrl}
            unitId={unitId}
            pageNumber={rightPdf}
            width={effectiveThumbWidth}
            fitHeight
            objectFit="contain"
            pdfReady={pdfReady}
            label={`p${rightPdf}`}
            className={cn('border-0', fillWidth ? 'w-full' : undefined, thumbClass)}
            eager
          />
          {openBookButton}
        </div>
      ) : null}
    </div>
  )

  const body = (
    <>
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
            'flex w-full items-center justify-center bg-[var(--surface-3)] px-2 text-center text-muted-foreground',
            isLg ? 'rounded-2xl text-[13px]' : 'rounded-xl text-[11px]',
          )}
          style={{ minHeight: Math.round(effectiveThumbWidth * 1.414) }}
        >
          Loading page map…
        </div>
      ) : useOverlayNav ? (
        <div className="flex w-full flex-col items-center gap-3">
          {spreadPages}
          <div className="flex items-center gap-3">
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className={navBtnClass}
              disabled={!canPrev}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                goPrev()
              }}
              aria-label="Previous spread"
            >
              <ChevronLeft className={navIconClass} />
            </Button>
            <span className="min-w-[4rem] text-center text-[13px] font-medium tabular-nums text-muted-foreground">
              {counterLabel}
            </span>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className={navBtnClass}
              disabled={!canNext}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                goNext()
              }}
              aria-label="Next spread"
            >
              <ChevronRight className={navIconClass} />
            </Button>
          </div>
        </div>
      ) : showNav ? (
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className={navBtnClass}
              disabled={!canPrev}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                goPrev()
              }}
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
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                goNext()
              }}
              aria-label="Next spread"
            >
              <ChevronRight className={navIconClass} />
            </Button>
          </div>
          <span className="text-[12px] font-medium tabular-nums text-muted-foreground">{counterLabel}</span>
        </div>
      ) : (
        <div
          className={cn(
            'overflow-hidden rounded-2xl bg-[var(--surface-3)]',
            fillWidth ? 'w-full' : undefined,
          )}
          style={!fillWidth && singlePage ? { width: effectiveThumbWidth, aspectRatio: '1 / 1.414' } : undefined}
        >
          {spreadPages}
        </div>
      )}
    </>
  )

  if (fillWidth) {
    return (
      <div ref={containerRef} className={cn('relative w-full', className)}>
        {body}
      </div>
    )
  }

  return (
    <div className={cn('relative', className)} style={{ width: outerWidth }}>
      {body}
    </div>
  )
}

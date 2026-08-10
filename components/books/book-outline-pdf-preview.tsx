'use client'

import dynamic from 'next/dynamic'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const PdfDocument = dynamic(() => import('react-pdf').then((mod) => mod.Document), { ssr: false })
const PdfPage = dynamic(() => import('react-pdf').then((mod) => mod.Page), { ssr: false })
const PDF_DOCUMENT_OPTIONS = { wasmUrl: '/wasm/' } as const

export interface BookOutlinePdfPreviewProps {
  fileUrl: string | null
  pdfReady: boolean
  pageNumber: number
  totalPdfPages: number | null
  onDocumentLoad: (numPages: number) => void
  onPageChange: (page: number) => void
  className?: string
  /** PDF page render width; default 220 (outline side panel). */
  pageWidth?: number
  /** Footer tip under the page; pass null to hide. */
  footerHint?: string | null
}

export function BookOutlinePdfPreview({
  fileUrl,
  pdfReady,
  pageNumber,
  totalPdfPages,
  onDocumentLoad,
  onPageChange,
  className,
  pageWidth = 220,
  footerHint = 'Click a lesson or part in the outline to jump here.',
}: BookOutlinePdfPreviewProps) {
  const safePage =
    totalPdfPages != null && Number.isFinite(totalPdfPages)
      ? Math.min(Math.max(1, Math.floor(pageNumber)), Math.floor(totalPdfPages))
      : Math.max(1, Math.floor(pageNumber))

  if (!fileUrl) {
    return (
      <div
        className={cn(
          'flex min-h-[280px] items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-muted/20 p-4 text-center text-sm text-muted-foreground',
          className,
        )}
      >
        Select a unit to preview pages.
      </div>
    )
  }

  if (!pdfReady) {
    return (
      <div
        className={cn(
          'flex min-h-[280px] items-center justify-center rounded-lg border border-[var(--border)] bg-muted/20 p-4 text-sm text-muted-foreground',
          className,
        )}
      >
        Loading PDF tools…
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-2 rounded-lg border border-[var(--border)] bg-background/50 p-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview</p>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[4.5rem] text-center text-xs tabular-nums text-muted-foreground">
            {safePage}
            {totalPdfPages != null ? ` / ${totalPdfPages}` : ''}
          </span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            disabled={totalPdfPages != null ? safePage >= totalPdfPages : false}
            onClick={() => onPageChange(safePage + 1)}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex min-h-[260px] items-start justify-center overflow-hidden rounded-md bg-muted/30 p-2">
        <PdfDocument
          file={fileUrl}
          options={PDF_DOCUMENT_OPTIONS}
          loading={
            <div
              className="animate-pulse rounded bg-muted/50"
              style={{ height: Math.round(pageWidth * 1.18), width: pageWidth }}
            />
          }
          onLoadSuccess={(meta) => onDocumentLoad(meta.numPages)}
        >
          <PdfPage
            pageNumber={safePage}
            width={pageWidth}
            renderTextLayer={false}
            renderAnnotationLayer={false}
          />
        </PdfDocument>
      </div>
      {footerHint ? <p className="text-[11px] text-muted-foreground">{footerHint}</p> : null}
    </div>
  )
}

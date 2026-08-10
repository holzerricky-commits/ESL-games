'use client'

import { PDF_THUMB_WIDTH } from '@/lib/books/pdf-thumbnail-cache'
import { usePdfPageThumbnail } from '@/components/students/use-pdf-page-thumbnail'
import { cn } from '@/lib/utils'

export interface PdfPageThumbnailProps {
  fileUrl: string
  unitId: string
  pageNumber: number
  width?: number
  fitHeight?: boolean
  /** How the page image fills the box when fitHeight is true. Default cover. */
  objectFit?: 'cover' | 'contain'
  /** When null or omitted, the observer uses the viewport as root. */
  scrollRoot?: HTMLElement | null
  pdfReady: boolean
  label: string
  className?: string
  /** Load immediately without waiting for scroll visibility. */
  eager?: boolean
}

export function PdfPageThumbnail({
  fileUrl,
  unitId,
  pageNumber,
  width = PDF_THUMB_WIDTH,
  fitHeight = false,
  objectFit = 'cover',
  scrollRoot,
  pdfReady,
  label,
  className,
  eager = false,
}: PdfPageThumbnailProps) {
  const { containerRef, phase, dataUrl } = usePdfPageThumbnail({
    fileUrl,
    unitId,
    pageNumber,
    width,
    pdfReady,
    scrollRoot,
    eager,
  })

  const showErrorFallback = phase === 'error'
  const imgFit = fitHeight ? objectFit : 'contain'

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative flex overflow-hidden rounded-md border border-[#4a3421]/14 bg-[#fcf9f4]',
        fitHeight ? 'h-full w-full min-w-0 shrink' : 'shrink-0',
        className,
      )}
      style={fitHeight ? undefined : { width, aspectRatio: '1 / 1.414' }}
    >
      {phase === 'loading' && pdfReady ? (
        <div className="absolute inset-0 z-[1] animate-pulse bg-[#c4a574]/22" aria-hidden />
      ) : null}
      {dataUrl && (phase === 'ready' || phase === 'loading') ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URL from pdf.js canvas
        <img
          src={dataUrl}
          alt=""
          className={cn('h-full w-full', imgFit === 'contain' ? 'object-contain' : 'object-cover')}
          draggable={false}
        />
      ) : null}
      {showErrorFallback ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 p-1 text-center">
          <span className="text-[10px] font-medium leading-tight text-[#5c4030]/85">{label}</span>
        </div>
      ) : null}
      {!pdfReady && phase !== 'ready' ? (
        <div className="flex h-full w-full items-center justify-center p-1 text-center">
          <span className="text-[10px] text-[#5c4030]/55">…</span>
        </div>
      ) : null}
    </div>
  )
}

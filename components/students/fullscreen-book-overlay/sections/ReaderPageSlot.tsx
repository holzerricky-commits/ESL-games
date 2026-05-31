'use client'

import type { ComponentType, MutableRefObject, ReactNode } from 'react'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { getReaderPrefetchedImageBitmap } from '@/lib/books/reader-page-prefetch-queue'
import { cn } from '@/lib/utils'

function ReaderPrefetchCanvas({
  bitmap,
  cssWidth,
  cssHeight,
}: {
  bitmap: ImageBitmap
  cssWidth: number
  cssHeight: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useLayoutEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    ctx.drawImage(bitmap, 0, 0)
  }, [bitmap])

  return (
    <canvas
      ref={ref}
      width={bitmap.width}
      height={bitmap.height}
      aria-hidden
      className="pointer-events-none block max-w-full select-none bg-white"
      style={{ width: cssWidth, height: cssHeight }}
    />
  )
}

export interface ReaderPageSlotProps {
  unitId: string
  pageNumber: number
  spreadPageWidth: number
  pageCanvasHeightPx: number
  /** Clip the PDF/prefetch layer from the left so the seam overlap shows the left page (spread right slot). */
  pdfClipLeftPx?: number
  pdf: PDFDocumentProxy
  PdfPage: ComponentType<any>
  onPdfPageLoadSuccess: (page: { originalWidth?: number; originalHeight?: number; width: number; height: number }) => void
  prefetchRevision: number
  captureRef: MutableRefObject<HTMLDivElement | null>
  children: ReactNode
}

/**
 * Phase C3: when a prefetched `ImageBitmap` exists for this page, paint it immediately while
 * `react-pdf` loads underneath; swap to `PdfPage` on `onLoadSuccess` so annotations stay aligned.
 */
export function ReaderPageSlot({
  unitId,
  pageNumber,
  spreadPageWidth,
  pageCanvasHeightPx,
  pdfClipLeftPx = 0,
  pdf,
  PdfPage,
  onPdfPageLoadSuccess,
  prefetchRevision,
  captureRef,
  children,
}: ReaderPageSlotProps) {
  const [reactPdfLoaded, setReactPdfLoaded] = useState(false)

  useLayoutEffect(() => {
    setReactPdfLoaded(false)
  }, [unitId, pageNumber, spreadPageWidth])

  const prefetchBmp = useMemo(
    () => getReaderPrefetchedImageBitmap(unitId, pageNumber, spreadPageWidth),
    [unitId, pageNumber, spreadPageWidth, prefetchRevision],
  )

  const showPrefetch = prefetchBmp != null && !reactPdfLoaded
  const pdfClipLeft = pdfClipLeftPx > 0 ? Math.round(pdfClipLeftPx) : 0
  const pdfClipStyle =
    pdfClipLeft > 0 ? ({ clipPath: `inset(0 0 0 ${pdfClipLeft}px)` } as const) : undefined

  return (
    <div
      ref={captureRef}
      className="relative inline-block"
      style={{ width: spreadPageWidth, minHeight: pageCanvasHeightPx }}
    >
      {showPrefetch ? (
        <div
          className="absolute inset-0 z-0 flex items-start justify-center overflow-hidden bg-white"
          style={pdfClipStyle}
        >
          <ReaderPrefetchCanvas
            bitmap={prefetchBmp}
            cssWidth={spreadPageWidth}
            cssHeight={pageCanvasHeightPx}
          />
        </div>
      ) : null}
      <div
        className={cn('relative z-[1]', showPrefetch && 'pointer-events-none opacity-0')}
        style={{ width: spreadPageWidth, minHeight: pageCanvasHeightPx, ...pdfClipStyle }}
      >
        <PdfPage
          key={`rp-${pageNumber}`}
          pdf={pdf}
          pageNumber={pageNumber}
          width={spreadPageWidth}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          onLoadSuccess={(p: { originalWidth?: number; originalHeight?: number; width: number; height: number }) => {
            setReactPdfLoaded(true)
            onPdfPageLoadSuccess(p)
          }}
        />
      </div>
      {children}
    </div>
  )
}

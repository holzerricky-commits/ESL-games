'use client'

import type { ComponentType, CSSProperties, MutableRefObject, ReactNode } from 'react'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { useBrowserZoomRepaintRevision } from '@/components/students/fullscreen-book-overlay/hooks/useBrowserZoomRepaintRevision'
import { CachedPageCanvas } from '@/components/students/fullscreen-book-overlay/sections/CachedPageCanvas'
import { getPageRenderCacheBitmap } from '@/lib/books/page-render-cache'
import {
  READER_PAGE_PLACEHOLDER_FILTER,
  isReaderPageSharpReady,
  readerPageHasDrawablePixelsFromLayers,
  resolveReaderPagePlaceholderSource,
  shouldShowReaderPagePlaceholder,
  type ReaderPagePlaceholderSource,
} from '@/lib/books/reader-page-display'
import { cn } from '@/lib/utils'

function scheduleAfterNextPaint(callback: () => void): () => void {
  let cancelled = false
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!cancelled) callback()
    })
  })
  return () => {
    cancelled = true
  }
}

function ReaderPagePlaceholderLayer({
  placeholder,
  spreadPageWidth,
  pageCanvasHeightPx,
  pdfClipLeftPx,
  onPainted,
}: {
  placeholder: ReaderPagePlaceholderSource
  spreadPageWidth: number
  pageCanvasHeightPx: number
  pdfClipLeftPx: number
  onPainted?: () => void
}) {
  const pdfClipLeft = pdfClipLeftPx > 0 ? Math.round(pdfClipLeftPx) : 0
  const layerClipStyle =
    pdfClipLeft > 0 ? ({ clipPath: `inset(0 0 0 ${pdfClipLeft}px)` } as const) : undefined
  const blurStyle: CSSProperties = { filter: READER_PAGE_PLACEHOLDER_FILTER }

  if (placeholder.kind === 'low-res-bitmap') {
    return (
      <div
        className="absolute inset-0 z-0 flex items-start justify-center overflow-hidden bg-[#FDFCFB]"
        style={{ ...layerClipStyle, ...blurStyle }}
      >
        <CachedPageCanvas
          bitmap={placeholder.bitmap}
          cssWidth={spreadPageWidth}
          cssHeight={pageCanvasHeightPx}
          clipLeftPx={pdfClipLeft}
          onPainted={onPainted}
        />
      </div>
    )
  }

  return (
    <div
      className="absolute inset-0 z-0 flex items-start justify-center overflow-hidden bg-[#FDFCFB]"
      style={layerClipStyle}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- data URL from thumbnail LRU */}
      <img
        src={placeholder.dataUrl}
        alt=""
        aria-hidden
        className="pointer-events-none block max-w-full select-none bg-[#FDFCFB] object-contain object-left-top"
        style={{
          width: spreadPageWidth,
          height: pageCanvasHeightPx,
          ...blurStyle,
        }}
        onLoad={() => onPainted?.()}
      />
    </div>
  )
}

export interface ReaderPageSlotProps {
  unitId: string
  pageNumber: number
  spreadPageWidth: number
  pageCanvasHeightPx: number
  /** Clip the PDF/cache layer from the left so the seam overlap shows the left page (spread right slot). */
  pdfClipLeftPx?: number
  pdf: PDFDocumentProxy
  PdfPage: ComponentType<any>
  onPdfPageLoadSuccess: (page: { originalWidth?: number; originalHeight?: number; width: number; height: number }) => void
  prefetchRevision: number
  captureRef: MutableRefObject<HTMLDivElement | null>
  /** Fired once per mount when page pixels are drawable (cache painted or pdf composited). */
  onSlotPixelsReady?: (pageNumber: number) => void
  /** When false, warm hidden slots paint cache but defer parent ready until presented. */
  confirmSlotPixelsReady?: boolean
  children: ReactNode
}

/**
 * Phase 1 stable pages + R3 progressive display: sharp cache/PDF when ready;
 * soft placeholder (low-res prefetch or thumbnail) only on miss — no blur flash when cached.
 * Annotations stay in `children` above the page image stack.
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
  onSlotPixelsReady,
  confirmSlotPixelsReady = true,
  children,
}: ReaderPageSlotProps) {
  const [pdfDisplayReady, setPdfDisplayReady] = useState(false)
  const slotPixelsReportedRef = useRef(false)
  const confirmSlotPixelsReadyRef = useRef(confirmSlotPixelsReady)
  const onSlotPixelsReadyRef = useRef(onSlotPixelsReady)
  onSlotPixelsReadyRef.current = onSlotPixelsReady
  confirmSlotPixelsReadyRef.current = confirmSlotPixelsReady

  useLayoutEffect(() => {
    setPdfDisplayReady(false)
    slotPixelsReportedRef.current = false
  }, [unitId, pageNumber, spreadPageWidth])

  const cacheBitmap = useMemo(
    () => getPageRenderCacheBitmap(unitId, pageNumber, spreadPageWidth),
    [unitId, pageNumber, spreadPageWidth, prefetchRevision],
  )

  const placeholderSource = useMemo(
    () => resolveReaderPagePlaceholderSource(unitId, pageNumber, spreadPageWidth, prefetchRevision),
    [unitId, pageNumber, spreadPageWidth, prefetchRevision],
  )

  const zoomRepaintRevision = useBrowserZoomRepaintRevision()

  useLayoutEffect(() => {
    if (zoomRepaintRevision === 0) return
    if (!cacheBitmap) return
    setPdfDisplayReady(false)
  }, [zoomRepaintRevision, cacheBitmap])

  const sharpReady = isReaderPageSharpReady({ cacheBitmap, pdfDisplayReady })
  const showSharpCache = cacheBitmap != null && !pdfDisplayReady
  const showPlaceholder = shouldShowReaderPagePlaceholder({
    sharpReady,
    placeholder: placeholderSource,
  })
  const hasDrawablePixels = readerPageHasDrawablePixelsFromLayers({
    showSharpCache,
    pdfDisplayReady,
    showPlaceholder,
  })

  const reportSlotPixelsReady = () => {
    if (!confirmSlotPixelsReadyRef.current) return
    if (slotPixelsReportedRef.current) return
    slotPixelsReportedRef.current = true
    onSlotPixelsReadyRef.current?.(pageNumber)
  }

  useLayoutEffect(() => {
    if (!confirmSlotPixelsReady) {
      slotPixelsReportedRef.current = false
    }
  }, [confirmSlotPixelsReady])

  useLayoutEffect(() => {
    if (!confirmSlotPixelsReady) return
    if (cacheBitmap && !slotPixelsReportedRef.current) {
      reportSlotPixelsReady()
    }
  }, [confirmSlotPixelsReady, cacheBitmap])

  useLayoutEffect(() => {
    if (!confirmSlotPixelsReady) return
    if (hasDrawablePixels && !slotPixelsReportedRef.current) {
      reportSlotPixelsReady()
    }
  }, [confirmSlotPixelsReady, hasDrawablePixels, pdfDisplayReady, showPlaceholder])

  const pdfClipLeft = pdfClipLeftPx > 0 ? Math.round(pdfClipLeftPx) : 0
  const layerClipStyle =
    pdfClipLeft > 0 ? ({ clipPath: `inset(0 0 0 ${pdfClipLeft}px)` } as const) : undefined

  const handleCachePainted = () => {
    reportSlotPixelsReady()
  }

  const handlePlaceholderPainted = () => {
    reportSlotPixelsReady()
  }

  const handlePdfLoadSuccess = (p: {
    originalWidth?: number
    originalHeight?: number
    width: number
    height: number
  }) => {
    onPdfPageLoadSuccess(p)
    scheduleAfterNextPaint(() => {
      setPdfDisplayReady(true)
      reportSlotPixelsReady()
    })
  }

  /** Hide react-pdf only while the sharp prefetch canvas is showing the same page. */
  const pageImageHidden = showSharpCache

  return (
    <div
      ref={captureRef}
      className="relative inline-block bg-[#FDFCFB] opacity-100"
      style={{ width: spreadPageWidth, minHeight: pageCanvasHeightPx }}
    >
      {showPlaceholder && placeholderSource ? (
        <ReaderPagePlaceholderLayer
          placeholder={placeholderSource}
          spreadPageWidth={spreadPageWidth}
          pageCanvasHeightPx={pageCanvasHeightPx}
          pdfClipLeftPx={pdfClipLeft}
          onPainted={handlePlaceholderPainted}
        />
      ) : null}
      {showSharpCache ? (
        <div
          className="absolute inset-0 z-0 flex items-start justify-center overflow-hidden bg-[#FDFCFB]"
          style={layerClipStyle}
        >
          <CachedPageCanvas
            bitmap={cacheBitmap}
            cssWidth={spreadPageWidth}
            cssHeight={pageCanvasHeightPx}
            clipLeftPx={pdfClipLeft}
            onPainted={handleCachePainted}
          />
        </div>
      ) : null}
      <div
        className={cn('relative z-[1]', pageImageHidden && 'pointer-events-none opacity-0')}
        style={{ width: spreadPageWidth, minHeight: pageCanvasHeightPx, ...layerClipStyle }}
      >
        <PdfPage
          key={`rp-${pageNumber}`}
          pdf={pdf}
          pageNumber={pageNumber}
          width={spreadPageWidth}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          onLoadSuccess={handlePdfLoadSuccess}
        />
      </div>
      {children}
    </div>
  )
}

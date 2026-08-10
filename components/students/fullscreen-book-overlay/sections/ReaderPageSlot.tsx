'use client'

import type { ComponentType, CSSProperties, MutableRefObject, ReactNode } from 'react'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { useBrowserZoomRepaintRevision } from '@/components/students/fullscreen-book-overlay/hooks/useBrowserZoomRepaintRevision'
import { CachedPageCanvas } from '@/components/students/fullscreen-book-overlay/sections/CachedPageCanvas'
import {
  READER_PAGE_PLACEHOLDER_FILTER,
  isReaderPageSharpReady,
  readerPageHasDrawablePixelsFromLayers,
  resolveReaderPageLayerVisibility,
  resolveReaderPagePlaceholderSource,
  resolveReaderPageShowSharpCache,
  shouldShowReaderPagePlaceholder,
  type ReaderPagePlaceholderSource,
} from '@/lib/books/reader-page-display'
import {
  resolveReaderPageCacheLookup,
  resolveReaderPagePdfFitScale,
  resolveReaderPagePdfRenderHeightPx,
  resolveReaderPagePdfRenderWidthPx,
} from '@/lib/books/reader-page-render-width'
import { bookReaderLivePdfPrimaryEnabled } from '@/lib/books/feature-flags'
import {
  readerPageBulgeClipPath,
  READER_PAGE_PAPER_COLOR,
} from '@/lib/books/reader-page-bulge-clip'
import { BookPageStackLayers } from '@/components/books/book-page-stack-layers'
import { bookSpreadPageArtHiddenForFrameTuning, bookSpreadHardcoverGutterOnlyForFrameTuning } from '@/lib/books/feature-flags'
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
  transparentSurface,
  onPainted,
  clipStyle,
}: {
  placeholder: ReaderPagePlaceholderSource
  spreadPageWidth: number
  pageCanvasHeightPx: number
  transparentSurface?: boolean
  onPainted?: () => void
  clipStyle?: CSSProperties
}) {
  const blurStyle: CSSProperties = { filter: READER_PAGE_PLACEHOLDER_FILTER }
  const layerSurfaceClass = transparentSurface ? 'bg-transparent' : 'bg-[#FDFCFB]'

  if (placeholder.kind === 'low-res-bitmap') {
    return (
      <div
        className={cn(
          'absolute inset-0 z-0 flex items-start justify-center overflow-hidden',
          layerSurfaceClass,
        )}
        style={{ ...blurStyle, ...clipStyle }}
      >
        <CachedPageCanvas
          bitmap={placeholder.bitmap}
          cssWidth={spreadPageWidth}
          cssHeight={pageCanvasHeightPx}
          onPainted={onPainted}
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'absolute inset-0 z-0 flex items-start justify-center overflow-hidden',
        layerSurfaceClass,
      )}
      style={clipStyle}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- data URL from thumbnail LRU */}
      <img
        src={placeholder.dataUrl}
        alt=""
        aria-hidden
        className={cn(
          'pointer-events-none block max-w-full select-none object-contain object-left-top',
          transparentSurface ? 'bg-transparent' : 'bg-[#FDFCFB]',
        )}
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
  /** @deprecated Seam overlap uses spread `marginLeft` only — do not inset-clip (causes white strip). */
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
  /** Open-book bulge clip — spine on the left (right page) or right (left page). */
  pageBulgeSide?: 'left' | 'right'
  /** When true, enable PDF.js text layer if this page has selectable text. */
  bookTextSelectActive?: boolean
  pageHasSelectableText?: boolean
  /** Focus zoom / effective screen scale for sharper prefetch lookup. */
  screenScale?: number
  children: ReactNode
}

/**
 * Progressive display: prefetch cache while loading, then live react-pdf (Phase 3 primary).
 * Text selection keeps cache visible under transparent text spans until live PDF composited.
 */
export function ReaderPageSlot({
  unitId,
  pageNumber,
  spreadPageWidth,
  pageCanvasHeightPx,
  pdfClipLeftPx: _pdfClipLeftPx = 0,
  pdf,
  PdfPage,
  onPdfPageLoadSuccess,
  prefetchRevision,
  captureRef,
  onSlotPixelsReady,
  confirmSlotPixelsReady = true,
  pageBulgeSide,
  bookTextSelectActive = false,
  pageHasSelectableText = false,
  screenScale = 1,
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
  }, [unitId, pageNumber, spreadPageWidth, screenScale])

  const { bitmap: cacheBitmap, preferSharpCacheOverPdf } = useMemo(
    () =>
      resolveReaderPageCacheLookup({
        unitId,
        pageNumber,
        spreadPageWidth,
        screenScale,
      }),
    [unitId, pageNumber, spreadPageWidth, screenScale, prefetchRevision],
  )

  const placeholderSource = useMemo(
    () => resolveReaderPagePlaceholderSource(unitId, pageNumber, spreadPageWidth, prefetchRevision),
    [unitId, pageNumber, spreadPageWidth, prefetchRevision],
  )

  const zoomRepaintRevision = useBrowserZoomRepaintRevision()

  useLayoutEffect(() => {
    if (zoomRepaintRevision === 0) return
    setPdfDisplayReady(false)
  }, [zoomRepaintRevision])

  const sharpReady = isReaderPageSharpReady({ cacheBitmap, pdfDisplayReady })
  const showSharpCache = resolveReaderPageShowSharpCache({
    livePdfPrimaryEnabled: bookReaderLivePdfPrimaryEnabled,
    cacheBitmap,
    pdfDisplayReady,
    preferSharpCacheOverPdf,
  })
  const pdfRenderWidthPx = resolveReaderPagePdfRenderWidthPx(spreadPageWidth, screenScale)
  const pdfRenderHeightPx = resolveReaderPagePdfRenderHeightPx(
    spreadPageWidth,
    pageCanvasHeightPx,
    pdfRenderWidthPx,
  )
  const pdfFitScale = resolveReaderPagePdfFitScale(spreadPageWidth, pdfRenderWidthPx)
  const pdfUsesScaledLiveRender =
    bookReaderLivePdfPrimaryEnabled && pdfFitScale < 1 - 1e-6
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

  const {
    pdfTextLayerActive,
    pdfTextOverCache,
    pdfHiddenBehindCache,
    showSharpCacheLayer,
  } = resolveReaderPageLayerVisibility({
    bookTextSelectActive,
    pageHasSelectableText,
    showSharpCache,
  })

  const pageArtClipStyle: CSSProperties | undefined = pageBulgeSide
    ? { clipPath: readerPageBulgeClipPath(pageBulgeSide, pageCanvasHeightPx) }
    : undefined

  const bulgeActive = pageBulgeSide != null
  const pageArtHidden = bookSpreadPageArtHiddenForFrameTuning

  useLayoutEffect(() => {
    if (!pageArtHidden || !confirmSlotPixelsReady) return
    reportSlotPixelsReady()
  }, [pageArtHidden, confirmSlotPixelsReady, unitId, pageNumber, spreadPageWidth])

  return (
    <div
      ref={captureRef}
      className={cn(
        'relative inline-block shrink-0 grow-0 opacity-100',
        pageArtHidden || bulgeActive
          ? 'overflow-visible bg-transparent'
          : 'overflow-hidden bg-[#FDFCFB]',
      )}
      style={{
        boxSizing: 'border-box',
        width: spreadPageWidth,
        minWidth: spreadPageWidth,
        maxWidth: spreadPageWidth,
        minHeight: pageCanvasHeightPx,
        flexShrink: 0,
        flexGrow: 0,
      }}
    >
      {bulgeActive && pageBulgeSide && !bookSpreadHardcoverGutterOnlyForFrameTuning ? (
        <BookPageStackLayers
          side={pageBulgeSide}
          widthPx={spreadPageWidth}
          heightPx={pageCanvasHeightPx}
        />
      ) : null}
      <div
        className={cn(
          'relative z-[2]',
          pageArtHidden || bulgeActive
            ? 'overflow-visible bg-transparent'
            : 'overflow-hidden bg-[#FDFCFB]',
        )}
        style={{
          width: spreadPageWidth,
          minHeight: pageCanvasHeightPx,
          ...(bulgeActive
            ? { boxShadow: '0 0.5px 2px rgba(35, 22, 12, 0.08)' }
            : {}),
          ...pageArtClipStyle,
        }}
      >
      {!pageArtHidden && bulgeActive && pageArtClipStyle ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            backgroundColor: READER_PAGE_PAPER_COLOR,
            ...pageArtClipStyle,
          }}
        />
      ) : null}
      {!pageArtHidden && showPlaceholder && placeholderSource ? (
        <ReaderPagePlaceholderLayer
          placeholder={placeholderSource}
          spreadPageWidth={spreadPageWidth}
          pageCanvasHeightPx={pageCanvasHeightPx}
          transparentSurface={bulgeActive}
          onPainted={handlePlaceholderPainted}
          clipStyle={bulgeActive ? pageArtClipStyle : undefined}
        />
      ) : null}
      {!pageArtHidden && showSharpCacheLayer ? (
        <div
          className={cn(
            'absolute inset-0 z-[2] flex items-start justify-center overflow-hidden',
            bulgeActive ? 'bg-transparent' : 'bg-[#FDFCFB]',
          )}
          style={bulgeActive ? pageArtClipStyle : undefined}
        >
          <CachedPageCanvas
            bitmap={cacheBitmap}
            cssWidth={spreadPageWidth}
            cssHeight={pageCanvasHeightPx}
            onPainted={handleCachePainted}
          />
        </div>
      ) : null}
      {!pageArtHidden ? (
        <div
          className={cn(
            'relative z-[3]',
            pdfTextLayerActive && 'book-pdf-text-select',
            pdfTextOverCache && 'book-pdf-text-select-over-cache',
            bookReaderLivePdfPrimaryEnabled && 'book-pdf-live-primary',
            pdfHiddenBehindCache && 'pointer-events-none invisible',
          )}
          style={{
            width: spreadPageWidth,
            minHeight: pageCanvasHeightPx,
            ...(bulgeActive ? pageArtClipStyle : undefined),
          }}
        >
          <div
            className={cn(
              pdfUsesScaledLiveRender && 'overflow-hidden',
            )}
            style={
              pdfUsesScaledLiveRender
                ? {
                    width: spreadPageWidth,
                    height: pageCanvasHeightPx,
                  }
                : undefined
            }
          >
            <div
              style={
                pdfUsesScaledLiveRender
                  ? {
                      width: pdfRenderWidthPx,
                      height: pdfRenderHeightPx,
                      transform: `scale(${pdfFitScale})`,
                      transformOrigin: 'top left',
                    }
                  : undefined
              }
            >
              <PdfPage
                key={
                  bookReaderLivePdfPrimaryEnabled
                    ? `rp-${pageNumber}-${pdfRenderWidthPx}`
                    : `rp-${pageNumber}`
                }
                pdf={pdf}
                pageNumber={pageNumber}
                width={pdfRenderWidthPx}
                renderTextLayer={pdfTextLayerActive}
                renderAnnotationLayer={false}
                onLoadSuccess={handlePdfLoadSuccess}
              />
            </div>
          </div>
        </div>
      ) : null}
      </div>
      {!bookSpreadHardcoverGutterOnlyForFrameTuning ? children : null}
    </div>
  )
}

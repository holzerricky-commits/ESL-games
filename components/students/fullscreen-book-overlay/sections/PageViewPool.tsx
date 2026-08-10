'use client'

import type { ComponentType, MutableRefObject, ReactNode } from 'react'
import { useMemo } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { UnitPageBounds } from '@/lib/books/page-range'
import {
  computePooledPageIndices,
  resolvePageViewSlotRole,
} from '@/lib/books/page-view-pool-model'
import { PageView } from '@/components/students/fullscreen-book-overlay/sections/PageView'
import { SpreadCanvasWrapper } from '@/components/books/spread-canvas-wrapper'

export interface PageViewPoolRenderContext {
  pageNumber: number
  slotRole: ReturnType<typeof resolvePageViewSlotRole>['role']
  isActiveSpread: boolean
  captureRef?: MutableRefObject<HTMLDivElement | null>
}

export interface PageViewPoolProps {
  unitId: string
  anchorPage: number
  spreadRightPage: number | null
  visiblePages: number[]
  readerBounds: UnitPageBounds
  spreadPageWidth: number
  spreadOverlayWidthPx: number
  pageCanvasHeightPx: number
  gutterPullPx: number
  pdf: PDFDocumentProxy
  PdfPage: ComponentType<any>
  prefetchRevision: number
  confirmSlotPixelsReady?: boolean
  elevatedSlot?: 'left' | 'right' | null
  onPdfPageLoadSuccess: (page: { originalWidth?: number; originalHeight?: number; width: number; height: number }) => void
  onSlotPixelsReady?: (pageNumber: number, side: 'left' | 'right') => void
  leftCaptureRef: MutableRefObject<HTMLDivElement | null>
  rightCaptureRef: MutableRefObject<HTMLDivElement | null>
  renderPageChrome: (ctx: PageViewPoolRenderContext) => ReactNode
  bookTextSelectActive?: boolean
  pageTextCapability?: ReadonlyMap<number, boolean | 'pending'>
  screenScale?: number
  /** When false, skip page bulge clip, fore-edge stacks, and page chrome shadows. */
  showBookFrame?: boolean
}

/**
 * Phase 2 — maintains a stable sliding window of PageView instances keyed by PDF page index.
 */
export function PageViewPool({
  unitId,
  anchorPage,
  spreadRightPage,
  visiblePages,
  readerBounds,
  spreadPageWidth,
  spreadOverlayWidthPx,
  pageCanvasHeightPx,
  gutterPullPx: _gutterPullPx,
  pdf,
  PdfPage,
  prefetchRevision,
  confirmSlotPixelsReady = true,
  elevatedSlot = null,
  onPdfPageLoadSuccess,
  onSlotPixelsReady,
  leftCaptureRef,
  rightCaptureRef,
  renderPageChrome,
  bookTextSelectActive = false,
  pageTextCapability,
  screenScale = 1,
  showBookFrame = true,
}: PageViewPoolProps) {
  const pooledPages = useMemo(
    () =>
      computePooledPageIndices({
        anchorPage,
        visiblePages,
        readerBounds,
      }),
    [anchorPage, visiblePages, readerBounds],
  )

  return (
    <SpreadCanvasWrapper
      spreadOverlayWidthPx={spreadOverlayWidthPx}
      pageCanvasHeightPx={pageCanvasHeightPx}
    >
      {pooledPages.map((pageNumber) => {
        const { role, isActiveSpread } = resolvePageViewSlotRole(
          pageNumber,
          anchorPage,
          spreadRightPage,
        )
        const captureRef =
          role === 'left' ? leftCaptureRef : role === 'right' ? rightCaptureRef : undefined
        const side = role === 'hidden' ? null : role

        const elevated = role === elevatedSlot

        return (
          <PageView
            key={`page-view-${pageNumber}`}
            unitId={unitId}
            pageNumber={pageNumber}
            spreadPageWidth={spreadPageWidth}
            pageCanvasHeightPx={pageCanvasHeightPx}
            pdfClipLeftPx={0}
            pdf={pdf}
            PdfPage={PdfPage}
            prefetchRevision={prefetchRevision}
            slotRole={role}
            isActiveSpread={isActiveSpread}
            captureRef={captureRef}
            confirmSlotPixelsReady={confirmSlotPixelsReady}
            onPdfPageLoadSuccess={onPdfPageLoadSuccess}
            onSlotPixelsReady={
              side
                ? (p) => onSlotPixelsReady?.(p, side)
                : undefined
            }
            className={elevated ? 'relative z-10' : undefined}
            bookTextSelectActive={bookTextSelectActive}
            pageHasSelectableText={pageTextCapability?.get(pageNumber) === true}
            screenScale={screenScale}
            showBookFrame={showBookFrame}
          >
            {renderPageChrome({ pageNumber, slotRole: role, isActiveSpread, captureRef })}
          </PageView>
        )
      })}
    </SpreadCanvasWrapper>
  )
}

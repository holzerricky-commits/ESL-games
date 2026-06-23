'use client'

import type { ComponentType, CSSProperties, MutableRefObject, ReactNode } from 'react'
import { useMemo, useRef } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { PageViewSlotRole } from '@/lib/books/page-view-pool-model'
import { ReaderPageSlot } from '@/components/students/fullscreen-book-overlay/sections/ReaderPageSlot'
import { cn } from '@/lib/utils'

export interface PageViewProps {
  unitId: string
  pageNumber: number
  spreadPageWidth: number
  pageCanvasHeightPx: number
  pdfClipLeftPx?: number
  pdf: PDFDocumentProxy
  PdfPage: ComponentType<any>
  onPdfPageLoadSuccess: (page: { originalWidth?: number; originalHeight?: number; width: number; height: number }) => void
  prefetchRevision: number
  slotRole: PageViewSlotRole
  isActiveSpread: boolean
  captureRef?: MutableRefObject<HTMLDivElement | null>
  confirmSlotPixelsReady?: boolean
  onSlotPixelsReady?: (pageNumber: number) => void
  className?: string
  style?: CSSProperties
  children: ReactNode
}

/**
 * Phase 2 — stable page view keyed by PDF index. Wraps ReaderPageSlot; visibility and
 * layout are controlled by the pool without remounting when the anchor moves within the window.
 */
export function PageView({
  unitId,
  pageNumber,
  spreadPageWidth,
  pageCanvasHeightPx,
  pdfClipLeftPx = 0,
  pdf,
  PdfPage,
  onPdfPageLoadSuccess,
  prefetchRevision,
  slotRole,
  isActiveSpread,
  captureRef,
  confirmSlotPixelsReady = true,
  onSlotPixelsReady,
  className,
  style,
  children,
}: PageViewProps) {
  const localCaptureRef = useRef<HTMLDivElement | null>(null)
  const resolvedCaptureRef = isActiveSpread && captureRef ? captureRef : localCaptureRef

  const handleSlotPixelsReady = (readyPage: number) => {
    if (!isActiveSpread) return
    onSlotPixelsReady?.(readyPage)
  }

  const warmHidden = slotRole === 'hidden'
  const layoutStyle = useMemo((): CSSProperties => {
    if (warmHidden) {
      return {
        position: 'absolute',
        left: -9999,
        top: 0,
        width: spreadPageWidth,
        minHeight: pageCanvasHeightPx,
        visibility: 'hidden',
        pointerEvents: 'none',
        ...style,
      }
    }
    if (slotRole === 'right') {
      return {
        position: 'relative',
        flexShrink: 0,
        marginLeft: style?.marginLeft,
        ...style,
      }
    }
    if (slotRole === 'left') {
      return {
        position: 'relative',
        flexShrink: 0,
        ...style,
      }
    }
    return style ?? {}
  }, [warmHidden, slotRole, spreadPageWidth, pageCanvasHeightPx, style])

  return (
    <div
      className={cn(warmHidden && 'overflow-hidden', className)}
      style={layoutStyle}
      aria-hidden={warmHidden ? true : undefined}
      data-page-view={pageNumber}
      data-slot-role={slotRole}
    >
      <ReaderPageSlot
        unitId={unitId}
        pageNumber={pageNumber}
        spreadPageWidth={spreadPageWidth}
        pageCanvasHeightPx={pageCanvasHeightPx}
        pdfClipLeftPx={pdfClipLeftPx}
        pdf={pdf}
        PdfPage={PdfPage}
        onPdfPageLoadSuccess={onPdfPageLoadSuccess}
        prefetchRevision={prefetchRevision}
        captureRef={resolvedCaptureRef}
        onSlotPixelsReady={handleSlotPixelsReady}
        confirmSlotPixelsReady={isActiveSpread ? confirmSlotPixelsReady : false}
      >
        {isActiveSpread ? children : null}
      </ReaderPageSlot>
    </div>
  )
}

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
  bookTextSelectActive?: boolean
  pageHasSelectableText?: boolean
  screenScale?: number
  /** When false, rectangular bare pages (no bulge, stacks, or page chrome shadow). */
  showBookFrame?: boolean
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
  bookTextSelectActive = false,
  pageHasSelectableText = false,
  screenScale = 1,
  showBookFrame = true,
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
    const rigidPageBox: CSSProperties = {
      boxSizing: 'border-box',
      width: spreadPageWidth,
      minWidth: spreadPageWidth,
      maxWidth: spreadPageWidth,
      flexShrink: 0,
      flexGrow: 0,
    }

    if (warmHidden) {
      return {
        position: 'absolute',
        left: -9999,
        top: 0,
        minHeight: pageCanvasHeightPx,
        visibility: 'hidden',
        pointerEvents: 'none',
        ...rigidPageBox,
        ...style,
      }
    }
    if (slotRole === 'right') {
      return {
        position: 'relative',
        zIndex: 0,
        ...rigidPageBox,
        ...style,
      }
    }
    if (slotRole === 'left') {
      return {
        position: 'relative',
        zIndex: 1,
        ...rigidPageBox,
        ...style,
      }
    }
    return { ...rigidPageBox, ...(style ?? {}) }
  }, [warmHidden, slotRole, spreadPageWidth, pageCanvasHeightPx, style])

  return (
    <div
      className={cn(
        warmHidden && 'overflow-hidden',
        (slotRole === 'left' || slotRole === 'right') && 'overflow-visible',
        className,
      )}
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
        pageBulgeSide={
          showBookFrame && (slotRole === 'left' || slotRole === 'right')
            ? slotRole
            : undefined
        }
        bookTextSelectActive={bookTextSelectActive}
        pageHasSelectableText={pageHasSelectableText}
        screenScale={screenScale}
      >
        {isActiveSpread ? children : null}
      </ReaderPageSlot>
    </div>
  )
}

'use client'

import type { PointerEvent, RefObject } from 'react'
import { useCallback } from 'react'
import { ReadingCheckQuestionPin } from '@/components/books/reading-check-question-pin'
import { clampLinkCenter } from '@/lib/books/lesson-board-page-links'
import { cn } from '@/lib/utils'

function pointerToNormCenter(event: PointerEvent<HTMLDivElement>): [number, number] | null {
  const rect = event.currentTarget.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  return clampLinkCenter([
    (event.clientX - rect.left) / rect.width,
    (event.clientY - rect.top) / rect.height,
  ])
}

type PagePlacementSurfaceProps = {
  pdfPage: number
  pageWidthPx: number
  pageHeightPx: number
  placementActive: boolean
  preview: { x: number; y: number; label?: string } | null
  onPlace: (pdfPage: number, center: [number, number]) => void
  onPreviewClick?: () => void
}

function PagePlacementSurface({
  pdfPage,
  pageWidthPx,
  pageHeightPx,
  placementActive,
  preview,
  onPlace,
  onPreviewClick,
}: PagePlacementSurfaceProps) {
  const handlePlacementPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!placementActive || event.button !== 0) return
      const center = pointerToNormCenter(event)
      if (!center) return
      event.preventDefault()
      event.stopPropagation()
      onPlace(pdfPage, center)
    },
    [onPlace, pdfPage, placementActive],
  )

  return (
    <div
      className={cn(
        'absolute inset-0',
        placementActive
          ? 'z-[50] pointer-events-auto cursor-crosshair touch-none'
          : preview
            ? 'z-[43] pointer-events-none'
            : 'z-[34] pointer-events-none',
      )}
      style={{ width: pageWidthPx, height: pageHeightPx }}
      onPointerDown={placementActive ? handlePlacementPointerDown : undefined}
    >
      {preview ? (
        <ReadingCheckQuestionPin
          className={cn(
            'absolute -translate-x-1/2 -translate-y-1/2',
            onPreviewClick && !placementActive ? 'pointer-events-auto' : 'pointer-events-none',
          )}
          style={{
            left: `${preview.x * 100}%`,
            top: `${preview.y * 100}%`,
          }}
          label={preview.label}
          onClick={(event) => {
            if (!onPreviewClick || placementActive) return
            event.preventDefault()
            event.stopPropagation()
            onPreviewClick()
          }}
          onPointerDown={(event) => {
            if (!onPreviewClick || placementActive) return
            event.preventDefault()
            event.stopPropagation()
          }}
        />
      ) : null}
    </div>
  )
}

export type ReadingCheckHotspotPlacementLayerProps = {
  pageNumber: number
  spreadRightPage: number | null
  showSpreadRightPage: boolean
  spreadOverlayWidthPx: number
  spreadPageWidthPx: number
  pageCanvasHeightPx: number
  leftPageCaptureRef: RefObject<HTMLDivElement | null>
  rightPageCaptureRef: RefObject<HTMLDivElement | null>
  placementActive: boolean
  /** Preview pin on the matching PDF page (prep after place / while targeting). */
  previewPdfPage: number | null
  previewCenter: [number, number] | null
  previewLabel?: string
  onPlace: (pdfPage: number, center: [number, number]) => void
  onPreviewClick?: () => void
}

export function ReadingCheckHotspotPlacementLayer({
  pageNumber,
  spreadRightPage,
  showSpreadRightPage,
  spreadOverlayWidthPx,
  spreadPageWidthPx,
  pageCanvasHeightPx,
  leftPageCaptureRef: _leftPageCaptureRef,
  rightPageCaptureRef: _rightPageCaptureRef,
  placementActive,
  previewPdfPage,
  previewCenter,
  previewLabel,
  onPlace,
  onPreviewClick,
}: ReadingCheckHotspotPlacementLayerProps) {
  if (!placementActive && (previewPdfPage == null || !previewCenter)) return null

  const leftPreview =
    previewPdfPage === pageNumber && previewCenter
      ? { x: previewCenter[0], y: previewCenter[1], label: previewLabel }
      : null
  const rightPreview =
    showSpreadRightPage &&
    spreadRightPage != null &&
    previewPdfPage === spreadRightPage &&
    previewCenter
      ? { x: previewCenter[0], y: previewCenter[1], label: previewLabel }
      : null

  return (
    <div
      className={cn(
        'absolute inset-0',
        placementActive ? 'pointer-events-auto z-[50]' : 'pointer-events-none z-[43]',
      )}
      style={{ width: spreadOverlayWidthPx, height: pageCanvasHeightPx }}
    >
      <div className="absolute left-0 top-0" style={{ width: spreadPageWidthPx, height: pageCanvasHeightPx }}>
        <PagePlacementSurface
          pdfPage={pageNumber}
          pageWidthPx={spreadPageWidthPx}
          pageHeightPx={pageCanvasHeightPx}
          placementActive={placementActive}
          preview={leftPreview}
          onPlace={onPlace}
          onPreviewClick={onPreviewClick}
        />
      </div>
      {showSpreadRightPage && spreadRightPage != null ? (
        <div
          className="absolute top-0"
          style={{ left: spreadPageWidthPx, width: spreadPageWidthPx, height: pageCanvasHeightPx }}
        >
          <PagePlacementSurface
            pdfPage={spreadRightPage}
            pageWidthPx={spreadPageWidthPx}
            pageHeightPx={pageCanvasHeightPx}
            placementActive={placementActive}
            preview={rightPreview}
            onPlace={onPlace}
            onPreviewClick={onPreviewClick}
          />
        </div>
      ) : null}
    </div>
  )
}

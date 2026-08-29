'use client'

import type { PointerEvent, RefObject } from 'react'
import { useCallback } from 'react'
import { PanelsTopLeft } from 'lucide-react'
import {
  clampLinkCenter,
  lessonBoardPageLinkDisplayLabel,
  listLessonBoardPageLinksForPdfPage,
  type LessonBoardPageLink,
} from '@/lib/books/lesson-board-page-links'
import type { LessonBoardPage } from '@/lib/books/lesson-board-types'
import {
  BookPageLinkChip,
  BOOK_PAGE_LINK_GLYPH_CLASS,
  BOOK_PAGE_LINK_GLYPH_FILL_OPACITY,
  BOOK_PAGE_LINK_GLYPH_STROKE,
} from '@/components/students/fullscreen-book-overlay/sections/BookPageLinkChip'
import { cn } from '@/lib/utils'

type PageMarkerProps = {
  pdfPage: number
  pageWidthPx: number
  pageHeightPx: number
  links: readonly LessonBoardPageLink[]
  boardPages: readonly LessonBoardPage[]
  placementActive: boolean
  markersInteractive: boolean
  onPlaceLink: (pdfPage: number, center: [number, number]) => void
  onOpenLink: (link: LessonBoardPageLink) => void
}

function pointerToNormCenter(
  event: PointerEvent<HTMLDivElement>,
): [number, number] | null {
  const rect = event.currentTarget.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  return clampLinkCenter([
    (event.clientX - rect.left) / rect.width,
    (event.clientY - rect.top) / rect.height,
  ])
}

function PageBoardLinkMarkers({
  pdfPage,
  pageWidthPx,
  pageHeightPx,
  links,
  boardPages,
  placementActive,
  markersInteractive,
  onPlaceLink,
  onOpenLink,
}: PageMarkerProps) {
  const handlePlacementPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!placementActive || event.button !== 0) return
      const center = pointerToNormCenter(event)
      if (!center) return
      event.preventDefault()
      event.stopPropagation()
      onPlaceLink(pdfPage, center)
    },
    [onPlaceLink, pdfPage, placementActive],
  )

  const pageLinks = listLessonBoardPageLinksForPdfPage(links, pdfPage)

  return (
    <div
      className={cn(
        'absolute inset-0',
        placementActive
          ? 'z-[50] pointer-events-auto cursor-crosshair touch-none'
          : markersInteractive
            ? 'z-[42]'
            : 'z-[34] pointer-events-none',
      )}
      style={{ width: pageWidthPx, height: pageHeightPx }}
      onPointerDown={placementActive ? handlePlacementPointerDown : undefined}
    >
      {!placementActive
        ? pageLinks.map((link) => {
            const label = lessonBoardPageLinkDisplayLabel(link, boardPages)
            return (
              <BookPageLinkChip
                key={link.id}
                tone="board"
                interactive={markersInteractive}
                className="board-page-link-marker absolute -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${link.center[0] * 100}%`,
                  top: `${link.center[1] * 100}%`,
                }}
                title={label}
                aria-label={`Open board: ${label}`}
                onPointerDown={(event) => {
                  if (!markersInteractive) return
                  event.preventDefault()
                  event.stopPropagation()
                }}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  if (!markersInteractive) return
                  onOpenLink(link)
                }}
              >
                <PanelsTopLeft
                  className={BOOK_PAGE_LINK_GLYPH_CLASS}
                  strokeWidth={BOOK_PAGE_LINK_GLYPH_STROKE}
                  fill="currentColor"
                  fillOpacity={BOOK_PAGE_LINK_GLYPH_FILL_OPACITY}
                  aria-hidden
                />
              </BookPageLinkChip>
            )
          })
        : null}
    </div>
  )
}

export type BoardPageLinkMarkersProps = {
  pageNumber: number
  spreadRightPage: number | null
  showSpreadRightPage: boolean
  spreadOverlayWidthPx: number
  spreadPageWidthPx: number
  pageCanvasHeightPx: number
  leftPageCaptureRef: RefObject<HTMLDivElement | null>
  rightPageCaptureRef: RefObject<HTMLDivElement | null>
  links: readonly LessonBoardPageLink[]
  boardPages: readonly LessonBoardPage[]
  placementActive: boolean
  markersInteractive: boolean
  onPlaceLink: (pdfPage: number, center: [number, number]) => void
  onOpenLink: (link: LessonBoardPageLink) => void
}

export function BoardPageLinkMarkers({
  pageNumber,
  spreadRightPage,
  showSpreadRightPage,
  spreadOverlayWidthPx,
  spreadPageWidthPx,
  pageCanvasHeightPx,
  leftPageCaptureRef: _leftPageCaptureRef,
  rightPageCaptureRef: _rightPageCaptureRef,
  links,
  boardPages,
  placementActive,
  markersInteractive,
  onPlaceLink,
  onOpenLink,
}: BoardPageLinkMarkersProps) {
  return (
    <div
      className={cn(
        'absolute inset-0',
        placementActive
          ? 'pointer-events-auto z-[50]'
          : markersInteractive
            ? 'pointer-events-none z-[42]'
            : 'pointer-events-none z-[34]',
      )}
      style={{ width: spreadOverlayWidthPx, height: pageCanvasHeightPx }}
    >
      <div className="absolute left-0 top-0" style={{ width: spreadPageWidthPx, height: pageCanvasHeightPx }}>
        <PageBoardLinkMarkers
          pdfPage={pageNumber}
          pageWidthPx={spreadPageWidthPx}
          pageHeightPx={pageCanvasHeightPx}
          links={links}
          boardPages={boardPages}
          placementActive={placementActive}
          markersInteractive={markersInteractive}
          onPlaceLink={onPlaceLink}
          onOpenLink={onOpenLink}
        />
      </div>
      {showSpreadRightPage && spreadRightPage != null ? (
        <div
          className="absolute top-0"
          style={{ left: spreadPageWidthPx, width: spreadPageWidthPx, height: pageCanvasHeightPx }}
        >
          <PageBoardLinkMarkers
            pdfPage={spreadRightPage}
            pageWidthPx={spreadPageWidthPx}
            pageHeightPx={pageCanvasHeightPx}
            links={links}
            boardPages={boardPages}
            placementActive={placementActive}
            markersInteractive={markersInteractive}
            onPlaceLink={onPlaceLink}
            onOpenLink={onOpenLink}
          />
        </div>
      ) : null}
    </div>
  )
}

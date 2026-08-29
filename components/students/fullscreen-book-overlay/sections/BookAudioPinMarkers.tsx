'use client'

import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { Volume2 } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  clampAudioPinCenter,
  listBookAudioPinsForPdfPage,
  type BookAudioPin,
  type BookAudioTrack,
} from '@/lib/books/book-audio'
import { clientToSpreadNorm } from '@/lib/books/spread-canvas-coords'
import {
  BookPageLinkChip,
  BOOK_PAGE_LINK_GLYPH_CLASS,
  BOOK_PAGE_LINK_GLYPH_FILL_OPACITY,
  BOOK_PAGE_LINK_GLYPH_STROKE,
} from '@/components/students/fullscreen-book-overlay/sections/BookPageLinkChip'
import { cn } from '@/lib/utils'

const DRAG_THRESHOLD_PX = 4

type PageSlot = {
  pdfPage: number
  leftPx: number
  widthPx: number
  heightPx: number
}

function normInVisualRect(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
): [number, number] | null {
  if (!(rect.width > 0) || !(rect.height > 0)) return null
  const nx = (clientX - rect.left) / rect.width
  const ny = (clientY - rect.top) / rect.height
  if (nx < -0.05 || nx > 1.05 || ny < -0.05 || ny > 1.05) return null
  return clampAudioPinCenter([nx, ny])
}

function pickHitFromPageRects(
  clientX: number,
  clientY: number,
  pages: { pdfPage: number; el: HTMLElement }[],
): { pdfPage: number; center: [number, number] } | null {
  const hits: { pdfPage: number; center: [number, number]; inward: number }[] = []
  for (const page of pages) {
    const center = normInVisualRect(clientX, clientY, page.el.getBoundingClientRect())
    if (!center) continue
    const inward = Math.min(center[0], 1 - center[0], center[1], 1 - center[1])
    hits.push({ pdfPage: page.pdfPage, center, inward })
  }
  if (hits.length === 0) return null
  hits.sort((a, b) => b.inward - a.inward)
  const best = hits[0]!
  return { pdfPage: best.pdfPage, center: best.center }
}

function pickHitFromOverlay(
  clientX: number,
  clientY: number,
  slots: PageSlot[],
  overlayRect: DOMRect,
  overlayWidthPx: number,
  overlayHeightPx: number,
): { pdfPage: number; center: [number, number] } | null {
  if (!(overlayWidthPx > 0) || !(overlayHeightPx > 0) || !slots.length) return null
  const [sx, sy] = clientToSpreadNorm(overlayRect, clientX, clientY)
  const layoutX = sx * overlayWidthPx
  const layoutY = sy * overlayHeightPx
  for (const slot of slots) {
    if (!(slot.widthPx > 0) || !(slot.heightPx > 0)) continue
    const localX = layoutX - slot.leftPx
    const localY = layoutY
    if (localX < -8 || localX > slot.widthPx + 8 || localY < -8 || localY > slot.heightPx + 8) {
      continue
    }
    return {
      pdfPage: slot.pdfPage,
      center: clampAudioPinCenter([localX / slot.widthPx, localY / slot.heightPx]),
    }
  }
  let best = slots[0]!
  let bestDist = Infinity
  for (const slot of slots) {
    const mid = slot.leftPx + slot.widthPx / 2
    const dist = Math.abs(layoutX - mid)
    if (dist < bestDist) {
      bestDist = dist
      best = slot
    }
  }
  if (!(best.widthPx > 0) || !(best.heightPx > 0)) return null
  return {
    pdfPage: best.pdfPage,
    center: clampAudioPinCenter([
      (layoutX - best.leftPx) / best.widthPx,
      layoutY / best.heightPx,
    ]),
  }
}

type DragState = {
  pinId: string
  startX: number
  startY: number
  moved: boolean
  pdfPage: number
  center: [number, number]
}

export type BookAudioPinMarkersProps = {
  pageNumber: number
  spreadRightPage: number | null
  showSpreadRightPage: boolean
  spreadOverlayWidthPx: number
  spreadPageWidthPx: number
  pageCanvasHeightPx: number
  leftPageCaptureRef: RefObject<HTMLDivElement | null>
  rightPageCaptureRef: RefObject<HTMLDivElement | null>
  pins: readonly BookAudioPin[]
  tracks: readonly BookAudioTrack[]
  placementActive: boolean
  markersInteractive: boolean
  playingTrackId: string | null
  isPlaying: boolean
  onPlacePin: (pdfPage: number, center: [number, number]) => void
  onPlayPin: (pin: BookAudioPin) => void
  onRemovePin?: (pin: BookAudioPin) => void
  onMovePin: (pin: BookAudioPin, pdfPage: number, center: [number, number]) => void
}

export function BookAudioPinMarkers({
  pageNumber,
  spreadRightPage,
  showSpreadRightPage,
  spreadOverlayWidthPx,
  spreadPageWidthPx,
  pageCanvasHeightPx,
  leftPageCaptureRef,
  rightPageCaptureRef,
  pins,
  tracks,
  placementActive,
  markersInteractive,
  playingTrackId,
  isPlaying,
  onPlacePin,
  onPlayPin,
  onRemovePin,
  onMovePin,
}: BookAudioPinMarkersProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const tracksById = new Map(tracks.map((track) => [track.id, track]))

  const slots: PageSlot[] = useMemo(() => {
    const next: PageSlot[] = [
      { pdfPage: pageNumber, leftPx: 0, widthPx: spreadPageWidthPx, heightPx: pageCanvasHeightPx },
    ]
    if (showSpreadRightPage && spreadRightPage != null) {
      next.push({
        pdfPage: spreadRightPage,
        leftPx: spreadPageWidthPx,
        widthPx: spreadPageWidthPx,
        heightPx: pageCanvasHeightPx,
      })
    }
    return next
  }, [pageNumber, pageCanvasHeightPx, showSpreadRightPage, spreadPageWidthPx, spreadRightPage])

  const pickHit = useCallback(
    (clientX: number, clientY: number) => {
      const pages: { pdfPage: number; el: HTMLElement }[] = []
      const leftEl = leftPageCaptureRef.current
      const rightEl = rightPageCaptureRef.current
      if (leftEl) pages.push({ pdfPage: pageNumber, el: leftEl })
      if (showSpreadRightPage && spreadRightPage != null && rightEl) {
        pages.push({ pdfPage: spreadRightPage, el: rightEl })
      }
      const fromPages = pickHitFromPageRects(clientX, clientY, pages)
      if (fromPages) return fromPages
      const root = rootRef.current
      if (!root) return null
      return pickHitFromOverlay(
        clientX,
        clientY,
        slots,
        root.getBoundingClientRect(),
        spreadOverlayWidthPx,
        pageCanvasHeightPx,
      )
    },
    [
      leftPageCaptureRef,
      pageCanvasHeightPx,
      pageNumber,
      rightPageCaptureRef,
      showSpreadRightPage,
      slots,
      spreadOverlayWidthPx,
      spreadRightPage,
    ],
  )

  const handlePlacementPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!placementActive || event.button !== 0) return
      const hit = pickHit(event.clientX, event.clientY)
      if (!hit) return
      event.preventDefault()
      event.stopPropagation()
      onPlacePin(hit.pdfPage, hit.center)
    },
    [onPlacePin, pickHit, placementActive],
  )

  const beginPinDrag = useCallback(
    (pin: BookAudioPin, event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!markersInteractive || event.button !== 0) return
      event.preventDefault()
      event.stopPropagation()

      const next: DragState = {
        pinId: pin.id,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        pdfPage: pin.pdfPage,
        center: pin.center,
      }
      dragRef.current = next
      setDrag(next)

      const onMove = (moveEvent: PointerEvent) => {
        const current = dragRef.current
        if (!current) return
        const dx = moveEvent.clientX - current.startX
        const dy = moveEvent.clientY - current.startY
        const moved = current.moved || Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX
        const hit = pickHit(moveEvent.clientX, moveEvent.clientY)
        const updated: DragState = {
          ...current,
          moved,
          pdfPage: hit?.pdfPage ?? current.pdfPage,
          center: hit?.center ?? current.center,
        }
        dragRef.current = updated
        setDrag(updated)
      }

      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
        const current = dragRef.current
        dragRef.current = null
        setDrag(null)
        if (!current) return
        if (current.moved) {
          onMovePin(pin, current.pdfPage, current.center)
        } else {
          onPlayPin(pin)
        }
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    },
    [markersInteractive, onMovePin, onPlayPin, pickHit],
  )

  const visiblePins = pins.filter((pin) =>
    slots.some((slot) => slot.pdfPage === pin.pdfPage),
  )

  return (
    <div
      ref={rootRef}
      className={cn(
        'absolute inset-0',
        placementActive
          ? 'pointer-events-auto z-[50] cursor-crosshair touch-none'
          : markersInteractive
            ? 'pointer-events-none z-[43]'
            : 'pointer-events-none z-[35]',
      )}
      style={{ width: spreadOverlayWidthPx, height: pageCanvasHeightPx }}
      onPointerDown={placementActive ? handlePlacementPointerDown : undefined}
    >
      {visiblePins.map((pin) => {
            const track = tracksById.get(pin.trackId)
            const title = track?.title ?? 'Audio track'
            const live = pin.trackId === playingTrackId && isPlaying
            const dragging = drag?.pinId === pin.id
            const displayPage = dragging ? drag.pdfPage : pin.pdfPage
            const displayCenter = dragging ? drag.center : pin.center
            const slot = slots.find((s) => s.pdfPage === displayPage) ?? slots[0]
            if (!slot) return null
            const leftPx = slot.leftPx + displayCenter[0] * slot.widthPx
            const topPx = displayCenter[1] * slot.heightPx

            return (
              <div
                key={pin.id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: leftPx,
                  top: topPx,
                  zIndex: dragging ? 60 : undefined,
                }}
              >
                <ContextMenu>
                  <ContextMenuTrigger asChild disabled={!markersInteractive || placementActive}>
                    <BookPageLinkChip
                      tone="audio"
                      live={live}
                      interactive={markersInteractive && !placementActive}
                      className={cn(
                        'cursor-grab active:cursor-grabbing',
                        dragging && 'scale-110 brightness-110',
                        placementActive && 'pointer-events-none',
                      )}
                      title={`${title} — drag to move · right-click to remove`}
                      aria-label={`Play or move ${title}`}
                      onPointerDown={(event) => beginPinDrag(pin, event)}
                    >
                      <Volume2
                        className={BOOK_PAGE_LINK_GLYPH_CLASS}
                        strokeWidth={BOOK_PAGE_LINK_GLYPH_STROKE}
                        fill="currentColor"
                        fillOpacity={BOOK_PAGE_LINK_GLYPH_FILL_OPACITY}
                        aria-hidden
                      />
                    </BookPageLinkChip>
                  </ContextMenuTrigger>
                  {onRemovePin ? (
                    <ContextMenuContent className="min-w-[10rem]">
                      <ContextMenuItem
                        variant="destructive"
                        onSelect={() => onRemovePin(pin)}
                      >
                        Remove from book
                      </ContextMenuItem>
                    </ContextMenuContent>
                  ) : null}
                </ContextMenu>
              </div>
            )
          })}
    </div>
  )
}

/** Kept for any leftover imports of the page helper; prefer BookAudioPinMarkers. */
export function listPinsOnPage(pins: readonly BookAudioPin[], pdfPage: number) {
  return listBookAudioPinsForPdfPage(pins, pdfPage)
}

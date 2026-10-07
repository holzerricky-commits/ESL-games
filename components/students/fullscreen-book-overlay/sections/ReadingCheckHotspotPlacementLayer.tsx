'use client'

import type { PointerEvent, RefObject } from 'react'
import { useCallback, useRef, useState } from 'react'
import {
  ReadingCheckQuestionPin,
  type ReadingCheckQuestionPinTone,
} from '@/components/books/reading-check-question-pin'
import { clampLinkCenter } from '@/lib/books/lesson-board-page-links'
import { cn } from '@/lib/utils'

const DRAG_THRESHOLD_PX = 5

function pointerToNormCenter(event: PointerEvent<HTMLDivElement>): [number, number] | null {
  const rect = event.currentTarget.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  return clampLinkCenter([
    (event.clientX - rect.left) / rect.width,
    (event.clientY - rect.top) / rect.height,
  ])
}

export type ReadingCheckLivePin = {
  id: string
  pdfPage: number
  x: number
  y: number
  label: string
  tone: ReadingCheckQuestionPinTone
}

export type ReadingCheckLivePinMove = {
  stopId: string
  pdfPage: number
  center: [number, number]
  pageSide: 'left' | 'right'
}

type PinDrag = {
  stopId: string
  startX: number
  startY: number
  moved: boolean
  pdfPage: number
  pageSide: 'left' | 'right'
  x: number
  y: number
}

type PagePlacementSurfaceProps = {
  pdfPage: number
  pageWidthPx: number
  pageHeightPx: number
  placementActive: boolean
  preview: { x: number; y: number; label?: string } | null
  livePins: readonly ReadingCheckLivePin[]
  livePinsInteractive: boolean
  livePinsMovable: boolean
  onPlace?: (pdfPage: number, center: [number, number]) => void
  onPreviewClick?: () => void
  onLivePinClick?: (stopId: string) => void
  onLivePinDragStart?: (pin: ReadingCheckLivePin, event: PointerEvent<HTMLButtonElement>) => void
}

function PagePlacementSurface({
  pdfPage,
  pageWidthPx,
  pageHeightPx,
  placementActive,
  preview,
  livePins,
  livePinsInteractive,
  livePinsMovable,
  onPlace,
  onPreviewClick,
  onLivePinClick,
  onLivePinDragStart,
}: PagePlacementSurfaceProps) {
  const handlePlacementPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!placementActive || !onPlace || event.button !== 0) return
      const center = pointerToNormCenter(event)
      if (!center) return
      event.preventDefault()
      event.stopPropagation()
      onPlace(pdfPage, center)
    },
    [onPlace, pdfPage, placementActive],
  )

  const pageLivePins = livePins.filter((pin) => pin.pdfPage === pdfPage)
  const showLivePins = !placementActive && pageLivePins.length > 0

  return (
    <div
      className={cn(
        'absolute inset-0',
        placementActive
          ? 'z-[50] pointer-events-auto cursor-crosshair touch-none'
          : preview || showLivePins
            ? 'z-[43] pointer-events-none'
            : 'z-[34] pointer-events-none',
      )}
      style={{ width: pageWidthPx, height: pageHeightPx }}
      onPointerDown={placementActive ? handlePlacementPointerDown : undefined}
    >
      {showLivePins
        ? pageLivePins.map((pin) => (
            <ReadingCheckQuestionPin
              key={pin.id}
              tone={pin.tone}
              className={cn(
                'absolute -translate-x-1/2 -translate-y-1/2',
                livePinsInteractive ? 'pointer-events-auto' : 'pointer-events-none',
                livePinsMovable && 'cursor-grab touch-none active:cursor-grabbing',
              )}
              style={{
                left: `${pin.x * 100}%`,
                top: `${pin.y * 100}%`,
              }}
              label={pin.label}
              onClick={(event) => {
                if (!livePinsInteractive || !onLivePinClick || livePinsMovable) return
                event.preventDefault()
                event.stopPropagation()
                onLivePinClick(pin.id)
              }}
              onPointerDown={(event) => {
                if (!livePinsInteractive) return
                event.preventDefault()
                event.stopPropagation()
                if (livePinsMovable && event.button === 0) onLivePinDragStart?.(pin, event)
              }}
            />
          ))
        : null}
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
  onPlace?: (pdfPage: number, center: [number, number]) => void
  onPreviewClick?: () => void
  livePins?: readonly ReadingCheckLivePin[]
  livePinsInteractive?: boolean
  onLivePinClick?: (stopId: string) => void
  /** Select and move tool: drag pins; a tap without dragging still opens the check. */
  livePinsMovable?: boolean
  onLivePinMove?: (move: ReadingCheckLivePinMove) => void
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
  livePins = [],
  livePinsInteractive = false,
  onLivePinClick,
  livePinsMovable = false,
  onLivePinMove,
}: ReadingCheckHotspotPlacementLayerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<PinDrag | null>(null)
  const [drag, setDrag] = useState<PinDrag | null>(null)
  const hasRightPage = showSpreadRightPage && spreadRightPage != null
  const canMove = livePinsMovable && livePinsInteractive && Boolean(onLivePinMove)

  const pointToPage = useCallback(
    (clientX: number, clientY: number): Pick<PinDrag, 'pdfPage' | 'pageSide' | 'x' | 'y'> | null => {
      const root = rootRef.current
      if (!root || spreadPageWidthPx <= 0 || pageCanvasHeightPx <= 0) return null
      const rect = root.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return null
      const layoutX = ((clientX - rect.left) / rect.width) * spreadOverlayWidthPx
      const layoutY = ((clientY - rect.top) / rect.height) * pageCanvasHeightPx
      const onRight = hasRightPage && layoutX >= spreadPageWidthPx
      const pageLeftPx = onRight ? spreadPageWidthPx : 0
      const [x, y] = clampLinkCenter([
        (layoutX - pageLeftPx) / spreadPageWidthPx,
        layoutY / pageCanvasHeightPx,
      ])
      return {
        pdfPage: onRight ? spreadRightPage! : pageNumber,
        pageSide: onRight ? 'right' : 'left',
        x,
        y,
      }
    },
    [hasRightPage, pageCanvasHeightPx, pageNumber, spreadOverlayWidthPx, spreadPageWidthPx, spreadRightPage],
  )

  const beginPinDrag = useCallback(
    (pin: ReadingCheckLivePin, event: PointerEvent<HTMLButtonElement>) => {
      if (!canMove) return
      const start: PinDrag = {
        stopId: pin.id,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        pdfPage: pin.pdfPage,
        pageSide: hasRightPage && pin.pdfPage === spreadRightPage ? 'right' : 'left',
        x: pin.x,
        y: pin.y,
      }
      dragRef.current = start
      setDrag(start)

      const onPointerMove = (moveEvent: globalThis.PointerEvent) => {
        const current = dragRef.current
        if (!current) return
        const moved =
          current.moved ||
          Math.hypot(moveEvent.clientX - current.startX, moveEvent.clientY - current.startY) >=
            DRAG_THRESHOLD_PX
        const hit = pointToPage(moveEvent.clientX, moveEvent.clientY)
        const next: PinDrag = { ...current, moved, ...(moved && hit ? hit : {}) }
        dragRef.current = next
        setDrag(next)
      }

      const onPointerUp = () => {
        window.removeEventListener('pointermove', onPointerMove)
        window.removeEventListener('pointerup', onPointerUp)
        window.removeEventListener('pointercancel', onPointerUp)
        const current = dragRef.current
        dragRef.current = null
        setDrag(null)
        if (!current) return
        if (current.moved) {
          onLivePinMove?.({
            stopId: current.stopId,
            pdfPage: current.pdfPage,
            center: [current.x, current.y],
            pageSide: current.pageSide,
          })
          return
        }
        onLivePinClick?.(current.stopId)
      }

      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp)
      window.addEventListener('pointercancel', onPointerUp)
    },
    [canMove, hasRightPage, onLivePinClick, onLivePinMove, pointToPage, spreadRightPage],
  )

  const hasPreview = previewPdfPage != null && previewCenter != null
  if (!placementActive && !hasPreview && livePins.length === 0) return null

  const shownPins = drag
    ? livePins.map((pin) =>
        pin.id === drag.stopId ? { ...pin, pdfPage: drag.pdfPage, x: drag.x, y: drag.y } : pin,
      )
    : livePins

  const leftPreview =
    previewPdfPage === pageNumber && previewCenter
      ? { x: previewCenter[0], y: previewCenter[1], label: previewLabel }
      : null
  const rightPreview =
    hasRightPage && previewPdfPage === spreadRightPage && previewCenter
      ? { x: previewCenter[0], y: previewCenter[1], label: previewLabel }
      : null

  return (
    <div
      ref={rootRef}
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
          livePins={shownPins}
          livePinsInteractive={livePinsInteractive}
          livePinsMovable={canMove}
          onPlace={onPlace}
          onPreviewClick={onPreviewClick}
          onLivePinClick={onLivePinClick}
          onLivePinDragStart={beginPinDrag}
        />
      </div>
      {hasRightPage ? (
        <div
          className="absolute top-0"
          style={{ left: spreadPageWidthPx, width: spreadPageWidthPx, height: pageCanvasHeightPx }}
        >
          <PagePlacementSurface
            pdfPage={spreadRightPage!}
            pageWidthPx={spreadPageWidthPx}
            pageHeightPx={pageCanvasHeightPx}
            placementActive={placementActive}
            preview={rightPreview}
            livePins={shownPins}
            livePinsInteractive={livePinsInteractive}
            livePinsMovable={canMove}
            onPlace={onPlace}
            onPreviewClick={onPreviewClick}
            onLivePinClick={onLivePinClick}
            onLivePinDragStart={beginPinDrag}
          />
        </div>
      ) : null}
    </div>
  )
}

'use client'

import { useCallback, useRef, useState, type PointerEvent } from 'react'
import {
  ReadingCheckQuestionPin,
} from '@/components/books/reading-check-question-pin'
import { clampLinkCenter } from '@/lib/books/lesson-board-page-links'
import type { ReadingCheckLivePinOnSpread } from '@/lib/books/reading-check-pack'
import { cn } from '@/lib/utils'

const DRAG_THRESHOLD_PX = 5

function pointerToNormCenter(event: PointerEvent<HTMLElement>, target: HTMLElement): [number, number] | null {
  const rect = target.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  return clampLinkCenter([
    (event.clientX - rect.left) / rect.width,
    (event.clientY - rect.top) / rect.height,
  ])
}

export type BookPartCheckPinOverlayProps = {
  pdfPage: number
  pageSide: 'left' | 'right'
  placementActive: boolean
  livePins: readonly ReadingCheckLivePinOnSpread[]
  activeStopId: string | null
  onPlace?: (pdfPage: number, center: [number, number], pageSide: 'left' | 'right') => void
  onMovePin?: (
    stopId: string,
    pdfPage: number,
    center: [number, number],
    pageSide: 'left' | 'right',
  ) => void
  onSelectStop?: (stopId: string) => void
}

export function BookPartCheckPinOverlay({
  pdfPage,
  pageSide,
  placementActive,
  livePins,
  activeStopId,
  onPlace,
  onMovePin,
  onSelectStop,
}: BookPartCheckPinOverlayProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    stopId: string
    startX: number
    startY: number
    x: number
    y: number
    moved: boolean
  } | null>(null)
  const [drag, setDrag] = useState<{ stopId: string; x: number; y: number } | null>(null)

  const pagePins = livePins.filter((pin) => pin.pdfPage === pdfPage)

  const handlePlace = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!placementActive || !onPlace || event.button !== 0) return
      const root = rootRef.current
      if (!root) return
      const center = pointerToNormCenter(event, root)
      if (!center) return
      event.preventDefault()
      event.stopPropagation()
      onPlace(pdfPage, center, pageSide)
    },
    [onPlace, pageSide, pdfPage, placementActive],
  )

  return (
    <div
      ref={rootRef}
      className={cn(
        'absolute inset-0 z-10',
        placementActive ? 'cursor-crosshair touch-none' : 'pointer-events-none',
      )}
      onPointerDown={placementActive ? handlePlace : undefined}
    >
      {pagePins.map((pin) => {
        const isActive = pin.stop.id === activeStopId
        const dragging = drag?.stopId === pin.stop.id
        const x = dragging ? drag.x : pin.x
        const y = dragging ? drag.y : pin.y
        return (
          <ReadingCheckQuestionPin
            key={pin.stop.id}
            className={cn(
              'absolute -translate-x-1/2 -translate-y-1/2 touch-none',
              placementActive ? 'pointer-events-none' : 'pointer-events-auto',
              isActive ? 'ring-2 ring-[var(--brand-blue)] ring-offset-1' : 'opacity-90',
            )}
            style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
            label={pin.stop.label.trim() || `Check ${pin.index + 1}`}
            aria-current={isActive ? 'true' : undefined}
            onPointerDown={(event) => {
              if (event.button !== 0) return
              event.preventDefault()
              event.stopPropagation()
              event.currentTarget.setPointerCapture(event.pointerId)
              dragRef.current = {
                stopId: pin.stop.id,
                startX: event.clientX,
                startY: event.clientY,
                x: pin.x,
                y: pin.y,
                moved: false,
              }
              setDrag({ stopId: pin.stop.id, x: pin.x, y: pin.y })
            }}
            onPointerMove={(event) => {
              const current = dragRef.current
              if (!current || current.stopId !== pin.stop.id) return
              const root = rootRef.current
              if (!root) return
              const center = pointerToNormCenter(event, root)
              if (!center) return
              current.x = center[0]
              current.y = center[1]
              current.moved =
                current.moved ||
                Math.hypot(event.clientX - current.startX, event.clientY - current.startY) >=
                  DRAG_THRESHOLD_PX
              setDrag({ stopId: current.stopId, x: current.x, y: current.y })
            }}
            onPointerUp={(event) => {
              const current = dragRef.current
              if (!current || current.stopId !== pin.stop.id) return
              event.preventDefault()
              event.stopPropagation()
              event.currentTarget.releasePointerCapture(event.pointerId)
              dragRef.current = null
              setDrag(null)
              if (current.moved) {
                onMovePin?.(current.stopId, pdfPage, [current.x, current.y], pageSide)
                return
              }
              onSelectStop?.(current.stopId)
            }}
            onPointerCancel={() => {
              dragRef.current = null
              setDrag(null)
            }}
          />
        )
      })}
    </div>
  )
}

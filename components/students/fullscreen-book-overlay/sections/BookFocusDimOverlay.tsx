'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { FocusHoleRect } from '@/lib/books/focus-zoom-types'
import {
  FocusZoomControlBar,
  FocusZoomSelectionFrame,
  FocusZoomTheaterScrim,
} from '@/components/students/fullscreen-book-overlay/sections/BookFocusZoomChrome'

/** Corner frame on the focus hole (lives in pageArea coordinates). */
export function BookFocusHoleFrame({ holeRect }: { holeRect: FocusHoleRect }) {
  return <FocusZoomSelectionFrame rect={holeRect} className="z-[63]" variant="presentation" />
}

export interface BookFocusTheaterLayerProps {
  holeRect: FocusHoleRect
  pageAreaRef: React.RefObject<HTMLElement | null>
  overlayRef: React.RefObject<HTMLElement | null>
  onExit: () => void
  onNewArea?: () => void
  onPanDelta?: (dx: number, dy: number) => void
  onExportRegion?: () => void
  exportBusy?: boolean
}

/** Full-overlay theater scrim + pan + controls (must sit on overlay root, not inside transformed book stage). */
export function BookFocusTheaterLayer({
  holeRect,
  pageAreaRef,
  overlayRef,
  onExit,
  onNewArea,
  onPanDelta,
  onExportRegion,
  exportBusy = false,
}: BookFocusTheaterLayerProps) {
  const dragRef = useRef<{ x: number; y: number } | null>(null)
  const [spaceHeld, setSpaceHeld] = useState(false)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        const t = e.target as HTMLElement | null
        if (t?.closest('input, textarea, [contenteditable="true"]')) return
        e.preventDefault()
        setSpaceHeld(true)
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpaceHeld(false)
        dragRef.current = null
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  const onSpacePanPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!spaceHeld || !onPanDelta || e.button !== 0) return
      e.preventDefault()
      const el = overlayRef.current
      if (!el) return
      el.setPointerCapture(e.pointerId)
      dragRef.current = { x: e.clientX, y: e.clientY }
    },
    [onPanDelta, overlayRef, spaceHeld],
  )

  const onSpacePanPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!spaceHeld || !onPanDelta) return
      const start = dragRef.current
      if (!start) return
      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
      if (dx !== 0 || dy !== 0) {
        onPanDelta(dx, dy)
        dragRef.current = { x: e.clientX, y: e.clientY }
      }
    },
    [onPanDelta, spaceHeld],
  )

  const onSpacePanPointerUp = useCallback((e: React.PointerEvent) => {
    overlayRef.current?.releasePointerCapture?.(e.pointerId)
    dragRef.current = null
  }, [overlayRef])

  return (
    <>
      <FocusZoomTheaterScrim
        pageAreaRef={pageAreaRef}
        overlayRef={overlayRef}
        hole={holeRect}
        onBackdropClick={onExit}
        pointerEventsDisabled={spaceHeld}
        className="absolute inset-0 z-[24]"
      />
      {spaceHeld && onPanDelta ? (
        <div
          className="absolute inset-0 z-[25] cursor-grab active:cursor-grabbing"
          aria-hidden
          onPointerDown={onSpacePanPointerDown}
          onPointerMove={onSpacePanPointerMove}
          onPointerUp={onSpacePanPointerUp}
          onPointerCancel={onSpacePanPointerUp}
        />
      ) : null}
      <FocusZoomControlBar
        className="pointer-events-none absolute inset-x-0 bottom-4 z-[68]"
        presentation
        onExit={onExit}
        onNewArea={onNewArea}
        onSaveImage={onExportRegion}
        saveBusy={exportBusy}
        panHint={
          spaceHeld ? 'Panning — release Space when done' : undefined
        }
      />
    </>
  )
}

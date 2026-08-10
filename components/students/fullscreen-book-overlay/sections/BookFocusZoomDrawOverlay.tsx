'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { spreadNormRectFromClientDrag } from '@/lib/books/focus-zoom-transform'
import type { SpreadNormRect } from '@/lib/books/focus-zoom-types'
import {
  FOCUS_ZOOM_DRAW_VEIL,
  FocusZoomDrawCancelBar,
  FocusZoomDrawHint,
  FocusZoomSelectionFrame,
  FocusZoomSpotlightBackdrop,
} from '@/components/students/fullscreen-book-overlay/sections/BookFocusZoomChrome'

export interface BookFocusZoomDrawOverlayProps {
  open: boolean
  spreadGridRef: React.RefObject<HTMLElement | null>
  onCancel: () => void
  onConfirm: (rect: SpreadNormRect) => void
}

type Point = { x: number; y: number }

export function BookFocusZoomDrawOverlay({
  open,
  spreadGridRef,
  onCancel,
  onConfirm,
}: BookFocusZoomDrawOverlayProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [dragging, setDragging] = useState(false)
  const [start, setStart] = useState<Point | null>(null)
  const [current, setCurrent] = useState<Point | null>(null)

  const reset = useCallback(() => {
    setDragging(false)
    setStart(null)
    setCurrent(null)
  }, [])

  useEffect(() => {
    if (!open) reset()
  }, [open, reset])

  const clientToLocal = useCallback((clientX: number, clientY: number): Point | null => {
    const el = rootRef.current
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: clientX - r.left, y: clientY - r.top }
  }, [])

  const previewRect = start && current ? normalizeRect(start, current) : null
  const previewHole =
    previewRect && previewRect.width >= 2 && previewRect.height >= 2
      ? { x: previewRect.x, y: previewRect.y, w: previewRect.width, h: previewRect.height }
      : null

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        reset()
        onCancel()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, open, reset])

  const onPointerDown = (e: React.PointerEvent) => {
    if (!open) return
    e.preventDefault()
    const p = clientToLocal(e.clientX, e.clientY)
    if (!p) return
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    setDragging(true)
    setStart(p)
    setCurrent(p)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return
    const p = clientToLocal(e.clientX, e.clientY)
    if (p) setCurrent(p)
  }

  const endDrag = (e: React.PointerEvent) => {
    if (!dragging || !start || !current) return
    ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
    setDragging(false)
    const spreadEl = spreadGridRef.current
    const rootEl = rootRef.current
    if (!spreadEl || !rootEl) return
    const spreadRect = spreadEl.getBoundingClientRect()
    const rootRect = rootEl.getBoundingClientRect()
    const norm = spreadNormRectFromClientDrag(
      spreadRect,
      rootRect.left + start.x,
      rootRect.top + start.y,
      rootRect.left + current.x,
      rootRect.top + current.y,
    )
    if (norm) {
      onConfirm(norm)
      reset()
    }
  }

  if (!open) return null

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 z-[68] touch-none cursor-crosshair"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {previewHole ? (
        <FocusZoomSpotlightBackdrop
          areaRef={rootRef}
          hole={previewHole}
          dimClassName={FOCUS_ZOOM_DRAW_VEIL}
        />
      ) : (
        <div className={`pointer-events-none absolute inset-0 ${FOCUS_ZOOM_DRAW_VEIL}`} aria-hidden />
      )}
      {previewHole ? <FocusZoomSelectionFrame rect={previewHole} className="pointer-events-none" /> : null}
      <FocusZoomDrawHint />
      <FocusZoomDrawCancelBar onCancel={() => { reset(); onCancel() }} />
    </div>
  )
}

function normalizeRect(a: Point, b: Point) {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  const width = Math.abs(a.x - b.x)
  const height = Math.abs(a.y - b.y)
  return { x, y, width, height }
}

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

export interface BookCaptureRegionOverlayProps {
  open: boolean
  onCancel: () => void
  /** Rectangle in CSS pixels relative to the overlay box (same as capture root). */
  onConfirm: (rect: { x: number; y: number; width: number; height: number }) => void
}

type Point = { x: number; y: number }

export function BookCaptureRegionOverlay({ open, onCancel, onConfirm }: BookCaptureRegionOverlayProps) {
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

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        reset()
        onCancel()
      }
      if (e.key === 'Enter' && start && current) {
        e.preventDefault()
        const rect = normalizeRect(start, current)
        if (rect.width >= 4 && rect.height >= 4) {
          onConfirm(rect)
          reset()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, start, current, onCancel, onConfirm, reset])

  const clientToLocal = useCallback((clientX: number, clientY: number): Point | null => {
    const el = rootRef.current
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: clientX - r.left, y: clientY - r.top }
  }, [])

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
    if (!dragging) return
    ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
    setDragging(false)
  }

  const rect =
    start && current
      ? normalizeRect(start, current)
      : null

  const confirm = () => {
    if (!rect || rect.width < 4 || rect.height < 4) return
    onConfirm(rect)
    reset()
  }

  if (!open) return null

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 z-[70] touch-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div className="absolute inset-0 bg-black/45" aria-hidden />
      {rect && rect.width >= 2 && rect.height >= 2 ? (
        <div
          className="pointer-events-none absolute border-2 border-amber-400/90 bg-amber-400/10 shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
          style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
        />
      ) : null}
      <div
        className="pointer-events-auto absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <Button type="button" size="sm" variant="secondary" className="bg-white/95 text-[#3d2918]" onClick={() => { reset(); onCancel() }}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          className="bg-amber-600 text-white hover:bg-amber-600/90"
          disabled={!rect || rect.width < 4 || rect.height < 4}
          onClick={confirm}
        >
          Save region
        </Button>
      </div>
      <p className="pointer-events-none absolute left-1/2 top-3 w-[min(90%,24rem)] -translate-x-1/2 rounded-lg bg-black/55 px-3 py-1.5 text-center text-xs text-white backdrop-blur-sm">
        Drag to select an area. Enter to confirm, Esc to cancel.
      </p>
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

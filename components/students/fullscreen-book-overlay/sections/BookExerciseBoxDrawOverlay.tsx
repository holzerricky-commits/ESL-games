'use client'

import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import {
  FOCUS_ZOOM_CONTROL_BAR,
  FOCUS_ZOOM_DRAW_VEIL,
  FocusZoomSelectionFrame,
  FocusZoomSpotlightBackdrop,
} from '@/components/students/fullscreen-book-overlay/sections/BookFocusZoomChrome'
import { pageNormRectFromNormCorners, type PageNormRect } from '@/lib/books/book-exercises'
import { cn } from '@/lib/utils'

type Point = { x: number; y: number }

type LockedPage = {
  pdfPage: number
  rect: DOMRect
}

function clientToPageNorm(clientX: number, clientY: number, pageRect: DOMRect): Point {
  const w = pageRect.width
  const h = pageRect.height
  if (!(w > 0) || !(h > 0)) return { x: 0, y: 0 }
  return {
    x: Math.max(0, Math.min(1, (clientX - pageRect.left) / w)),
    y: Math.max(0, Math.min(1, (clientY - pageRect.top) / h)),
  }
}

function pickLockedPage(
  clientX: number,
  clientY: number,
  pages: { pdfPage: number; el: HTMLElement }[],
): LockedPage | null {
  const hits: { page: LockedPage; inward: number }[] = []
  for (const page of pages) {
    const rect = page.el.getBoundingClientRect()
    if (!(rect.width > 0) || !(rect.height > 0)) continue
    const nx = (clientX - rect.left) / rect.width
    const ny = (clientY - rect.top) / rect.height
    if (nx < -0.05 || nx > 1.05 || ny < -0.05 || ny > 1.05) continue
    const cx = Math.max(0, Math.min(1, nx))
    const cy = Math.max(0, Math.min(1, ny))
    const inward = Math.min(cx, 1 - cx, cy, 1 - cy)
    hits.push({ page: { pdfPage: page.pdfPage, rect }, inward })
  }
  if (!hits.length) return null
  hits.sort((a, b) => b.inward - a.inward)
  return hits[0]!.page
}

function overlayHoleFromPageNorm(
  overlayRect: DOMRect,
  pageRect: DOMRect,
  start: Point,
  current: Point,
): { x: number; y: number; w: number; h: number } | null {
  const rect = pageNormRectFromNormCorners(start.x, start.y, current.x, current.y, 0.002)
  if (!rect) return null
  return {
    x: pageRect.left - overlayRect.left + rect.x * pageRect.width,
    y: pageRect.top - overlayRect.top + rect.y * pageRect.height,
    w: rect.w * pageRect.width,
    h: rect.h * pageRect.height,
  }
}

export type BookExerciseBoxDrawOverlayProps = {
  open: boolean
  pageNumber: number
  spreadRightPage: number | null
  showSpreadRightPage: boolean
  leftPageCaptureRef: RefObject<HTMLDivElement | null>
  rightPageCaptureRef: RefObject<HTMLDivElement | null>
  onCancel: () => void
  onConfirm: (pdfPage: number, rect: PageNormRect) => void
}

export function BookExerciseBoxDrawOverlay({
  open,
  pageNumber,
  spreadRightPage,
  showSpreadRightPage,
  leftPageCaptureRef,
  rightPageCaptureRef,
  onCancel,
  onConfirm,
}: BookExerciseBoxDrawOverlayProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const lockedRef = useRef<LockedPage | null>(null)
  const [dragging, setDragging] = useState(false)
  const [lockedPage, setLockedPage] = useState<LockedPage | null>(null)
  const [start, setStart] = useState<Point | null>(null)
  const [current, setCurrent] = useState<Point | null>(null)

  const reset = useCallback(() => {
    lockedRef.current = null
    setDragging(false)
    setLockedPage(null)
    setStart(null)
    setCurrent(null)
  }, [])

  useEffect(() => {
    if (!open) reset()
  }, [open, reset])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      reset()
      onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, open, reset])

  const collectPages = useCallback(() => {
    const pages: { pdfPage: number; el: HTMLElement }[] = []
    const leftEl = leftPageCaptureRef.current
    const rightEl = rightPageCaptureRef.current
    if (leftEl) pages.push({ pdfPage: pageNumber, el: leftEl })
    if (showSpreadRightPage && spreadRightPage != null && rightEl) {
      pages.push({ pdfPage: spreadRightPage, el: rightEl })
    }
    return pages
  }, [leftPageCaptureRef, pageNumber, rightPageCaptureRef, showSpreadRightPage, spreadRightPage])

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!open || event.button !== 0) return
    const hit = pickLockedPage(event.clientX, event.clientY, collectPages())
    if (!hit) return
    event.preventDefault()
    ;(event.target as HTMLElement).setPointerCapture?.(event.pointerId)
    const point = clientToPageNorm(event.clientX, event.clientY, hit.rect)
    lockedRef.current = hit
    setLockedPage(hit)
    setDragging(true)
    setStart(point)
    setCurrent(point)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const locked = lockedRef.current
    if (!dragging || !locked) return
    setCurrent(clientToPageNorm(event.clientX, event.clientY, locked.rect))
  }

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging || !start || !current) return
    ;(event.target as HTMLElement).releasePointerCapture?.(event.pointerId)
    const locked = lockedRef.current
    setDragging(false)
    if (!locked) {
      reset()
      return
    }
    const rect = pageNormRectFromNormCorners(start.x, start.y, current.x, current.y)
    if (!rect) {
      reset()
      return
    }
    onConfirm(locked.pdfPage, rect)
    reset()
  }

  if (!open) return null

  const overlayRect = rootRef.current?.getBoundingClientRect() ?? null
  const previewHole =
    overlayRect && lockedPage && start && current
      ? overlayHoleFromPageNorm(overlayRect, lockedPage.rect, start, current)
      : null
  const previewOk = previewHole && previewHole.w >= 8 && previewHole.h >= 8 ? previewHole : null

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 z-[68] touch-none cursor-crosshair"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {previewOk ? (
        <FocusZoomSpotlightBackdrop
          areaRef={rootRef}
          hole={previewOk}
          dimClassName={FOCUS_ZOOM_DRAW_VEIL}
        />
      ) : (
        <div className={`pointer-events-none absolute inset-0 ${FOCUS_ZOOM_DRAW_VEIL}`} aria-hidden />
      )}
      {previewOk ? <FocusZoomSelectionFrame rect={previewOk} className="pointer-events-none" /> : null}
      <div className="pointer-events-none absolute inset-x-0 bottom-[4.75rem] z-[69] flex justify-center px-4">
        <p
          className={cn(
            'max-w-sm rounded-xl border border-white/10 bg-black/55 px-4 py-2 text-center text-xs leading-relaxed text-white/90',
            'shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-md',
          )}
        >
          Drag around one exercise. Release to save the box.
        </p>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-[69] flex justify-center">
        <div className={cn(FOCUS_ZOOM_CONTROL_BAR, 'pointer-events-auto')}>
          <button
            type="button"
            title="Cancel (Esc)"
            aria-label="Cancel (Esc)"
            className="flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-xl px-2.5 text-xs font-medium hover:bg-white/12"
            onClick={() => {
              reset()
              onCancel()
            }}
          >
            <X className="h-4 w-4 shrink-0" aria-hidden />
            <span className="hidden sm:inline">Cancel (Esc)</span>
          </button>
        </div>
      </div>
    </div>
  )
}

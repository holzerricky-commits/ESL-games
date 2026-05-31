'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import { applyAnnotationCanvasDpr, clearAnnotationCanvas, drawAnnotationCommand, isMarkerStrokeCommand } from '@/lib/books/annotation-draw'
import { applySelectionChange, selectionChangeModeFromPointerKeys } from '@/lib/books/annotation-selection-ops'
import {
  annotationIdsInMarquee,
  getAnnotationBounds,
  hitTestAnnotationIndex,
  normalizeMarqueeRect,
  resolveMarqueeSelectMode,
  type NormRect,
} from '@/lib/books/annotation-select'
import { cn } from '@/lib/utils'

type BookSpreadSessionLayerProps = {
  widthPx: number
  heightPx: number
  commands: AnnotationCommand[]
  selectEnabled?: boolean
  selectedIds?: string[]
  onSelectedIdsChange?: (ids: string[]) => void
  onMoveSelectedBy?: (dx: number, dy: number) => void
}

function sizeCanvas(el: HTMLCanvasElement, widthPx: number, heightPx: number): void {
  const dpr = window.devicePixelRatio || 1
  const nextW = Math.max(1, Math.floor(widthPx * dpr))
  const nextH = Math.max(1, Math.floor(heightPx * dpr))
  if (el.width !== nextW || el.height !== nextH) {
    el.width = nextW
    el.height = nextH
  }
  el.style.width = `${widthPx}px`
  el.style.height = `${heightPx}px`
}

export function BookSpreadSessionLayer({
  widthPx,
  heightPx,
  commands,
  selectEnabled = false,
  selectedIds = [],
  onSelectedIdsChange,
  onMoveSelectedBy,
}: BookSpreadSessionLayerProps) {
  const inkRef = useRef<HTMLCanvasElement | null>(null)
  const markerRef = useRef<HTMLCanvasElement | null>(null)
  const dragAnchorRef = useRef<[number, number] | null>(null)
  const marqueeAnchorRef = useRef<[number, number] | null>(null)
  const marqueeSelModeRef = useRef<ReturnType<typeof selectionChangeModeFromPointerKeys>>('replace')
  const marqueeRectRef = useRef<NormRect | null>(null)
  const [marqueeRect, setMarqueeRect] = useState<NormRect | null>(null)
  const selectionRects = selectedIds
    .map((id) => {
      const cmd = commands.find((c) => c.id === id)
      return cmd ? getAnnotationBounds(cmd, widthPx, heightPx) : null
    })
    .filter((r): r is { x: number; y: number; w: number; h: number } => !!r && r.w > 0 && r.h > 0)

  useLayoutEffect(() => {
    const inkEl = inkRef.current
    const markerEl = markerRef.current
    if (!inkEl || !markerEl || !(widthPx > 0) || !(heightPx > 0)) return
    sizeCanvas(inkEl, widthPx, heightPx)
    sizeCanvas(markerEl, widthPx, heightPx)

    const inkCtx = inkEl.getContext('2d', { alpha: true })
    const markerCtx = markerEl.getContext('2d', { alpha: true })
    if (!inkCtx || !markerCtx) return

    clearAnnotationCanvas(inkCtx)
    clearAnnotationCanvas(markerCtx)
    applyAnnotationCanvasDpr(inkCtx)
    applyAnnotationCanvasDpr(markerCtx)

    for (const cmd of commands) {
      if (isMarkerStrokeCommand(cmd)) {
        drawAnnotationCommand(markerCtx, cmd, widthPx, heightPx)
      } else {
        drawAnnotationCommand(inkCtx, cmd, widthPx, heightPx)
      }
    }
  }, [commands, heightPx, widthPx])

  const toNorm = (el: HTMLDivElement, clientX: number, clientY: number): [number, number] | null => {
    const r = el.getBoundingClientRect()
    if (!(r.width > 0) || !(r.height > 0)) return null
    const nx = (clientX - r.left) / r.width
    const ny = (clientY - r.top) / r.height
    return [Math.max(0, Math.min(1, nx)), Math.max(0, Math.min(1, ny))]
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!selectEnabled) return
    const p = toNorm(e.currentTarget, e.clientX, e.clientY)
    if (!p) return
    const idx = hitTestAnnotationIndex(commands, p[0], p[1], widthPx, heightPx, new Set())
    if (idx == null) {
      marqueeAnchorRef.current = p
      marqueeSelModeRef.current = selectionChangeModeFromPointerKeys(e)
      marqueeRectRef.current = normalizeMarqueeRect(p, p)
      setMarqueeRect(marqueeRectRef.current)
      e.currentTarget.setPointerCapture(e.pointerId)
      dragAnchorRef.current = null
      return
    }
    const id = commands[idx]?.id
    if (!id) return
    const selMode = selectionChangeModeFromPointerKeys(e)
    const nextIds = applySelectionChange(selectedIds, [id], selMode)
    onSelectedIdsChange?.(nextIds)
    const canStartDrag =
      selMode === 'replace' &&
      selectedIds.length === 1 &&
      selectedIds[0] === id
    if (!canStartDrag) {
      dragAnchorRef.current = null
      return
    }
    dragAnchorRef.current = p
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!selectEnabled) return
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    const marqueeAnchor = marqueeAnchorRef.current
    if (marqueeAnchor) {
      const p = toNorm(e.currentTarget, e.clientX, e.clientY)
      if (!p) return
      marqueeRectRef.current = normalizeMarqueeRect(marqueeAnchor, p)
      setMarqueeRect(marqueeRectRef.current)
      return
    }
    const anchor = dragAnchorRef.current
    if (!anchor) return
    const p = toNorm(e.currentTarget, e.clientX, e.clientY)
    if (!p) return
    const dx = p[0] - anchor[0]
    const dy = p[1] - anchor[1]
    if (dx === 0 && dy === 0) return
    dragAnchorRef.current = p
    onMoveSelectedBy?.(dx, dy)
  }

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    const marqueeAnchor = marqueeAnchorRef.current
    if (marqueeAnchor) {
      const p = toNorm(e.currentTarget, e.clientX, e.clientY)
      const rect = p ? normalizeMarqueeRect(marqueeAnchor, p) : marqueeRectRef.current
      if (rect && rect.w * rect.h >= 0.00004) {
        const mode = p ? resolveMarqueeSelectMode(marqueeAnchor, p, 'follow-drag') : 'crossing'
        const hits = annotationIdsInMarquee(commands, rect, widthPx, heightPx, mode)
        onSelectedIdsChange?.(applySelectionChange(selectedIds, hits, marqueeSelModeRef.current))
      } else if (marqueeSelModeRef.current === 'replace') {
        onSelectedIdsChange?.([])
      }
    }
    marqueeAnchorRef.current = null
    marqueeRectRef.current = null
    setMarqueeRect(null)
    dragAnchorRef.current = null
  }

  return (
    <div
      className={cn('absolute inset-0 z-[24]', selectEnabled ? 'pointer-events-auto' : 'pointer-events-none')}
      aria-hidden
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <canvas ref={inkRef} className={cn('pointer-events-none absolute inset-0')} />
      <canvas
        ref={markerRef}
        className={cn('pointer-events-none absolute inset-0')}
        style={{ mixBlendMode: 'multiply' }}
      />
      {selectionRects.map((r, i) => (
        <div
          key={`spread-sel-${i}`}
          className="pointer-events-none absolute rounded-[6px] border border-sky-400/95 shadow-[0_0_0_1px_rgba(255,255,255,0.55)]"
          style={{
            left: `${r.x * 100}%`,
            top: `${r.y * 100}%`,
            width: `${r.w * 100}%`,
            height: `${r.h * 100}%`,
          }}
          aria-hidden
        />
      ))}
      {marqueeRect ? (
        <div
          className="pointer-events-none absolute border border-sky-400/90 bg-sky-300/15"
          style={{
            left: `${marqueeRect.x * 100}%`,
            top: `${marqueeRect.y * 100}%`,
            width: `${marqueeRect.w * 100}%`,
            height: `${marqueeRect.h * 100}%`,
          }}
          aria-hidden
        />
      ) : null}
    </div>
  )
}

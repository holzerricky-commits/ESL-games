'use client'

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useBrowserZoomRepaintRevision } from '@/components/students/fullscreen-book-overlay/hooks/useBrowserZoomRepaintRevision'
import type { LiveEraserLineDraft } from '@/components/students/book-page-annotation-layer'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import { eraserLineTrailingForReplay } from '@/lib/books/annotation-live-paint'
import { computeEraserLineDeadIndices } from '@/lib/books/annotation-geometry'
import {
  applyAnnotationCanvasDpr,
  clearAnnotationCanvas,
  drawAnnotationCommand,
  isMarkerStrokeCommand,
  replayInkSlice,
  replayMarkerSlice,
} from '@/lib/books/annotation-draw'
import { buildAnnotationRenderSlices } from '@/lib/books/annotation-render-slices'
import { applySelectionChange, selectionChangeModeFromPointerKeys } from '@/lib/books/annotation-selection-ops'
import {
  annotationIdsInMarquee,
  getAnnotationBounds,
  hitTestAnnotationIndex,
  normalizeMarqueeRect,
  resolveMarqueeSelectMode,
  type NormRect,
} from '@/lib/books/annotation-select'
import { canIncrementallyAppendSpreadSessionCommands } from '@/lib/books/spread-session-incremental-paint'
import {
  clientToWhiteboardDocumentNorm,
  projectCommandsForWhiteboardViewport,
  type WhiteboardViewportInkConfig,
} from '@/lib/books/whiteboard-viewport-ink'
import { cn } from '@/lib/utils'

type BookSpreadSessionLayerProps = {
  widthPx: number
  heightPx: number
  commands: AnnotationCommand[]
  /** When set, `commands` are document-space; layer paints the visible viewport band only. */
  viewportInk?: WhiteboardViewportInkConfig
  trailingEraserLineDraft?: LiveEraserLineDraft | null
  selectEnabled?: boolean
  selectedIds?: string[]
  onSelectedIdsChange?: (ids: string[]) => void
  onMoveSelectedBy?: (dx: number, dy: number) => void
}

function sizeCanvas(el: HTMLCanvasElement, widthPx: number, heightPx: number): boolean {
  const dpr = window.devicePixelRatio || 1
  const nextW = Math.max(1, Math.floor(widthPx * dpr))
  const nextH = Math.max(1, Math.floor(heightPx * dpr))
  const resized = el.width !== nextW || el.height !== nextH
  if (resized) {
    el.width = nextW
    el.height = nextH
  }
  el.style.width = `${widthPx}px`
  el.style.height = `${heightPx}px`
  return resized
}

export function BookSpreadSessionLayer({
  widthPx,
  heightPx,
  commands,
  viewportInk,
  trailingEraserLineDraft = null,
  selectEnabled = false,
  selectedIds = [],
  onSelectedIdsChange,
  onMoveSelectedBy,
}: BookSpreadSessionLayerProps) {
  const paintCommands = useMemo(
    () => (viewportInk ? projectCommandsForWhiteboardViewport(commands, viewportInk) : commands),
    [commands, viewportInk],
  )
  const inkSliceRefs = useRef<(HTMLCanvasElement | null)[]>([])
  const markerSliceRefs = useRef<(HTMLCanvasElement | null)[]>([])
  const zoomRepaintRevision = useBrowserZoomRepaintRevision()
  const paintedCommandsRef = useRef<readonly AnnotationCommand[]>([])
  const paintedDeadKeyRef = useRef('')
  const dragAnchorRef = useRef<[number, number] | null>(null)
  const marqueeAnchorRef = useRef<[number, number] | null>(null)
  const marqueeSelModeRef = useRef<ReturnType<typeof selectionChangeModeFromPointerKeys>>('replace')
  const marqueeRectRef = useRef<NormRect | null>(null)
  const [marqueeRect, setMarqueeRect] = useState<NormRect | null>(null)

  const trailingEraser = useMemo(
    () => eraserLineTrailingForReplay(null, trailingEraserLineDraft),
    [trailingEraserLineDraft],
  )
  const deadIndices = useMemo(
    () => computeEraserLineDeadIndices(paintCommands, trailingEraser),
    [paintCommands, trailingEraser],
  )
  const deadKey = useMemo(() => [...deadIndices].sort((a, b) => a - b).join(','), [deadIndices])

  const selectionRects = selectedIds
    .map((id) => {
      const idx = paintCommands.findIndex((c) => c.id === id)
      if (idx >= 0 && deadIndices.has(idx)) return null
      const cmd = paintCommands[idx]
      return cmd ? getAnnotationBounds(cmd, widthPx, heightPx) : null
    })
    .filter((r): r is { x: number; y: number; w: number; h: number } => !!r && r.w > 0 && r.h > 0)

  useLayoutEffect(() => {
    if (!(widthPx > 0) || !(heightPx > 0)) return

    const slices = buildAnnotationRenderSlices(paintCommands, deadIndices)
    const inkCount = slices.filter((s) => s.kind === 'ink').length
    const markerCount = slices.filter((s) => s.kind === 'marker').length

    while (inkSliceRefs.current.length < inkCount) inkSliceRefs.current.push(null)
    while (markerSliceRefs.current.length < markerCount) markerSliceRefs.current.push(null)
    inkSliceRefs.current.length = inkCount
    markerSliceRefs.current.length = markerCount

    let canvasResized = false
    for (const el of inkSliceRefs.current) {
      if (el) canvasResized = sizeCanvas(el, widthPx, heightPx) || canvasResized
    }
    for (const el of markerSliceRefs.current) {
      if (el) canvasResized = sizeCanvas(el, widthPx, heightPx) || canvasResized
    }

    const prev = paintedCommandsRef.current
    const prevDeadKey = paintedDeadKeyRef.current
    const canAppend =
      !canvasResized &&
      deadIndices.size === 0 &&
      deadKey === prevDeadKey &&
      canIncrementallyAppendSpreadSessionCommands(prev, paintCommands)

    if (canAppend) {
      const cmd = paintCommands[paintCommands.length - 1]!
      const lastSlice = slices[slices.length - 1]
      if (lastSlice?.kind === 'marker' && isMarkerStrokeCommand(cmd) && lastSlice.indices[0] === paintCommands.length - 1) {
        const markerIdx = markerCount - 1
        const el = markerSliceRefs.current[markerIdx]
        const ctx = el?.getContext('2d', { alpha: true })
        if (ctx) {
          applyAnnotationCanvasDpr(ctx)
          drawAnnotationCommand(ctx, cmd, widthPx, heightPx)
        }
      } else if (lastSlice?.kind === 'ink' && !isMarkerStrokeCommand(cmd)) {
        const inkIdx = inkCount - 1
        const el = inkSliceRefs.current[inkIdx]
        const ctx = el?.getContext('2d', { alpha: true })
        if (ctx) {
          applyAnnotationCanvasDpr(ctx)
          drawAnnotationCommand(ctx, cmd, widthPx, heightPx)
        }
      } else {
        replayAllSlices()
      }
    } else {
      replayAllSlices()
    }

    function replayAllSlices(): void {
      let inkIdx = 0
      let markerIdx = 0
      for (const slice of slices) {
        if (slice.kind === 'ink') {
          const el = inkSliceRefs.current[inkIdx++]
          const inkCtx = el?.getContext('2d', { alpha: true })
          if (!inkCtx) continue
          replayInkSlice(inkCtx, paintCommands, slice.indices, widthPx, heightPx)
        } else if (slice.kind === 'marker') {
          const el = markerSliceRefs.current[markerIdx++]
          const markerCtx = el?.getContext('2d', { alpha: true })
          if (!markerCtx) continue
          replayMarkerSlice(markerCtx, paintCommands, slice.indices, widthPx, heightPx)
        }
      }
      for (let i = inkIdx; i < inkSliceRefs.current.length; i++) {
        const el = inkSliceRefs.current[i]
        const ctx = el?.getContext('2d', { alpha: true })
        if (ctx) clearAnnotationCanvas(ctx)
      }
      for (let i = markerIdx; i < markerSliceRefs.current.length; i++) {
        const el = markerSliceRefs.current[i]
        const ctx = el?.getContext('2d', { alpha: true })
        if (ctx) clearAnnotationCanvas(ctx)
      }
    }

    paintedCommandsRef.current = paintCommands
    paintedDeadKeyRef.current = deadKey
  }, [paintCommands, deadIndices, deadKey, heightPx, widthPx, zoomRepaintRevision])

  const toNorm = (el: HTMLDivElement, clientX: number, clientY: number): [number, number] | null => {
    const r = el.getBoundingClientRect()
    if (!(r.width > 0) || !(r.height > 0)) return null
    if (viewportInk) {
      return clientToWhiteboardDocumentNorm(viewportInk, r, clientX, clientY)
    }
    const nx = (clientX - r.left) / r.width
    const ny = (clientY - r.top) / r.height
    return [Math.max(0, Math.min(1, nx)), Math.max(0, Math.min(1, ny))]
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!selectEnabled) return
    const p = toNorm(e.currentTarget, e.clientX, e.clientY)
    if (!p) return
    const idx = hitTestAnnotationIndex(commands, p[0], p[1], widthPx, heightPx, deadIndices)
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
        const hits = annotationIdsInMarquee(commands, rect, widthPx, heightPx, mode, deadIndices)
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

  const renderSlices = buildAnnotationRenderSlices(commands, deadIndices)
  let inkIdx = 0
  let markerIdx = 0

  return (
    <div
      className={cn('absolute inset-0 z-[24]', selectEnabled ? 'pointer-events-auto' : 'pointer-events-none')}
      aria-hidden
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {renderSlices.map((slice) => {
        if (slice.kind === 'ink') {
          const idx = inkIdx++
          return (
            <canvas
              key={`spread-ink-${slice.zIndex}`}
              ref={(el) => {
                inkSliceRefs.current[idx] = el
              }}
              className="pointer-events-none absolute inset-0"
            />
          )
        }
        if (slice.kind === 'marker') {
          const idx = markerIdx++
          return (
            <canvas
              key={`spread-marker-${slice.zIndex}`}
              ref={(el) => {
                markerSliceRefs.current[idx] = el
              }}
              className="pointer-events-none absolute inset-0"
              style={{ mixBlendMode: 'multiply' }}
            />
          )
        }
        return null
      })}
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

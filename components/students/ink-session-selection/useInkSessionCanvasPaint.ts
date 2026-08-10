'use client'

import { useLayoutEffect, useRef } from 'react'
import type { LiveStrokeDraft } from '@/components/students/book-page-annotation-layer'
import type { AnnotationCommand, StrokeAnnotationCommand } from '@/lib/books/annotation-command-types'
import {
  applyAnnotationCanvasDpr,
  clearAnnotationCanvas,
  drawAnnotationCommandWithPasteReveal,
  drawStrokePath,
  isMarkerStrokeCommand,
} from '@/lib/books/annotation-draw'
import {
  buildAnnotationRenderSlices,
  INK_PAINT_SLICE_BATCH_SIZE,
} from '@/lib/books/annotation-render-slices'
import { canIncrementallyAppendSpreadSessionCommands } from '@/lib/books/spread-session-incremental-paint'
import { hasActivePasteReveals } from '@/lib/books/board-paste-reveal'
import { hasActiveStampPlacementEffects } from '@/lib/books/stamp-placement-effect'
import type { OrientedSelectionFrame } from '@/lib/books/annotation-select'
import { inkPaintEngineEnabled } from '@/lib/books/feature-flags'
import { runInkSessionPaint } from '@/lib/books/ink-paint-engine'

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

export type UseInkSessionCanvasPaintOptions = {
  widthPx: number
  heightPx: number
  paintDisplayCommands: readonly AnnotationCommand[]
  deadIndices: ReadonlySet<number>
  deadKey: string
  markersOnSessionLayer: boolean
  trailingMarkerStrokeDraft?: LiveStrokeDraft | null
  selectScaleLiveFrame: OrientedSelectionFrame | null
  selectDragLive: { dx: number; dy: number } | null
  zoomRepaintRevision: number
  repaintEpoch: number
  pasteRevealTick?: number
}

/** Committed ink replay for spread / lesson-board session surfaces. */
export function useInkSessionCanvasPaint({
  widthPx,
  heightPx,
  paintDisplayCommands,
  deadIndices,
  deadKey,
  markersOnSessionLayer,
  trailingMarkerStrokeDraft = null,
  selectScaleLiveFrame,
  selectDragLive,
  zoomRepaintRevision,
  repaintEpoch,
  pasteRevealTick = 0,
}: UseInkSessionCanvasPaintOptions) {
  const inkSliceRefs = useRef<(HTMLCanvasElement | null)[]>([])
  const markerSliceRefs = useRef<(HTMLCanvasElement | null)[]>([])
  const trailingMarkerCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const paintedCommandsRef = useRef<readonly AnnotationCommand[]>([])
  const paintedDeadKeyRef = useRef('')
  const prevPasteRevealTickRef = useRef(pasteRevealTick)

  useLayoutEffect(() => {
    if (!(widthPx > 0) || !(heightPx > 0)) return

    const pasteRevealTickAdvanced = prevPasteRevealTickRef.current !== pasteRevealTick
    prevPasteRevealTickRef.current = pasteRevealTick

    const sliceOptions = inkPaintEngineEnabled ? { inkBatchSize: INK_PAINT_SLICE_BATCH_SIZE } : undefined
    const slices = buildAnnotationRenderSlices(paintDisplayCommands, deadIndices, sliceOptions)
    const inkCount = slices.filter((s) => s.kind === 'ink').length
    const markerCount = markersOnSessionLayer ? slices.filter((s) => s.kind === 'marker').length : 0

    while (inkSliceRefs.current.length < inkCount) inkSliceRefs.current.push(null)
    while (markerSliceRefs.current.length < markerCount) markerSliceRefs.current.push(null)
    inkSliceRefs.current.length = inkCount
    markerSliceRefs.current.length = markerCount

    let canvasResized = false
    for (const el of inkSliceRefs.current) {
      if (el) canvasResized = sizeCanvas(el, widthPx, heightPx) || canvasResized
    }
    if (markersOnSessionLayer) {
      for (const el of markerSliceRefs.current) {
        if (el) canvasResized = sizeCanvas(el, widthPx, heightPx) || canvasResized
      }
      const trailMarkerEl = trailingMarkerCanvasRef.current
      if (trailMarkerEl) canvasResized = sizeCanvas(trailMarkerEl, widthPx, heightPx) || canvasResized
    }

    const prev = paintedCommandsRef.current
    const prevDeadKey = paintedDeadKeyRef.current
    const pasteRevealActive = hasActivePasteReveals()
    const stampPlacementActive = hasActiveStampPlacementEffects()
    const selectionTransformActive = selectScaleLiveFrame != null || selectDragLive != null

    const trailingMarkerDraft =
      trailingMarkerStrokeDraft &&
      trailingMarkerStrokeDraft.tool === 'marker' &&
      trailingMarkerStrokeDraft.points.length >= 1
        ? trailingMarkerStrokeDraft
        : null

    if (inkPaintEngineEnabled) {
      runInkSessionPaint(
        prev,
        prevDeadKey,
        paintDisplayCommands,
        deadIndices,
        deadKey,
        {
          inkSliceRefs: inkSliceRefs.current,
          markerSliceRefs: markerSliceRefs.current,
          markersOnSessionLayer,
          trailingMarkerCanvasRef,
        },
        widthPx,
        heightPx,
        {
          overlayAnimationActive:
            pasteRevealActive || stampPlacementActive || pasteRevealTickAdvanced,
          canvasResized,
          selectionTransformActive,
        },
        sliceOptions,
        trailingMarkerDraft,
      )
    } else {
      paintLegacy()
    }

    paintedCommandsRef.current = paintDisplayCommands
    paintedDeadKeyRef.current = deadKey

    function paintLegacy(): void {
      const canAppend =
        !pasteRevealActive &&
        !stampPlacementActive &&
        !selectionTransformActive &&
        !canvasResized &&
        deadKey === prevDeadKey &&
        canIncrementallyAppendSpreadSessionCommands(prev, paintDisplayCommands)

      if (canAppend) {
        const cmd = paintDisplayCommands[paintDisplayCommands.length - 1]!
        const lastSlice = slices[slices.length - 1]
        const drawCmd = (ctx: CanvasRenderingContext2D, command: AnnotationCommand) => {
          applyAnnotationCanvasDpr(ctx)
          drawAnnotationCommandWithPasteReveal(ctx, command, widthPx, heightPx)
        }
        if (
          markersOnSessionLayer &&
          lastSlice?.kind === 'marker' &&
          isMarkerStrokeCommand(cmd) &&
          lastSlice.indices[0] === paintDisplayCommands.length - 1
        ) {
          const markerIdx = markerCount - 1
          const el = markerSliceRefs.current[markerIdx]
          const ctx = el?.getContext('2d', { alpha: true })
          if (ctx) {
            drawCmd(ctx, cmd)
          } else {
            replayAllSlices()
          }
        } else if (lastSlice?.kind === 'ink' && !isMarkerStrokeCommand(cmd)) {
          const inkIdx = inkCount - 1
          const el = inkSliceRefs.current[inkIdx]
          const ctx = el?.getContext('2d', { alpha: true })
          if (ctx) {
            drawCmd(ctx, cmd)
          } else {
            replayAllSlices()
          }
        } else {
          replayAllSlices()
        }
      } else {
        replayAllSlices()
      }

      if (markersOnSessionLayer) paintTrailingMarkerDraftLegacy()
    }

    function replayAllSlices(): void {
      const now = Date.now()
      let inkIdx = 0
      let markerIdx = 0
      for (const slice of slices) {
        if (slice.kind === 'ink') {
          const el = inkSliceRefs.current[inkIdx++]
          const inkCtx = el?.getContext('2d', { alpha: true })
          if (!inkCtx) continue
          clearAnnotationCanvas(inkCtx)
          applyAnnotationCanvasDpr(inkCtx)
          for (const index of slice.indices) {
            const cmd = paintDisplayCommands[index]!
            drawAnnotationCommandWithPasteReveal(inkCtx, cmd, widthPx, heightPx, undefined, now)
          }
        } else if (slice.kind === 'marker' && markersOnSessionLayer) {
          const el = markerSliceRefs.current[markerIdx++]
          const markerCtx = el?.getContext('2d', { alpha: true })
          if (!markerCtx) continue
          clearAnnotationCanvas(markerCtx)
          applyAnnotationCanvasDpr(markerCtx)
          for (const index of slice.indices) {
            const cmd = paintDisplayCommands[index]!
            drawAnnotationCommandWithPasteReveal(markerCtx, cmd, widthPx, heightPx, undefined, now)
          }
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
      if (markersOnSessionLayer) paintTrailingMarkerDraftLegacy()
    }

    function paintTrailingMarkerDraftLegacy(): void {
      const el = trailingMarkerCanvasRef.current
      const ctx = el?.getContext('2d', { alpha: true })
      if (!ctx) return
      clearAnnotationCanvas(ctx)
      const trail = trailingMarkerStrokeDraft
      if (!trail || trail.tool !== 'marker' || trail.points.length < 1) return
      applyAnnotationCanvasDpr(ctx)
      const trailCmd: StrokeAnnotationCommand = {
        kind: 'stroke',
        id: '__trailing_marker__',
        tool: 'marker',
        points: trail.points.map((p) => [p[0], p[1]] as [number, number]),
        ...(trail.widthScale != null ? { widthScale: trail.widthScale } : {}),
        ...(trail.color ? { color: trail.color } : {}),
        ...(trail.lineDashStyle ? { lineDashStyle: trail.lineDashStyle } : {}),
        ...(trail.markerDecoratedEdge ? { markerDecoratedEdge: true } : {}),
      }
      drawStrokePath(ctx, trailCmd, widthPx, heightPx)
    }
  }, [
    paintDisplayCommands,
    deadIndices,
    deadKey,
    heightPx,
    widthPx,
    zoomRepaintRevision,
    markersOnSessionLayer,
    trailingMarkerStrokeDraft,
    selectScaleLiveFrame,
    repaintEpoch,
    selectDragLive,
    pasteRevealTick,
  ])

  return {
    inkSliceRefs,
    markerSliceRefs,
    trailingMarkerCanvasRef,
  }
}

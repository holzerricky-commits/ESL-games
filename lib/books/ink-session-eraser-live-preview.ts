import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import {
  applyAnnotationCanvasDpr,
  drawAnnotationCommandWithPasteReveal,
  drawStrokePath,
} from '@/lib/books/annotation-draw'
import { buildAnnotationRenderSlices } from '@/lib/books/annotation-render-slices'

/** Parse `deadKey` from spread session layer (`sorted indices joined by comma`). */
export function parseEraserPreviewDeadKey(deadKey: string): ReadonlySet<number> {
  if (!deadKey) return new Set()
  const out = new Set<number>()
  for (const part of deadKey.split(',')) {
    const n = Number(part)
    if (Number.isFinite(n)) out.add(n)
  }
  return out
}

export function deadKeyFromIndices(deadIndices: ReadonlySet<number>): string {
  return [...deadIndices].sort((a, b) => a - b).join(',')
}

export function newlyDeadIndices(
  deadIndices: ReadonlySet<number>,
  prevDeadKey: string,
): number[] {
  const prevDead = parseEraserPreviewDeadKey(prevDeadKey)
  return [...deadIndices].filter((i) => !prevDead.has(i))
}

function punchOutCommandOnCanvas(
  ctx: CanvasRenderingContext2D,
  cmd: AnnotationCommand,
  widthPx: number,
  heightPx: number,
): void {
  ctx.save()
  ctx.globalCompositeOperation = 'destination-out'
  ctx.globalAlpha = 1
  if (cmd.kind === 'stroke') {
    drawStrokePath(ctx, cmd, widthPx, heightPx)
  } else {
    drawAnnotationCommandWithPasteReveal(ctx, cmd, widthPx, heightPx)
  }
  ctx.restore()
}

/**
 * R2.5b — punch out only newly hit commands on their slice canvas (O(new hits) per move).
 * Does not clear/redraw sibling strokes in the same ink batch.
 */
export function applyEraserLivePreviewPunchOut(
  paintDisplayCommands: readonly AnnotationCommand[],
  deadIndices: ReadonlySet<number>,
  prevDeadKey: string,
  inkSliceRefs: readonly (HTMLCanvasElement | null)[],
  markerSliceRefs: readonly (HTMLCanvasElement | null)[],
  markersOnSessionLayer: boolean,
  widthPx: number,
  heightPx: number,
): boolean {
  const added = newlyDeadIndices(deadIndices, prevDeadKey)
  if (added.length === 0) return false

  const addedSet = new Set(added)
  const slices = buildAnnotationRenderSlices(paintDisplayCommands, new Set())
  let inkIdx = 0
  let markerIdx = 0
  let punched = false

  for (const slice of slices) {
    if (slice.kind === 'ink') {
      const el = inkSliceRefs[inkIdx++]
      const ctx = el?.getContext('2d', { alpha: true })
      if (!ctx) continue
      applyAnnotationCanvasDpr(ctx)
      let slicePunched = false
      for (const index of slice.indices) {
        if (!addedSet.has(index)) continue
        const cmd = paintDisplayCommands[index]
        if (!cmd) continue
        punchOutCommandOnCanvas(ctx, cmd, widthPx, heightPx)
        slicePunched = true
      }
      if (slicePunched) punched = true
    } else if (slice.kind === 'marker' && markersOnSessionLayer) {
      const el = markerSliceRefs[markerIdx++]
      const ctx = el?.getContext('2d', { alpha: true })
      if (!ctx) continue
      applyAnnotationCanvasDpr(ctx)
      let slicePunched = false
      for (const index of slice.indices) {
        if (!addedSet.has(index)) continue
        const cmd = paintDisplayCommands[index]
        if (!cmd) continue
        punchOutCommandOnCanvas(ctx, cmd, widthPx, heightPx)
        slicePunched = true
      }
      if (slicePunched) punched = true
    }
  }

  return punched
}

/** @deprecated Use {@link applyEraserLivePreviewPunchOut} */
export function repaintInkSessionSlicesForEraserPreview(
  paintDisplayCommands: readonly AnnotationCommand[],
  deadIndices: ReadonlySet<number>,
  prevDeadKey: string,
  inkSliceRefs: readonly (HTMLCanvasElement | null)[],
  markerSliceRefs: readonly (HTMLCanvasElement | null)[],
  markersOnSessionLayer: boolean,
  widthPx: number,
  heightPx: number,
): boolean {
  return applyEraserLivePreviewPunchOut(
    paintDisplayCommands,
    deadIndices,
    prevDeadKey,
    inkSliceRefs,
    markerSliceRefs,
    markersOnSessionLayer,
    widthPx,
    heightPx,
  )
}

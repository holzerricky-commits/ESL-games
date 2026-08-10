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
  type AnnotationRenderSlice,
  type BuildAnnotationRenderSlicesOptions,
} from '@/lib/books/annotation-render-slices'
import { canIncrementallyAppendSpreadSessionCommands } from '@/lib/books/spread-session-incremental-paint'
import { v2IncrementalCommittedPaintAllowed, type InkEngineV2PaintContext } from '@/lib/books/ink-engine-v2-contract'

export type InkPaintSliceOptions = BuildAnnotationRenderSlicesOptions

export type InkPaintPlanContext = InkEngineV2PaintContext & {
  /** Legacy spread path: dead-index set changed between frames. */
  deadKeyChanged?: boolean
}

export type InkPaintPlan =
  | { type: 'noop' }
  | { type: 'full_replay' }
  | { type: 'append'; commandIndex: number }
  | { type: 'punch_out'; removedCommands: readonly AnnotationCommand[] }
  | { type: 'replay_paint_slices'; paintSliceIndexes: readonly number[] }

export type InkPaintCanvasRefs = {
  inkSliceRefs: readonly (HTMLCanvasElement | null)[]
  markerSliceRefs: readonly (HTMLCanvasElement | null)[]
  markersOnSessionLayer: boolean
}

export type InkPaintFrame = {
  widthPx: number
  heightPx: number
  commands: readonly AnnotationCommand[]
  deadIndices: ReadonlySet<number>
  sliceOptions?: InkPaintSliceOptions
}

function commandIds(commands: readonly AnnotationCommand[]): Set<string> {
  return new Set(commands.map((c) => c.id))
}

function removedCommands(
  prev: readonly AnnotationCommand[],
  next: readonly AnnotationCommand[],
): AnnotationCommand[] {
  const nextIds = commandIds(next)
  return prev.filter((c) => !nextIds.has(c.id))
}

function addedCommandIndices(
  prev: readonly AnnotationCommand[],
  next: readonly AnnotationCommand[],
): number[] {
  const prevIds = commandIds(prev)
  const out: number[] = []
  for (let i = 0; i < next.length; i++) {
    if (!prevIds.has(next[i]!.id)) out.push(i)
  }
  return out
}

function commandsPaintEqual(a: AnnotationCommand, b: AnnotationCommand): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Indices where paint-relevant command content changed but id is unchanged. */
function patchedCommandIndices(
  prev: readonly AnnotationCommand[],
  next: readonly AnnotationCommand[],
): number[] {
  const len = Math.min(prev.length, next.length)
  const out: number[] = []
  for (let i = 0; i < len; i++) {
    const p = prev[i]!
    const n = next[i]!
    if (p.id !== n.id) continue
    if (!commandsPaintEqual(p, n)) out.push(i)
  }
  return out
}

/** Paint-slice index (ink + marker canvases only) for each command index, or -1 for DOM. */
export function buildCommandToPaintSliceIndex(
  slices: readonly AnnotationRenderSlice[],
  markersOnSessionLayer: boolean,
): Int32Array {
  let maxIndex = -1
  for (const slice of slices) {
    for (const i of slice.indices) maxIndex = Math.max(maxIndex, i)
  }
  const out = new Int32Array(Math.max(0, maxIndex + 1))
  out.fill(-1)
  let paintIdx = 0
  for (const slice of slices) {
    if (slice.kind === 'ink') {
      for (const i of slice.indices) out[i] = paintIdx
      paintIdx++
    } else if (slice.kind === 'marker' && markersOnSessionLayer) {
      for (const i of slice.indices) out[i] = paintIdx
      paintIdx++
    }
  }
  return out
}

export function paintSliceIndexesForCommandIndices(
  commandIndices: readonly number[],
  commandToPaintSlice: Int32Array,
): number[] {
  const out = new Set<number>()
  for (const i of commandIndices) {
    const paintIdx = commandToPaintSlice[i]
    if (paintIdx != null && paintIdx >= 0) out.add(paintIdx)
  }
  return [...out].sort((a, b) => a - b)
}

function countPaintSlices(
  slices: readonly AnnotationRenderSlice[],
  markersOnSessionLayer: boolean,
): number {
  let n = 0
  for (const slice of slices) {
    if (slice.kind === 'ink') n++
    else if (slice.kind === 'marker' && markersOnSessionLayer) n++
  }
  return n
}

/**
 * Plan the cheapest correct paint update.
 * Deletes (line eraser) never use destination-out punch-out — that left ghost pixels
 * while the scene was already correct (Ctrl+A empty). Prefer dirty-slice clear+redraw,
 * or full replay when slice layout changes.
 */
export function planInkSessionPaint(
  prev: readonly AnnotationCommand[],
  next: readonly AnnotationCommand[],
  ctx: InkPaintPlanContext = {},
  deadIndices: ReadonlySet<number> = new Set(),
  sliceOptions?: InkPaintSliceOptions,
  markersOnSessionLayer: boolean = true,
): InkPaintPlan {
  if (ctx.overlayAnimationActive || ctx.canvasResized || ctx.selectionTransformActive || ctx.deadKeyChanged) {
    return { type: 'full_replay' }
  }

  if (prev === next) return { type: 'noop' }

  const removed = removedCommands(prev, next)
  const addedIndices = addedCommandIndices(prev, next)
  const patched = patchedCommandIndices(prev, next)

  if (
    removed.length === 0 &&
    addedIndices.length === 0 &&
    patched.length === 0 &&
    prev.length === next.length
  ) {
    return { type: 'noop' }
  }

  if (
    removed.length === 0 &&
    addedIndices.length === 1 &&
    patched.length === 0 &&
    v2IncrementalCommittedPaintAllowed(prev, next, ctx)
  ) {
    return { type: 'append', commandIndex: addedIndices[0]! }
  }

  // Line eraser / deletes: always full replay. Dirty-slice + React canvas keys
  // (zIndex = first command index) remount later batches empty after index shifts,
  // and destination-out punch-out left ghost pixels. Full replay matches page-turn.
  if (removed.length > 0 && addedIndices.length === 0 && patched.length === 0) {
    return { type: 'full_replay' }
  }

  const prevSlices = buildAnnotationRenderSlices(prev, deadIndices, sliceOptions)
  const nextSlices = buildAnnotationRenderSlices(next, deadIndices, sliceOptions)
  const prevPaintCount = countPaintSlices(prevSlices, markersOnSessionLayer)
  const nextPaintCount = countPaintSlices(nextSlices, markersOnSessionLayer)

  // Slice count / batch boundaries shifted — only a full replay is safe.
  if (removed.length > 0 && prevPaintCount !== nextPaintCount) {
    return { type: 'full_replay' }
  }

  const nextToPaint = buildCommandToPaintSliceIndex(nextSlices, markersOnSessionLayer)
  const paintSliceIndexes = new Set<number>()
  for (const idx of paintSliceIndexesForCommandIndices([...addedIndices, ...patched], nextToPaint)) {
    paintSliceIndexes.add(idx)
  }

  if (removed.length > 0) {
    const prevToPaint = buildCommandToPaintSliceIndex(prevSlices, markersOnSessionLayer)
    for (const cmd of removed) {
      const idx = prev.findIndex((c) => c.id === cmd.id)
      if (idx >= 0) {
        const paintIdx = prevToPaint[idx]
        if (paintIdx != null && paintIdx >= 0) paintSliceIndexes.add(paintIdx)
      }
    }
  }

  const paintSliceList = [...paintSliceIndexes].sort((a, b) => a - b)
  if (paintSliceList.length === 0) return { type: 'full_replay' }

  return { type: 'replay_paint_slices', paintSliceIndexes: paintSliceList }
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

function findPaintSliceForRemovedCommand(
  commandIndex: number,
  slices: readonly AnnotationRenderSlice[],
  markersOnSessionLayer: boolean,
): { kind: 'ink' | 'marker'; paintIdx: number } | null {
  let inkIdx = 0
  let markerIdx = 0
  for (const slice of slices) {
    if (slice.kind === 'ink') {
      if (slice.indices.includes(commandIndex)) return { kind: 'ink', paintIdx: inkIdx }
      inkIdx++
    } else if (slice.kind === 'marker' && markersOnSessionLayer) {
      if (slice.indices.includes(commandIndex)) return { kind: 'marker', paintIdx: markerIdx }
      markerIdx++
    }
  }
  return null
}

export function executeInkPaintPunchOut(
  removedCommands: readonly AnnotationCommand[],
  prevCommands: readonly AnnotationCommand[],
  refs: InkPaintCanvasRefs,
  widthPx: number,
  heightPx: number,
  sliceOptions?: InkPaintSliceOptions,
): boolean {
  if (removedCommands.length === 0) return false
  const slices = buildAnnotationRenderSlices(prevCommands, new Set(), sliceOptions)
  const idToIndex = new Map(prevCommands.map((c, i) => [c.id, i] as const))
  let punched = false

  for (const cmd of removedCommands) {
    const cmdIndex = idToIndex.get(cmd.id)
    if (cmdIndex == null) continue
    const hit = findPaintSliceForRemovedCommand(cmdIndex, slices, refs.markersOnSessionLayer)
    if (!hit) continue
    const el =
      hit.kind === 'ink' ? refs.inkSliceRefs[hit.paintIdx] : refs.markerSliceRefs[hit.paintIdx]
    const ctx = el?.getContext('2d', { alpha: true })
    if (!ctx) continue
    applyAnnotationCanvasDpr(ctx)
    punchOutCommandOnCanvas(ctx, prevCommands[cmdIndex]!, widthPx, heightPx)
    punched = true
  }

  return punched
}

function replayPaintSliceAtIndex(
  paintSliceIndex: number,
  slices: readonly AnnotationRenderSlice[],
  commands: readonly AnnotationCommand[],
  refs: InkPaintCanvasRefs,
  widthPx: number,
  heightPx: number,
  nowMs: number,
): boolean {
  let unifiedIdx = 0
  let inkIdx = 0
  let markerIdx = 0
  for (const slice of slices) {
    if (slice.kind === 'ink') {
      if (unifiedIdx === paintSliceIndex) {
        const el = refs.inkSliceRefs[inkIdx]
        const ctx = el?.getContext('2d', { alpha: true })
        if (!ctx) return false
        clearAnnotationCanvas(ctx)
        applyAnnotationCanvasDpr(ctx)
        for (const index of slice.indices) {
          drawAnnotationCommandWithPasteReveal(ctx, commands[index]!, widthPx, heightPx, undefined, nowMs)
        }
        return true
      }
      unifiedIdx++
      inkIdx++
    } else if (slice.kind === 'marker' && refs.markersOnSessionLayer) {
      if (unifiedIdx === paintSliceIndex) {
        const el = refs.markerSliceRefs[markerIdx]
        const ctx = el?.getContext('2d', { alpha: true })
        if (!ctx) return false
        clearAnnotationCanvas(ctx)
        applyAnnotationCanvasDpr(ctx)
        for (const index of slice.indices) {
          drawAnnotationCommandWithPasteReveal(ctx, commands[index]!, widthPx, heightPx, undefined, nowMs)
        }
        return true
      }
      unifiedIdx++
      markerIdx++
    }
  }
  return false
}

export function executeInkPaintReplaySlices(
  paintSliceIndexes: readonly number[],
  commands: readonly AnnotationCommand[],
  refs: InkPaintCanvasRefs,
  widthPx: number,
  heightPx: number,
  deadIndices: ReadonlySet<number>,
  sliceOptions?: InkPaintSliceOptions,
  nowMs: number = Date.now(),
): boolean {
  const slices = buildAnnotationRenderSlices(commands, deadIndices, sliceOptions)
  for (const idx of paintSliceIndexes) {
    if (!replayPaintSliceAtIndex(idx, slices, commands, refs, widthPx, heightPx, nowMs)) {
      return false
    }
  }
  return true
}

export function executeInkPaintAppend(
  commandIndex: number,
  commands: readonly AnnotationCommand[],
  refs: InkPaintCanvasRefs,
  widthPx: number,
  heightPx: number,
  deadIndices: ReadonlySet<number>,
  sliceOptions?: InkPaintSliceOptions,
): boolean {
  const cmd = commands[commandIndex]
  if (!cmd) return false
  const slices = buildAnnotationRenderSlices(commands, deadIndices, sliceOptions)
  const lastSlice = slices[slices.length - 1]
  const drawCmd = (ctx: CanvasRenderingContext2D, command: AnnotationCommand) => {
    applyAnnotationCanvasDpr(ctx)
    drawAnnotationCommandWithPasteReveal(ctx, command, widthPx, heightPx)
  }

  if (
    refs.markersOnSessionLayer &&
    lastSlice?.kind === 'marker' &&
    isMarkerStrokeCommand(cmd) &&
    lastSlice.indices[0] === commandIndex
  ) {
    const markerIdx =
      slices.filter((s) => s.kind === 'marker').length - 1
    const el = refs.markerSliceRefs[markerIdx]
    const ctx = el?.getContext('2d', { alpha: true })
    if (ctx) {
      drawCmd(ctx, cmd)
      return true
    }
    return false
  }

  if (lastSlice?.kind === 'ink' && !isMarkerStrokeCommand(cmd) && lastSlice.indices.includes(commandIndex)) {
    const inkIdx = slices.filter((s) => s.kind === 'ink').length - 1
    const el = refs.inkSliceRefs[inkIdx]
    const ctx = el?.getContext('2d', { alpha: true })
    if (ctx) {
      drawCmd(ctx, cmd)
      return true
    }
    return false
  }

  return false
}

export function executeInkPaintFullReplay(
  frame: InkPaintFrame,
  refs: InkPaintCanvasRefs,
  trailingMarkerStrokeDraft?: {
    tool: 'marker'
    points: readonly (readonly [number, number])[]
    widthScale?: number
    color?: string
    lineDashStyle?: StrokeAnnotationCommand['lineDashStyle']
    markerDecoratedEdge?: boolean
  } | null,
): void {
  const { widthPx, heightPx, commands, deadIndices, sliceOptions } = frame
  const slices = buildAnnotationRenderSlices(commands, deadIndices, sliceOptions)
  const inkCount = slices.filter((s) => s.kind === 'ink').length
  const markerCount = refs.markersOnSessionLayer ? slices.filter((s) => s.kind === 'marker').length : 0
  const now = Date.now()

  let inkIdx = 0
  let markerIdx = 0
  for (const slice of slices) {
    if (slice.kind === 'ink') {
      const el = refs.inkSliceRefs[inkIdx++]
      const inkCtx = el?.getContext('2d', { alpha: true })
      if (!inkCtx) continue
      clearAnnotationCanvas(inkCtx)
      applyAnnotationCanvasDpr(inkCtx)
      for (const index of slice.indices) {
        drawAnnotationCommandWithPasteReveal(inkCtx, commands[index]!, widthPx, heightPx, undefined, now)
      }
    } else if (slice.kind === 'marker' && refs.markersOnSessionLayer) {
      const el = refs.markerSliceRefs[markerIdx++]
      const markerCtx = el?.getContext('2d', { alpha: true })
      if (!markerCtx) continue
      clearAnnotationCanvas(markerCtx)
      applyAnnotationCanvasDpr(markerCtx)
      for (const index of slice.indices) {
        drawAnnotationCommandWithPasteReveal(markerCtx, commands[index]!, widthPx, heightPx, undefined, now)
      }
    }
  }

  for (let i = inkIdx; i < refs.inkSliceRefs.length; i++) {
    const el = refs.inkSliceRefs[i]
    const ctx = el?.getContext('2d', { alpha: true })
    if (ctx) clearAnnotationCanvas(ctx)
  }
  for (let i = markerIdx; i < refs.markerSliceRefs.length; i++) {
    const el = refs.markerSliceRefs[i]
    const ctx = el?.getContext('2d', { alpha: true })
    if (ctx) clearAnnotationCanvas(ctx)
  }

  if (refs.markersOnSessionLayer && trailingMarkerStrokeDraft) {
    paintTrailingMarkerDraft(refs, widthPx, heightPx, trailingMarkerStrokeDraft)
  }
}

export function paintTrailingMarkerDraft(
  refs: Pick<InkPaintCanvasRefs, 'trailingMarkerCanvasRef'> & { trailingMarkerCanvasRef: { current: HTMLCanvasElement | null } },
  widthPx: number,
  heightPx: number,
  trailingMarkerStrokeDraft: {
    tool: 'marker'
    points: readonly (readonly [number, number])[]
    widthScale?: number
    color?: string
    lineDashStyle?: StrokeAnnotationCommand['lineDashStyle']
    markerDecoratedEdge?: boolean
  },
): void {
  const el = refs.trailingMarkerCanvasRef.current
  const ctx = el?.getContext('2d', { alpha: true })
  if (!ctx) return
  clearAnnotationCanvas(ctx)
  if (trailingMarkerStrokeDraft.points.length < 1) return
  applyAnnotationCanvasDpr(ctx)
  const trailCmd: StrokeAnnotationCommand = {
    kind: 'stroke',
    id: '__trailing_marker__',
    tool: 'marker',
    points: trailingMarkerStrokeDraft.points.map((p) => [p[0], p[1]] as [number, number]),
    ...(trailingMarkerStrokeDraft.widthScale != null
      ? { widthScale: trailingMarkerStrokeDraft.widthScale }
      : {}),
    ...(trailingMarkerStrokeDraft.color ? { color: trailingMarkerStrokeDraft.color } : {}),
    ...(trailingMarkerStrokeDraft.lineDashStyle
      ? { lineDashStyle: trailingMarkerStrokeDraft.lineDashStyle }
      : {}),
    ...(trailingMarkerStrokeDraft.markerDecoratedEdge ? { markerDecoratedEdge: true } : {}),
  }
  drawStrokePath(ctx, trailCmd, widthPx, heightPx)
}

export type RunInkSessionPaintResult = {
  plan: InkPaintPlan
  usedIncremental: boolean
}

/** Plan + execute one committed paint frame (R3 PaintEngine entry). */
export function runInkSessionPaint(
  prev: readonly AnnotationCommand[],
  prevDeadKey: string,
  next: readonly AnnotationCommand[],
  deadIndices: ReadonlySet<number>,
  deadKey: string,
  refs: InkPaintCanvasRefs & { trailingMarkerCanvasRef: { current: HTMLCanvasElement | null } },
  widthPx: number,
  heightPx: number,
  ctx: InkPaintPlanContext,
  sliceOptions?: InkPaintSliceOptions,
  trailingMarkerStrokeDraft?: Parameters<typeof paintTrailingMarkerDraft>[3] | null,
): RunInkSessionPaintResult {
  const plan = planInkSessionPaint(
    prev,
    next,
    {
      ...ctx,
      deadKeyChanged: deadKey !== prevDeadKey,
    },
    deadIndices,
    sliceOptions,
    refs.markersOnSessionLayer,
  )
  const frame: InkPaintFrame = { widthPx, heightPx, commands: next, deadIndices, sliceOptions }

  switch (plan.type) {
    case 'noop':
      if (refs.markersOnSessionLayer && trailingMarkerStrokeDraft) {
        paintTrailingMarkerDraft(refs, widthPx, heightPx, trailingMarkerStrokeDraft)
      }
      return { plan, usedIncremental: true }
    case 'append': {
      const ok = executeInkPaintAppend(
        plan.commandIndex,
        next,
        refs,
        widthPx,
        heightPx,
        deadIndices,
        sliceOptions,
      )
      if (!ok) {
        executeInkPaintFullReplay(frame, refs, trailingMarkerStrokeDraft)
        return { plan: { type: 'full_replay' }, usedIncremental: false }
      }
      if (refs.markersOnSessionLayer && trailingMarkerStrokeDraft) {
        paintTrailingMarkerDraft(refs, widthPx, heightPx, trailingMarkerStrokeDraft)
      }
      return { plan, usedIncremental: true }
    }
    case 'punch_out': {
      const ok = executeInkPaintPunchOut(
        plan.removedCommands,
        prev,
        refs,
        widthPx,
        heightPx,
        sliceOptions,
      )
      if (!ok) {
        executeInkPaintFullReplay(frame, refs, trailingMarkerStrokeDraft)
        return { plan: { type: 'full_replay' }, usedIncremental: false }
      }
      if (refs.markersOnSessionLayer && trailingMarkerStrokeDraft) {
        paintTrailingMarkerDraft(refs, widthPx, heightPx, trailingMarkerStrokeDraft)
      }
      return { plan, usedIncremental: true }
    }
    case 'replay_paint_slices': {
      const ok = executeInkPaintReplaySlices(
        plan.paintSliceIndexes,
        next,
        refs,
        widthPx,
        heightPx,
        deadIndices,
        sliceOptions,
      )
      if (!ok) {
        executeInkPaintFullReplay(frame, refs, trailingMarkerStrokeDraft)
        return { plan: { type: 'full_replay' }, usedIncremental: false }
      }
      if (refs.markersOnSessionLayer && trailingMarkerStrokeDraft) {
        paintTrailingMarkerDraft(refs, widthPx, heightPx, trailingMarkerStrokeDraft)
      }
      return { plan, usedIncremental: true }
    }
    case 'full_replay':
    default:
      executeInkPaintFullReplay(frame, refs, trailingMarkerStrokeDraft)
      return { plan: { type: 'full_replay' }, usedIncremental: false }
  }
}

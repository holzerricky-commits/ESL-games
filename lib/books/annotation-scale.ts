import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import {
  getAnnotationBounds,
  unionNormRects,
  type NormRect,
} from '@/lib/books/annotation-select'
import { SELECTION_HANDLE_HIT_RADIUS_PX } from '@/lib/books/annotation-selection-chrome'

export type ScaleHandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

const MIN_BOUNDS_NORM = 0.02

const HANDLE_ORDER: ScaleHandleId[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

function mapPointInBounds(
  p: [number, number],
  start: NormRect,
  next: NormRect,
): [number, number] {
  const relX = start.w > 1e-9 ? (p[0] - start.x) / start.w : 0
  const relY = start.h > 1e-9 ? (p[1] - start.y) / start.h : 0
  return [clamp01(next.x + relX * next.w), clamp01(next.y + relY * next.h)]
}

/** Union bounds of all selected commands. */
export function unionSelectionBounds(
  commands: readonly AnnotationCommand[],
  selectedIds: readonly string[],
  widthPx: number,
  heightPx: number,
  deadIndices?: ReadonlySet<number>,
): NormRect | null {
  const rects: NormRect[] = []
  const idSet = new Set(selectedIds)
  for (let i = 0; i < commands.length; i++) {
    if (deadIndices?.has(i)) continue
    const cmd = commands[i]!
    if (!idSet.has(cmd.id)) continue
    const b = getAnnotationBounds(cmd, widthPx, heightPx)
    if (b && b.w > 0 && b.h > 0) rects.push(b)
  }
  return unionNormRects(rects)
}

/** Normalized center of each scale handle on a bounds rect. */
export function scaleHandlePositions(bounds: NormRect): Record<ScaleHandleId, [number, number]> {
  const { x, y, w, h } = bounds
  const cx = x + w / 2
  const cy = y + h / 2
  const x2 = x + w
  const y2 = y + h
  return {
    nw: [x, y],
    n: [cx, y],
    ne: [x2, y],
    e: [x2, cy],
    se: [x2, y2],
    s: [cx, y2],
    sw: [x, y2],
    w: [x, cy],
  }
}

export function hitTestScaleHandle(
  p: [number, number],
  bounds: NormRect,
  widthPx: number,
  heightPx: number,
  hitRadiusPx: number = SELECTION_HANDLE_HIT_RADIUS_PX,
): ScaleHandleId | null {
  if (widthPx <= 0 || heightPx <= 0) return null
  const px = p[0] * widthPx
  const py = p[1] * heightPx
  const r2 = hitRadiusPx * hitRadiusPx
  const positions = scaleHandlePositions(bounds)
  for (const id of HANDLE_ORDER) {
    const [hx, hy] = positions[id]!
    const dx = px - hx * widthPx
    const dy = py - hy * heightPx
    if (dx * dx + dy * dy <= r2) return id
  }
  return null
}

export function cursorForScaleHandle(handle: ScaleHandleId): string {
  switch (handle) {
    case 'nw':
    case 'se':
      return 'nwse-resize'
    case 'ne':
    case 'sw':
      return 'nesw-resize'
    case 'n':
    case 's':
      return 'ns-resize'
    case 'e':
    case 'w':
      return 'ew-resize'
    default:
      return 'default'
  }
}

export type ResizeBoundsOptions = {
  uniform?: boolean
  minSizeNorm?: number
}

/** Max uniform scale before the selection box hits the page edge (norm 0–1). */
function maxUniformScaleForHandle(start: NormRect, handle: ScaleHandleId): number {
  const { x, y, w, h } = start
  if (w <= 1e-9 || h <= 1e-9) return 1
  switch (handle) {
    case 'se':
      return Math.min((1 - x) / w, (1 - y) / h)
    case 'nw':
      return Math.min((x + w) / w, (y + h) / h)
    case 'ne':
      return Math.min((1 - x) / w, (y + h) / h)
    case 'sw':
      return Math.min((x + w) / w, (1 - y) / h)
    case 'e':
      return Math.min((1 - x) / w, (1 - y) / h)
    case 'w':
      return Math.min((x + w) / w, (1 - y) / h)
    case 's':
      return Math.min((1 - x) / w, (1 - y) / h)
    case 'n':
      return Math.min((1 - x) / w, (y + h) / h)
    default:
      return 1
  }
}

function boundsFromUniformScale(
  start: NormRect,
  handle: ScaleHandleId,
  scale: number,
  min: number,
): NormRect {
  const w = Math.max(min, start.w * scale)
  const h = Math.max(min, start.h * scale)
  let x = start.x
  let y = start.y
  if (handle === 'nw' || handle === 'w' || handle === 'sw') {
    x = start.x + start.w - w
  }
  if (handle === 'nw' || handle === 'n' || handle === 'ne') {
    y = start.y + start.h - h
  }
  return { x, y, w, h }
}

function clampNormRect(rect: NormRect, min: number): NormRect {
  let { x, y, w, h } = rect
  w = Math.max(min, w)
  h = Math.max(min, h)
  x = clamp01(x)
  y = clamp01(y)
  if (x + w > 1) {
    w = Math.max(min, 1 - x)
  }
  if (y + h > 1) {
    h = Math.max(min, 1 - y)
  }
  if (x + w > 1) {
    x = Math.max(0, 1 - w)
  }
  if (y + h > 1) {
    y = Math.max(0, 1 - h)
  }
  return { x, y, w, h }
}

/** Compute new bounds while dragging a scale handle. */
export function resizeBoundsFromHandle(
  start: NormRect,
  handle: ScaleHandleId,
  pointer: [number, number],
  opts?: ResizeBoundsOptions,
): NormRect {
  const min = opts?.minSizeNorm ?? MIN_BOUNDS_NORM
  let x = start.x
  let y = start.y
  let x2 = start.x + start.w
  let y2 = start.y + start.h
  const px = clamp01(pointer[0])
  const py = clamp01(pointer[1])

  switch (handle) {
    case 'se':
      x2 = px
      y2 = py
      break
    case 'nw':
      x = px
      y = py
      break
    case 'ne':
      x2 = px
      y = py
      break
    case 'sw':
      x = px
      y2 = py
      break
    case 'e':
      x2 = px
      break
    case 'w':
      x = px
      break
    case 's':
      y2 = py
      break
    case 'n':
      y = py
      break
    default:
      break
  }

  if (x2 < x) {
    const m = (x + x2) / 2
    x = m
    x2 = m
  }
  if (y2 < y) {
    const m = (y + y2) / 2
    y = m
    y2 = m
  }

  let w = Math.max(min, x2 - x)
  let h = Math.max(min, y2 - y)

  if (opts?.uniform && start.w > 1e-9 && start.h > 1e-9) {
    const sx = w / start.w
    const sy = h / start.h
    const minScale = Math.max(min / start.w, min / start.h)
    const maxScale = maxUniformScaleForHandle(start, handle)
    let scale = Math.max(sx, sy, minScale)
    if (Number.isFinite(maxScale)) {
      scale = Math.min(scale, maxScale)
    }
    return boundsFromUniformScale(start, handle, scale, min)
  }

  return clampNormRect({ x, y, w, h }, min)
}

const UNIFORM_SCALE_EPS = 1e-6

function axisScales(start: NormRect, next: NormRect): { sx: number; sy: number } {
  const sx = start.w > 1e-9 ? next.w / start.w : 1
  const sy = start.h > 1e-9 ? next.h / start.h : 1
  return { sx, sy }
}

/** Scale factor for stroke weight, fonts, and symbol size (locked aspect → sx; free → √(sx·sy)). */
export function thicknessScaleFromBounds(start: NormRect, next: NormRect): number {
  const { sx, sy } = axisScales(start, next)
  if (Math.abs(sx - sy) <= UNIFORM_SCALE_EPS) return sx
  return Math.sqrt(Math.max(1e-6, sx * sy))
}

/** Scale one command relative to selection start bounds → new bounds. */
export function scaleAnnotationCommand(
  cmd: AnnotationCommand,
  startBounds: NormRect,
  newBounds: NormRect,
): AnnotationCommand {
  const thicknessScale = thicknessScaleFromBounds(startBounds, newBounds)

  switch (cmd.kind) {
    case 'stroke':
      return {
        ...cmd,
        points: cmd.points.map((p) => mapPointInBounds(p, startBounds, newBounds)),
        widthScale: (cmd.widthScale ?? 1) * thicknessScale,
      }
    case 'line':
      return {
        ...cmd,
        a: mapPointInBounds(cmd.a, startBounds, newBounds),
        b: mapPointInBounds(cmd.b, startBounds, newBounds),
        widthScale: (cmd.widthScale ?? 1) * thicknessScale,
      }
    case 'arrow':
      return {
        ...cmd,
        from: mapPointInBounds(cmd.from, startBounds, newBounds),
        to: mapPointInBounds(cmd.to, startBounds, newBounds),
        widthScale: (cmd.widthScale ?? 1) * thicknessScale,
        headLengthNorm: (cmd.headLengthNorm ?? 0.035) * thicknessScale,
      }
    case 'rect':
    case 'ellipse':
    case 'triangle': {
      const p0 = mapPointInBounds([cmd.x, cmd.y], startBounds, newBounds)
      const p1 = mapPointInBounds([cmd.x + cmd.w, cmd.y + cmd.h], startBounds, newBounds)
      return {
        ...cmd,
        x: Math.min(p0[0], p1[0]),
        y: Math.min(p0[1], p1[1]),
        w: Math.max(MIN_BOUNDS_NORM, Math.abs(p1[0] - p0[0])),
        h: Math.max(MIN_BOUNDS_NORM, Math.abs(p1[1] - p0[1])),
        strokeWidthScale: (cmd.strokeWidthScale ?? 1) * thicknessScale,
      }
    }
    case 'stamp':
    case 'callout': {
      const center = mapPointInBounds(cmd.center, startBounds, newBounds)
      const nextScale = (cmd.scale ?? 1) * thicknessScale
      return { ...cmd, center, scale: nextScale }
    }
    case 'text': {
      const pos = mapPointInBounds([cmd.x, cmd.y], startBounds, newBounds)
      const nextFont = Math.max(0.008, cmd.fontSizeNorm * thicknessScale)
      return {
        ...cmd,
        x: pos[0],
        y: pos[1],
        fontSizeNorm: nextFont,
        ...(cmd.maxWidthNorm != null
          ? { maxWidthNorm: cmd.maxWidthNorm * thicknessScale }
          : {}),
      }
    }
    case 'sticky': {
      const p0 = mapPointInBounds([cmd.x, cmd.y], startBounds, newBounds)
      const p1 = mapPointInBounds([cmd.x + cmd.w, cmd.y + cmd.h], startBounds, newBounds)
      return {
        ...cmd,
        x: Math.min(p0[0], p1[0]),
        y: Math.min(p0[1], p1[1]),
        w: Math.max(MIN_BOUNDS_NORM, Math.abs(p1[0] - p0[0])),
        h: Math.max(MIN_BOUNDS_NORM, Math.abs(p1[1] - p0[1])),
        fontSizeNorm: Math.max(0.008, cmd.fontSizeNorm * thicknessScale),
      }
    }
    default:
      return cmd
  }
}

export function scaleAnnotationCommands(
  commands: AnnotationCommand[],
  ids: ReadonlySet<string>,
  startBounds: NormRect,
  newBounds: NormRect,
): AnnotationCommand[] {
  if (
    startBounds.w <= 0 ||
    startBounds.h <= 0 ||
    newBounds.w <= 0 ||
    newBounds.h <= 0
  ) {
    return commands
  }
  return commands.map((c) =>
    ids.has(c.id) ? scaleAnnotationCommand(c, startBounds, newBounds) : c,
  )
}

import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import {
  getAnnotationBounds,
  resolveSelectionHandleFrame,
  unionNormRects,
  type NormRect,
  type OrientedSelectionFrame,
} from '@/lib/books/annotation-select'
import {
  boxShapeCornersNorm,
  degToRad,
  normalizeDeg,
  radToDeg,
  rotateNormPointInPixelSpace,
} from '@/lib/books/annotation-rotation'
import { SELECTION_HANDLE_HIT_RADIUS_PX } from '@/lib/books/annotation-selection-chrome'
import { TEXT_FONT_SIZE_NORM_MIN } from '@/lib/books/text-font-size-min'

export type ScaleHandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

const MIN_BOUNDS_NORM = 0.02

const HANDLE_ORDER: ScaleHandleId[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

const CORNER_HANDLE_IDS = ['nw', 'ne', 'se', 'sw'] as const satisfies readonly ScaleHandleId[]

type CornerHandleId = (typeof CORNER_HANDLE_IDS)[number]

/** Opposite handle for symmetric resize semantics. */
export function oppositeScaleHandle(handle: ScaleHandleId): ScaleHandleId {
  switch (handle) {
    case 'nw':
      return 'se'
    case 'se':
      return 'nw'
    case 'ne':
      return 'sw'
    case 'sw':
      return 'ne'
    case 'n':
      return 's'
    case 's':
      return 'n'
    case 'e':
      return 'w'
    case 'w':
      return 'e'
    default:
      return handle
  }
}

/** Fixed page anchor for uniform resize (matches boundsFromUniformScale corner locks). */
export function uniformScaleAnchorHandle(handle: ScaleHandleId): ScaleHandleId {
  switch (handle) {
    case 'nw':
      return 'se'
    case 'se':
      return 'nw'
    case 'ne':
      return 'sw'
    case 'sw':
      return 'ne'
    case 'e':
    case 's':
      return 'nw'
    case 'w':
      return 'ne'
    case 'n':
      return 'sw'
    default:
      return oppositeScaleHandle(handle)
  }
}

function normDistPx(
  a: [number, number],
  b: [number, number],
  widthPx: number,
  heightPx: number,
): number {
  const dx = (a[0] - b[0]) * widthPx
  const dy = (a[1] - b[1]) * heightPx
  return Math.sqrt(dx * dx + dy * dy)
}

/** Uniform scale from pointer distance to a fixed page anchor (pixel space). */
export function uniformScaleFactorFromPageAnchor(
  anchorPage: [number, number],
  handleStartPage: [number, number],
  pointer: [number, number],
  widthPx: number,
  heightPx: number,
): number {
  const startDist = normDistPx(anchorPage, handleStartPage, widthPx, heightPx)
  if (startDist < 1e-6) return 1
  const nextDist = normDistPx(anchorPage, pointer, widthPx, heightPx)
  return nextDist / startDist
}

function orientedRectFromPageCorners(
  corners: Record<CornerHandleId, [number, number]>,
  rotationDeg: number,
  widthPx: number,
  heightPx: number,
  min: number,
): NormRect {
  const pts = CORNER_HANDLE_IDS.map((id) => corners[id])
  const cx = pts.reduce((s, p) => s + p[0], 0) / 4
  const cy = pts.reduce((s, p) => s + p[1], 0) / 4
  const pivot: [number, number] = [cx, cy]
  const rad = degToRad(rotationDeg)
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const pt of pts) {
    const [lx, ly] =
      Math.abs(rad) < 1e-9
        ? pt
        : rotateNormPointInPixelSpace(pt, pivot, -rad, widthPx, heightPx)
    minX = Math.min(minX, lx)
    maxX = Math.max(maxX, lx)
    minY = Math.min(minY, ly)
    maxY = Math.max(maxY, ly)
  }
  return clampNormRect(
    {
      x: minX,
      y: minY,
      w: Math.max(min, maxX - minX),
      h: Math.max(min, maxY - minY),
    },
    min,
  )
}

function inferUniformScaleAnchorPage(
  start: OrientedSelectionFrame,
  next: OrientedSelectionFrame,
  widthPx: number,
  heightPx: number,
): [number, number] {
  const startCorners = orientedFrameHandlePositionsNorm(start, widthPx, heightPx)
  const nextCorners = orientedFrameHandlePositionsNorm(next, widthPx, heightPx)
  let bestId: CornerHandleId = 'nw'
  let bestDist = Infinity
  for (const id of CORNER_HANDLE_IDS) {
    const d = normDistPx(startCorners[id]!, nextCorners[id]!, widthPx, heightPx)
    if (d < bestDist) {
      bestDist = d
      bestId = id
    }
  }
  return startCorners[bestId]!
}

function resizeOrientedFrameUniformFromPageAnchor(
  start: OrientedSelectionFrame,
  handle: ScaleHandleId,
  pointer: [number, number],
  widthPx: number,
  heightPx: number,
  opts?: ResizeBoundsOptions,
): OrientedSelectionFrame {
  const min = opts?.minSizeNorm ?? MIN_BOUNDS_NORM
  const positions = orientedFrameHandlePositionsNorm(start, widthPx, heightPx)
  const anchorId = uniformScaleAnchorHandle(handle)
  const anchorPage = positions[anchorId]!
  const handleStartPage = positions[handle]!

  let scale = uniformScaleFactorFromPageAnchor(
    anchorPage,
    handleStartPage,
    pointer,
    widthPx,
    heightPx,
  )
  const minScale = Math.max(min / start.rect.w, min / start.rect.h)
  const maxScale = maxUniformScaleForHandle(start.rect, handle)
  scale = Math.max(scale, minScale)
  if (Number.isFinite(maxScale)) {
    scale = Math.min(scale, maxScale)
  }

  const scaledCorners = {} as Record<CornerHandleId, [number, number]>
  for (const id of CORNER_HANDLE_IDS) {
    const p = positions[id]!
    scaledCorners[id] = [
      anchorPage[0] + (p[0] - anchorPage[0]) * scale,
      anchorPage[1] + (p[1] - anchorPage[1]) * scale,
    ]
  }

  const nextRect = orientedRectFromPageCorners(
    scaledCorners,
    start.rotationDeg,
    widthPx,
    heightPx,
    min,
  )
  return { rect: nextRect, rotationDeg: start.rotationDeg }
}

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

/** Full page / board document in normalized ink space. */
export const PAGE_CANVAS_NORM_RECT: NormRect = { x: 0, y: 0, w: 1, h: 1 }

/** Minimum on-canvas slice when partially off-page (~24px at 800px width). */
export const SELECTION_MIN_VISIBLE_GRAB_NORM = 0.03

export type SelectionMoveClampContext = {
  widthPx: number
  heightPx: number
  canvas?: NormRect
  deadIndices?: ReadonlySet<number>
}

function clampAxisTranslationDelta(
  minB: number,
  maxB: number,
  delta: number,
  canvasMin: number,
  canvasMax: number,
  minVisible: number,
): number {
  const span = Math.max(0, maxB - minB)
  const grab = Math.min(minVisible, span > 0 ? span : minVisible)
  const deltaMin = canvasMin + grab - maxB
  const deltaMax = canvasMax - grab - minB
  if (deltaMin > deltaMax) return (deltaMin + deltaMax) / 2
  return Math.max(deltaMin, Math.min(deltaMax, delta))
}

/** Clamp a translation so a grab-sized portion of `bounds` stays on `canvas`. */
export function clampSelectionTranslationDelta(
  bounds: NormRect,
  dx: number,
  dy: number,
  canvas: NormRect = PAGE_CANVAS_NORM_RECT,
  minGrabNorm: number = SELECTION_MIN_VISIBLE_GRAB_NORM,
): { dx: number; dy: number } {
  const canvasMinX = canvas.x
  const canvasMaxX = canvas.x + canvas.w
  const canvasMinY = canvas.y
  const canvasMaxY = canvas.y + canvas.h
  const minX = bounds.x
  const maxX = bounds.x + bounds.w
  const minY = bounds.y
  const maxY = bounds.y + bounds.h
  const grabW = Math.min(minGrabNorm, bounds.w)
  const grabH = Math.min(minGrabNorm, bounds.h)
  return {
    dx: clampAxisTranslationDelta(minX, maxX, dx, canvasMinX, canvasMaxX, grabW),
    dy: clampAxisTranslationDelta(minY, maxY, dy, canvasMinY, canvasMaxY, grabH),
  }
}

/** Clamp move delta for the current selection union bounds. */
export function clampSelectionMoveDelta(
  commands: readonly AnnotationCommand[],
  selectedIds: readonly string[],
  dx: number,
  dy: number,
  widthPx: number,
  heightPx: number,
  options?: {
    canvas?: NormRect
    deadIndices?: ReadonlySet<number>
    minGrabNorm?: number
  },
): { dx: number; dy: number } {
  if (dx === 0 && dy === 0) return { dx: 0, dy: 0 }
  const bounds = unionSelectionBounds(
    commands,
    selectedIds,
    widthPx,
    heightPx,
    options?.deadIndices,
  )
  if (!bounds) return { dx: 0, dy: 0 }
  return clampSelectionTranslationDelta(
    bounds,
    dx,
    dy,
    options?.canvas ?? PAGE_CANVAS_NORM_RECT,
    options?.minGrabNorm,
  )
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

export function orientedFrameHandlePositionsNorm(
  frame: OrientedSelectionFrame,
  widthPx: number,
  heightPx: number,
): Record<ScaleHandleId, [number, number]> {
  const local = scaleHandlePositions(frame.rect)
  const cx = frame.rect.x + frame.rect.w / 2
  const cy = frame.rect.y + frame.rect.h / 2
  const rad = degToRad(frame.rotationDeg)
  if (Math.abs(rad) < 1e-6) return local
  const out = { ...local }
  for (const id of HANDLE_ORDER) {
    out[id] = rotateNormPointInPixelSpace(local[id]!, [cx, cy], rad, widthPx, heightPx)
  }
  return out
}

export function hitTestScaleHandleForFrame(
  p: [number, number],
  frame: OrientedSelectionFrame,
  widthPx: number,
  heightPx: number,
  hitRadiusPx: number = SELECTION_HANDLE_HIT_RADIUS_PX,
): ScaleHandleId | null {
  if (widthPx <= 0 || heightPx <= 0) return null
  const px = p[0] * widthPx
  const py = p[1] * heightPx
  const r2 = hitRadiusPx * hitRadiusPx
  const positions = orientedFrameHandlePositionsNorm(frame, widthPx, heightPx)
  for (const id of HANDLE_ORDER) {
    const [hx, hy] = positions[id]!
    const dx = px - hx * widthPx
    const dy = py - hy * heightPx
    if (dx * dx + dy * dy <= r2) return id
  }
  return null
}

export function hitTestScaleHandle(
  p: [number, number],
  bounds: NormRect,
  widthPx: number,
  heightPx: number,
  hitRadiusPx: number = SELECTION_HANDLE_HIT_RADIUS_PX,
): ScaleHandleId | null {
  return hitTestScaleHandleForFrame(
    p,
    { rect: bounds, rotationDeg: 0 },
    widthPx,
    heightPx,
    hitRadiusPx,
  )
}

/**
 * Photoshop / Fabric.js: cursor from the handle's screen direction (center → handle),
 * snapped to the nearest 45° sector. Mapped to CSS bidirectional resize cursors.
 * @see fabric.js scaleCursorStyleHandler + findCornerQuadrant
 */
const RESIZE_CURSOR_BY_SECTOR = [
  'ew-resize', // 0°   east
  'nwse-resize', // 45°  south-east
  'ns-resize', // 90°  south
  'nesw-resize', // 135° south-west
  'ew-resize', // 180° west
  'nwse-resize', // 225° north-west
  'ns-resize', // 270° north
  'nesw-resize', // 315° north-east
] as const

function resizeCursorForHandleScreenAngle(deg: number): string {
  const a = ((deg % 360) + 360) % 360
  const sector = Math.round(a / 45) % 8
  return RESIZE_CURSOR_BY_SECTOR[sector]!
}

function handleScreenAngleDeg(
  handle: ScaleHandleId,
  frame: OrientedSelectionFrame,
  widthPx: number,
  heightPx: number,
): number {
  if (widthPx <= 0 || heightPx <= 0) return 0
  const positions = orientedFrameHandlePositionsNorm(frame, widthPx, heightPx)
  const cx = (frame.rect.x + frame.rect.w / 2) * widthPx
  const cy = (frame.rect.y + frame.rect.h / 2) * heightPx
  const [hx, hy] = positions[handle]!
  const dx = hx * widthPx - cx
  const dy = hy * heightPx - cy
  if (dx * dx + dy * dy < 1e-6) return 0
  return normalizeDeg(radToDeg(Math.atan2(dy, dx)))
}

/** Resize cursor for a handle on an oriented frame (accounts for box rotation). */
export function cursorForScaleHandleOnFrame(
  handle: ScaleHandleId,
  frame: OrientedSelectionFrame,
  widthPx: number,
  heightPx: number,
): string {
  return resizeCursorForHandleScreenAngle(handleScreenAngleDeg(handle, frame, widthPx, heightPx))
}

export function cursorForScaleHandle(handle: ScaleHandleId): string {
  return cursorForScaleHandleOnFrame(handle, { rect: { x: 0, y: 0, w: 1, h: 1 }, rotationDeg: 0 }, 1, 1)
}

/** Handle frame for hit-testing and cursors — matches selection chrome render inputs. */
export function resolveSelectionInteractionFrame(
  commands: readonly AnnotationCommand[],
  selectedIds: readonly string[],
  widthPx: number,
  heightPx: number,
  deadIndices: ReadonlySet<number> | undefined,
  liveRotationRad: number | null,
  rotationStartFrame: OrientedSelectionFrame | null,
  scaleLiveBounds: NormRect | null,
): OrientedSelectionFrame | null {
  if (selectedIds.length === 0) return null
  const union =
    scaleLiveBounds ??
    unionSelectionBounds(commands, selectedIds, widthPx, heightPx, deadIndices)
  if (!union) return null
  return resolveSelectionHandleFrame(
    commands,
    selectedIds,
    widthPx,
    heightPx,
    union,
    liveRotationRad,
    rotationStartFrame,
  )
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

function orientedFrameCenter(frame: OrientedSelectionFrame): [number, number] {
  return [frame.rect.x + frame.rect.w / 2, frame.rect.y + frame.rect.h / 2]
}

/** Page-space pointer → unrotated local coords inside `frame.rect`. */
export function pointerToOrientedFrameLocal(
  pointer: [number, number],
  frame: OrientedSelectionFrame,
  widthPx: number,
  heightPx: number,
): [number, number] {
  const pivot = orientedFrameCenter(frame)
  const rad = degToRad(frame.rotationDeg)
  if (Math.abs(rad) < 1e-6) return pointer
  return rotateNormPointInPixelSpace(pointer, pivot, -rad, widthPx, heightPx)
}

/** Resize an oriented frame by dragging a handle (pointer in page norm space). */
export function resizeOrientedFrameFromHandle(
  start: OrientedSelectionFrame,
  handle: ScaleHandleId,
  pointer: [number, number],
  widthPx: number,
  heightPx: number,
  opts?: ResizeBoundsOptions,
): OrientedSelectionFrame {
  const uniform = opts?.uniform ?? false
  const rad = degToRad(start.rotationDeg)
  if (Math.abs(rad) > 1e-6 && uniform) {
    return resizeOrientedFrameUniformFromPageAnchor(
      start,
      handle,
      pointer,
      widthPx,
      heightPx,
      opts,
    )
  }
  const localPointer = pointerToOrientedFrameLocal(pointer, start, widthPx, heightPx)
  const nextRect = resizeBoundsFromHandle(start.rect, handle, localPointer, opts)
  return { rect: nextRect, rotationDeg: start.rotationDeg }
}

/** Map a page-space point through oriented start → next frame (same rotation). */
export function mapPointInOrientedFrame(
  p: [number, number],
  start: OrientedSelectionFrame,
  next: OrientedSelectionFrame,
  widthPx: number,
  heightPx: number,
): [number, number] {
  const rad = degToRad(start.rotationDeg)
  if (Math.abs(rad) > 1e-6) {
    const { sx, sy } = axisScales(start.rect, next.rect)
    if (Math.abs(sx - sy) <= UNIFORM_SCALE_EPS) {
      const anchor = inferUniformScaleAnchorPage(start, next, widthPx, heightPx)
      return [
        clamp01(anchor[0] + (p[0] - anchor[0]) * sx),
        clamp01(anchor[1] + (p[1] - anchor[1]) * sx),
      ]
    }
  }

  const startPivot = orientedFrameCenter(start)
  const nextPivot = orientedFrameCenter(next)
  let [lx, ly] =
    Math.abs(rad) < 1e-6
      ? p
      : rotateNormPointInPixelSpace(p, startPivot, -rad, widthPx, heightPx)
  const relX = start.rect.w > 1e-9 ? (lx - start.rect.x) / start.rect.w : 0
  const relY = start.rect.h > 1e-9 ? (ly - start.rect.y) / start.rect.h : 0
  lx = next.rect.x + relX * next.rect.w
  ly = next.rect.y + relY * next.rect.h
  if (Math.abs(rad) < 1e-6) {
    return [clamp01(lx), clamp01(ly)]
  }
  const [px, py] = rotateNormPointInPixelSpace([lx, ly], nextPivot, rad, widthPx, heightPx)
  return [clamp01(px), clamp01(py)]
}

function localBoundsFromRotatedPageCorners(
  pageCorners: [number, number][],
  rotationDeg: number,
  widthPx: number,
  heightPx: number,
): NormRect {
  if (pageCorners.length === 0) {
    return { x: 0, y: 0, w: MIN_BOUNDS_NORM, h: MIN_BOUNDS_NORM }
  }
  const cx = pageCorners.reduce((s, p) => s + p[0], 0) / pageCorners.length
  const cy = pageCorners.reduce((s, p) => s + p[1], 0) / pageCorners.length
  const pivot: [number, number] = [cx, cy]
  const rad = degToRad(rotationDeg)
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const corner of pageCorners) {
    const [lx, ly] =
      Math.abs(rad) < 1e-6
        ? corner
        : rotateNormPointInPixelSpace(corner, pivot, -rad, widthPx, heightPx)
    minX = Math.min(minX, lx)
    maxX = Math.max(maxX, lx)
    minY = Math.min(minY, ly)
    maxY = Math.max(maxY, ly)
  }
  return {
    x: clamp01(minX),
    y: clamp01(minY),
    w: Math.max(MIN_BOUNDS_NORM, maxX - minX),
    h: Math.max(MIN_BOUNDS_NORM, maxY - minY),
  }
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

export function thicknessScaleFromOrientedFrames(
  start: OrientedSelectionFrame,
  next: OrientedSelectionFrame,
): number {
  return thicknessScaleFromBounds(start.rect, next.rect)
}

/** Scale one command relative to selection start bounds → new bounds. */
export function scaleAnnotationCommand(
  cmd: AnnotationCommand,
  startBounds: NormRect,
  newBounds: NormRect,
): AnnotationCommand {
  const thicknessScale = thicknessScaleFromBounds(startBounds, newBounds)

  switch (cmd.kind) {
    case 'stroke': {
      const p0 = cmd.rotationBounds
        ? mapPointInBounds([cmd.rotationBounds.x, cmd.rotationBounds.y], startBounds, newBounds)
        : null
      const p1 = cmd.rotationBounds
        ? mapPointInBounds(
            [cmd.rotationBounds.x + cmd.rotationBounds.w, cmd.rotationBounds.y + cmd.rotationBounds.h],
            startBounds,
            newBounds,
          )
        : null
      return {
        ...cmd,
        points: cmd.points.map((p) => mapPointInBounds(p, startBounds, newBounds)),
        widthScale: (cmd.widthScale ?? 1) * thicknessScale,
        ...(p0 && p1
          ? {
              rotationBounds: {
                x: Math.min(p0[0], p1[0]),
                y: Math.min(p0[1], p1[1]),
                w: Math.max(MIN_BOUNDS_NORM, Math.abs(p1[0] - p0[0])),
                h: Math.max(MIN_BOUNDS_NORM, Math.abs(p1[1] - p0[1])),
              },
            }
          : {}),
      }
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
      const nextFont = Math.max(TEXT_FONT_SIZE_NORM_MIN, cmd.fontSizeNorm * thicknessScale)
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
        fontSizeNorm: Math.max(TEXT_FONT_SIZE_NORM_MIN, cmd.fontSizeNorm * thicknessScale),
      }
    }
    case 'image': {
      const p0 = mapPointInBounds([cmd.x, cmd.y], startBounds, newBounds)
      const p1 = mapPointInBounds([cmd.x + cmd.w, cmd.y + cmd.h], startBounds, newBounds)
      return {
        ...cmd,
        x: Math.min(p0[0], p1[0]),
        y: Math.min(p0[1], p1[1]),
        w: Math.max(MIN_BOUNDS_NORM, Math.abs(p1[0] - p0[0])),
        h: Math.max(MIN_BOUNDS_NORM, Math.abs(p1[1] - p0[1])),
        rotationDeg: cmd.rotationDeg,
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

/** Scale one command through oriented selection frames (supports rotated boxes). */
export function scaleAnnotationCommandFromOrientedFrames(
  cmd: AnnotationCommand,
  start: OrientedSelectionFrame,
  next: OrientedSelectionFrame,
  widthPx: number,
  heightPx: number,
): AnnotationCommand {
  const thicknessScale = thicknessScaleFromOrientedFrames(start, next)
  const mapPt = (p: [number, number]) =>
    mapPointInOrientedFrame(p, start, next, widthPx, heightPx)

  switch (cmd.kind) {
    case 'stroke': {
      const rotationDeg = cmd.rotationDeg ?? 0
      if (cmd.rotationBounds && Math.abs(rotationDeg) > 1e-6) {
        const center: [number, number] = [
          cmd.rotationBounds.x + cmd.rotationBounds.w / 2,
          cmd.rotationBounds.y + cmd.rotationBounds.h / 2,
        ]
        const newCenter: [number, number] = [
          next.rect.x + next.rect.w / 2,
          next.rect.y + next.rect.h / 2,
        ]
        const rad = degToRad(rotationDeg)
        const toWorld = (p: [number, number]) =>
          rotateNormPointInPixelSpace(p, center, rad, widthPx, heightPx)
        const toLocal = (p: [number, number]) =>
          rotateNormPointInPixelSpace(p, newCenter, -rad, widthPx, heightPx)
        return {
          ...cmd,
          points: cmd.points.map((p) => {
            const world = toWorld(p)
            const mapped = mapPointInOrientedFrame(world, start, next, widthPx, heightPx)
            return toLocal(mapped)
          }),
          rotationBounds: { ...next.rect },
          rotationDeg,
          widthScale: (cmd.widthScale ?? 1) * thicknessScale,
        }
      }
      const p0 = cmd.rotationBounds
        ? mapPt([cmd.rotationBounds.x, cmd.rotationBounds.y])
        : null
      const p1 = cmd.rotationBounds
        ? mapPt([
            cmd.rotationBounds.x + cmd.rotationBounds.w,
            cmd.rotationBounds.y + cmd.rotationBounds.h,
          ])
        : null
      return {
        ...cmd,
        points: cmd.points.map((p) => mapPt(p)),
        widthScale: (cmd.widthScale ?? 1) * thicknessScale,
        ...(p0 && p1
          ? {
              rotationBounds: {
                x: Math.min(p0[0], p1[0]),
                y: Math.min(p0[1], p1[1]),
                w: Math.max(MIN_BOUNDS_NORM, Math.abs(p1[0] - p0[0])),
                h: Math.max(MIN_BOUNDS_NORM, Math.abs(p1[1] - p0[1])),
              },
            }
          : {}),
      }
    }
    case 'line':
      return {
        ...cmd,
        a: mapPt(cmd.a),
        b: mapPt(cmd.b),
        widthScale: (cmd.widthScale ?? 1) * thicknessScale,
      }
    case 'arrow':
      return {
        ...cmd,
        from: mapPt(cmd.from),
        to: mapPt(cmd.to),
        widthScale: (cmd.widthScale ?? 1) * thicknessScale,
        headLengthNorm: (cmd.headLengthNorm ?? 0.035) * thicknessScale,
      }
    case 'rect':
    case 'ellipse':
    case 'triangle':
    case 'image': {
      const rotationDeg = cmd.rotationDeg ?? 0
      const mappedCorners = boxShapeCornersNorm({
        x: cmd.x,
        y: cmd.y,
        w: cmd.w,
        h: cmd.h,
        rotationDeg,
      }).map((corner) => mapPt(corner))
      const bounds = localBoundsFromRotatedPageCorners(
        mappedCorners,
        rotationDeg,
        widthPx,
        heightPx,
      )
      const scaled = {
        ...cmd,
        x: bounds.x,
        y: bounds.y,
        w: bounds.w,
        h: bounds.h,
      }
      if (cmd.kind === 'image') return scaled
      return {
        ...scaled,
        strokeWidthScale: (cmd.strokeWidthScale ?? 1) * thicknessScale,
      }
    }
    case 'stamp':
    case 'callout': {
      const center = mapPt(cmd.center)
      const nextScale = (cmd.scale ?? 1) * thicknessScale
      return { ...cmd, center, scale: nextScale }
    }
    case 'text': {
      const pos = mapPt([cmd.x, cmd.y])
      const nextFont = Math.max(TEXT_FONT_SIZE_NORM_MIN, cmd.fontSizeNorm * thicknessScale)
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
      const p0 = mapPt([cmd.x, cmd.y])
      const p1 = mapPt([cmd.x + cmd.w, cmd.y + cmd.h])
      return {
        ...cmd,
        x: Math.min(p0[0], p1[0]),
        y: Math.min(p0[1], p1[1]),
        w: Math.max(MIN_BOUNDS_NORM, Math.abs(p1[0] - p0[0])),
        h: Math.max(MIN_BOUNDS_NORM, Math.abs(p1[1] - p0[1])),
        fontSizeNorm: Math.max(TEXT_FONT_SIZE_NORM_MIN, cmd.fontSizeNorm * thicknessScale),
      }
    }
    default:
      return cmd
  }
}

export function scaleAnnotationCommandsFromOrientedFrames(
  commands: AnnotationCommand[],
  ids: ReadonlySet<string>,
  start: OrientedSelectionFrame,
  next: OrientedSelectionFrame,
  widthPx: number,
  heightPx: number,
): AnnotationCommand[] {
  if (start.rect.w <= 0 || start.rect.h <= 0 || next.rect.w <= 0 || next.rect.h <= 0) {
    return commands
  }
  return commands.map((c) =>
    ids.has(c.id)
      ? scaleAnnotationCommandFromOrientedFrames(c, start, next, widthPx, heightPx)
      : c,
  )
}

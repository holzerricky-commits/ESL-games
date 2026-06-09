import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import {
  snapshotRotationBaseCommands,
  snapshotStrokeRotationBounds,
  type NormRect,
  type OrientedSelectionFrame,
} from '@/lib/books/annotation-select'
import { SELECTION_HANDLE_HIT_RADIUS_PX } from '@/lib/books/annotation-selection-chrome'

export const ROTATABLE_SHAPE_KINDS = new Set([
  'line',
  'arrow',
  'rect',
  'ellipse',
  'triangle',
] as const)

export type RotatableShapeKind = typeof ROTATABLE_SHAPE_KINDS extends Set<infer K> ? K : never

export const SELECTION_ROTATION_HANDLE_OFFSET_PX = 28

export const ROTATION_HANDLE_HIT_RADIUS_PX = SELECTION_HANDLE_HIT_RADIUS_PX

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI
}

export function normalizeDeg(deg: number): number {
  let d = deg % 360
  if (d < 0) d += 360
  return d
}

function isRotatablePenMarkerStroke(cmd: AnnotationCommand): boolean {
  return (
    cmd.kind === 'stroke' && (cmd.tool === 'pen' || cmd.tool === 'marker') && cmd.points.length > 0
  )
}

/** Vector shapes plus freehand pen / highlighter strokes. */
export function isRotatableShapeCommand(cmd: AnnotationCommand): boolean {
  if (ROTATABLE_SHAPE_KINDS.has(cmd.kind as RotatableShapeKind)) return true
  return isRotatablePenMarkerStroke(cmd)
}

export function rotatableIdsInSelection(
  commands: readonly AnnotationCommand[],
  selectedIds: readonly string[],
): string[] {
  const byId = new Map(commands.map((c) => [c.id, c]))
  return selectedIds.filter((id) => {
    const cmd = byId.get(id)
    return cmd != null && isRotatableShapeCommand(cmd)
  })
}

export function selectionHasRotatableShapes(
  commands: readonly AnnotationCommand[],
  selectedIds: readonly string[],
): boolean {
  return rotatableIdsInSelection(commands, selectedIds).length > 0
}

export function rotatePointAroundPivot(
  point: [number, number],
  pivot: [number, number],
  deltaRad: number,
): [number, number] {
  if (Math.abs(deltaRad) < 1e-9) return point
  const dx = point[0] - pivot[0]
  const dy = point[1] - pivot[1]
  const cos = Math.cos(deltaRad)
  const sin = Math.sin(deltaRad)
  return [pivot[0] + dx * cos - dy * sin, pivot[1] + dx * sin + dy * cos]
}

function boxShapeCenter(cmd: { x: number; y: number; w: number; h: number }): [number, number] {
  return [cmd.x + cmd.w / 2, cmd.y + cmd.h / 2]
}

export function boxShapeCornersNorm(cmd: {
  x: number
  y: number
  w: number
  h: number
  rotationDeg?: number
}): [number, number][] {
  const corners: [number, number][] = [
    [cmd.x, cmd.y],
    [cmd.x + cmd.w, cmd.y],
    [cmd.x + cmd.w, cmd.y + cmd.h],
    [cmd.x, cmd.y + cmd.h],
  ]
  const rad = degToRad(cmd.rotationDeg ?? 0)
  if (Math.abs(rad) < 1e-6) return corners
  const pivot = boxShapeCenter(cmd)
  return corners.map((c) => rotatePointAroundPivot(c, pivot, rad))
}

function aabbFromPoints(pts: [number, number][]): NormRect | null {
  if (pts.length === 0) return null
  let minX = pts[0]![0]
  let maxX = minX
  let minY = pts[0]![1]
  let maxY = minY
  for (const [x, y] of pts) {
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }
  return {
    x: clamp01(minX),
    y: clamp01(minY),
    w: clamp01(maxX - minX),
    h: clamp01(maxY - minY),
  }
}

export function boxShapeRotatedBounds(cmd: {
  x: number
  y: number
  w: number
  h: number
  rotationDeg?: number
}): NormRect {
  const corners = boxShapeCornersNorm(cmd)
  return aabbFromPoints(corners) ?? { x: cmd.x, y: cmd.y, w: cmd.w, h: cmd.h }
}

export function shapeRotationDeg(cmd: AnnotationCommand): number {
  if (cmd.kind === 'rect' || cmd.kind === 'ellipse' || cmd.kind === 'triangle') {
    return cmd.rotationDeg ?? 0
  }
  if (cmd.kind === 'stroke' && isRotatablePenMarkerStroke(cmd)) {
    return cmd.rotationDeg ?? 0
  }
  return 0
}

export function rotateAnnotationCommand(
  cmd: AnnotationCommand,
  pivot: [number, number],
  deltaRad: number,
): AnnotationCommand {
  if (Math.abs(deltaRad) < 1e-9) return cmd
  switch (cmd.kind) {
    case 'line':
      return {
        ...cmd,
        a: rotatePointAroundPivot(cmd.a, pivot, deltaRad),
        b: rotatePointAroundPivot(cmd.b, pivot, deltaRad),
      }
    case 'arrow':
      return {
        ...cmd,
        from: rotatePointAroundPivot(cmd.from, pivot, deltaRad),
        to: rotatePointAroundPivot(cmd.to, pivot, deltaRad),
      }
    case 'rect':
    case 'ellipse':
    case 'triangle':
      return { ...cmd, rotationDeg: normalizeDeg(shapeRotationDeg(cmd) + radToDeg(deltaRad)) }
    case 'stroke':
      if (!isRotatablePenMarkerStroke(cmd)) return cmd
      if (!cmd.rotationBounds) return cmd
      return {
        ...cmd,
        rotationDeg: normalizeDeg((cmd.rotationDeg ?? 0) + radToDeg(deltaRad)),
      }
    default:
      return cmd
  }
}

export type RotateAnnotationLayout = { widthPx: number; heightPx: number }

export function rotateAnnotationCommands(
  commands: AnnotationCommand[],
  ids: ReadonlySet<string>,
  pivot: [number, number],
  deltaRad: number,
  layout?: RotateAnnotationLayout,
): AnnotationCommand[] {
  if (Math.abs(deltaRad) < 1e-9) return commands
  return commands.map((c) => {
    if (!ids.has(c.id)) return c
    let cmd = c
    if (
      layout &&
      cmd.kind === 'stroke' &&
      isRotatablePenMarkerStroke(cmd) &&
      !cmd.rotationBounds
    ) {
      cmd = snapshotStrokeRotationBounds(cmd, layout.widthPx, layout.heightPx)
    }
    return rotateAnnotationCommand(cmd, pivot, deltaRad)
  })
}

/** Commit live rotate preview onto the full command stack (pointer-up). */
export function commitRotatedAnnotationCommands(
  commands: AnnotationCommand[],
  ids: ReadonlySet<string>,
  pivot: [number, number],
  deltaRad: number,
  layout: RotateAnnotationLayout,
  previewBase?: readonly AnnotationCommand[] | null,
): AnnotationCommand[] {
  if (Math.abs(deltaRad) < 1e-9 || ids.size === 0) return commands
  const base = previewBase ?? commands
  const prepared = snapshotRotationBaseCommands(base, [...ids], layout.widthPx, layout.heightPx)
  const rotated = rotateAnnotationCommands(prepared, ids, pivot, deltaRad, layout)
  const byId = new Map<string, AnnotationCommand>()
  for (const cmd of rotated) {
    if (ids.has(cmd.id)) byId.set(cmd.id, cmd)
  }
  return commands.map((c) => byId.get(c.id) ?? c)
}

export function orientedFrameCenter(frame: OrientedSelectionFrame): [number, number] {
  return [frame.rect.x + frame.rect.w / 2, frame.rect.y + frame.rect.h / 2]
}

export function orientedFrameTopCenterNorm(frame: OrientedSelectionFrame): [number, number] {
  const center = orientedFrameCenter(frame)
  const top: [number, number] = [center[0], frame.rect.y]
  const rad = degToRad(frame.rotationDeg)
  if (Math.abs(rad) < 1e-6) return top
  return rotatePointAroundPivot(top, center, rad)
}

export function rotationHandleNormPositionForFrame(
  frame: OrientedSelectionFrame,
  heightPx: number,
  offsetPx = SELECTION_ROTATION_HANDLE_OFFSET_PX,
): [number, number] {
  const [topX, topY] = orientedFrameTopCenterNorm(frame)
  const offsetNorm = heightPx > 0 ? offsetPx / heightPx : 0.04
  const rad = degToRad(frame.rotationDeg)
  const outwardDx = -Math.sin(rad) * offsetNorm
  const outwardDy = -Math.cos(rad) * offsetNorm
  return [topX + outwardDx, Math.max(0, topY + outwardDy)]
}

/** @deprecated Prefer rotationHandleNormPositionForFrame. */
export function rotationHandleNormPosition(
  bounds: NormRect,
  heightPx: number,
  offsetPx = SELECTION_ROTATION_HANDLE_OFFSET_PX,
): [number, number] {
  return rotationHandleNormPositionForFrame({ rect: bounds, rotationDeg: 0 }, heightPx, offsetPx)
}

export function hitTestRotationHandleForFrame(
  point: [number, number],
  frame: OrientedSelectionFrame,
  widthPx: number,
  heightPx: number,
  hitRadiusPx = ROTATION_HANDLE_HIT_RADIUS_PX,
): boolean {
  const [hx, hy] = rotationHandleNormPositionForFrame(frame, heightPx)
  const px = hx * widthPx
  const py = hy * heightPx
  const qx = point[0] * widthPx
  const qy = point[1] * heightPx
  const dx = qx - px
  const dy = qy - py
  return dx * dx + dy * dy <= hitRadiusPx * hitRadiusPx
}

export function hitTestRotationHandle(
  point: [number, number],
  bounds: NormRect,
  widthPx: number,
  heightPx: number,
  hitRadiusPx = ROTATION_HANDLE_HIT_RADIUS_PX,
): boolean {
  return hitTestRotationHandleForFrame(
    point,
    { rect: bounds, rotationDeg: 0 },
    widthPx,
    heightPx,
    hitRadiusPx,
  )
}

export type { OrientedSelectionFrame }

function pointInTriangle(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
): boolean {
  const v0x = cx - ax
  const v0y = cy - ay
  const v1x = bx - ax
  const v1y = by - ay
  const v2x = px - ax
  const v2y = py - ay
  const dot00 = v0x * v0x + v0y * v0y
  const dot01 = v0x * v1x + v0y * v1y
  const dot02 = v0x * v2x + v0y * v2y
  const dot11 = v1x * v1x + v1y * v1y
  const dot12 = v1x * v2x + v1y * v2y
  const invDenom = 1 / (dot00 * dot11 - dot01 * dot01)
  const u = (dot11 * dot02 - dot01 * dot12) * invDenom
  const v = (dot00 * dot12 - dot01 * dot02) * invDenom
  return u >= 0 && v >= 0 && u + v <= 1
}

/** Hit-test box shapes with optional rotation (norm space). */
export function hitTestBoxShapeAtPoint(
  cmd: { x: number; y: number; w: number; h: number; rotationDeg?: number },
  kind: 'rect' | 'ellipse' | 'triangle',
  nx: number,
  ny: number,
): boolean {
  const cx = cmd.x + cmd.w / 2
  const cy = cmd.y + cmd.h / 2
  const rad = degToRad(cmd.rotationDeg ?? 0)
  const [lx, ly] =
    Math.abs(rad) < 1e-6 ? [nx, ny] : rotatePointAroundPivot([nx, ny], [cx, cy], -rad)

  if (kind === 'rect') {
    return lx >= cmd.x && lx <= cmd.x + cmd.w && ly >= cmd.y && ly <= cmd.y + cmd.h
  }
  if (kind === 'ellipse') {
    const rx = cmd.w / 2
    const ry = cmd.h / 2
    if (rx <= 0 || ry <= 0) return false
    const dx = (lx - cx) / rx
    const dy = (ly - cy) / ry
    return dx * dx + dy * dy <= 1
  }
  const topX = cmd.x + cmd.w / 2
  const topY = cmd.y
  const blX = cmd.x
  const blY = cmd.y + cmd.h
  const brX = cmd.x + cmd.w
  const brY = cmd.y + cmd.h
  return pointInTriangle(lx, ly, topX, topY, blX, blY, brX, brY)
}

export function selectionPivotFromBounds(bounds: NormRect): [number, number] {
  return [bounds.x + bounds.w / 2, bounds.y + bounds.h / 2]
}

export function angleFromPivotToPoint(pivot: [number, number], point: [number, number]): number {
  return Math.atan2(point[1] - pivot[1], point[0] - pivot[0])
}

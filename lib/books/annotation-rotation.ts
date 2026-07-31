import type {
  AnnotationCommand,
  StrokeAnnotationCommand,
} from '@/lib/books/annotation-command-types'
import {
  snapshotRotationBaseCommands,
  snapshotStrokeRotationBounds,
  strokeUnrotatedBounds,
  type NormRect,
  type OrientedSelectionFrame,
} from '@/lib/books/annotation-select'
import {
  SELECTION_HANDLE_HIT_RADIUS_PX,
  SELECTION_ROTATION_HANDLE_SIZE_PX,
} from '@/lib/books/annotation-selection-chrome'

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

function isRotatablePenMarkerStroke(cmd: AnnotationCommand): cmd is StrokeAnnotationCommand {
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

/** Rotate normalized coords around a normalized pivot using pixel-space geometry (matches CSS/canvas). */
export function rotateNormPointInPixelSpace(
  point: [number, number],
  pivot: [number, number],
  deltaRad: number,
  widthPx: number,
  heightPx: number,
): [number, number] {
  if (Math.abs(deltaRad) < 1e-9 || widthPx <= 0 || heightPx <= 0) return point
  const px = point[0] * widthPx
  const py = point[1] * heightPx
  const cx = pivot[0] * widthPx
  const cy = pivot[1] * heightPx
  const dx = px - cx
  const dy = py - cy
  const cos = Math.cos(deltaRad)
  const sin = Math.sin(deltaRad)
  return [(cx + dx * cos - dy * sin) / widthPx, (cy + dx * sin + dy * cos) / heightPx]
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

export type RotateAnnotationLayout = { widthPx: number; heightPx: number }

const STROKE_POINT_MATCH_EPS = 1e-5

function strokePointsMatch(a: StrokeAnnotationCommand, b: StrokeAnnotationCommand): boolean {
  if (a.points.length !== b.points.length) return false
  for (let i = 0; i < a.points.length; i++) {
    const ap = a.points[i]!
    const bp = b.points[i]!
    if (Math.abs(ap[0] - bp[0]) > STROKE_POINT_MATCH_EPS) return false
    if (Math.abs(ap[1] - bp[1]) > STROKE_POINT_MATCH_EPS) return false
  }
  return true
}

/** Rotate in pixel space when layout is known (matches canvas draw geometry). */
function rotateNormPointForGesture(
  point: [number, number],
  pivot: [number, number],
  deltaRad: number,
  layout?: RotateAnnotationLayout,
): [number, number] {
  if (layout) {
    return rotateNormPointInPixelSpace(point, pivot, deltaRad, layout.widthPx, layout.heightPx)
  }
  return rotatePointAroundPivot(point, pivot, deltaRad)
}

/** Single stroke: local bounds + `rotationDeg`. Group: shared bounds + shared `rotationDeg`. */
function rotatePenMarkerStrokeAroundPivot(
  cmd: StrokeAnnotationCommand,
  deltaRad: number,
  layout: RotateAnnotationLayout,
  rotateAsRigidGroup: boolean,
  groupRotationFrame: OrientedSelectionFrame | null | undefined,
): StrokeAnnotationCommand {
  const bounds =
    cmd.rotationBounds ?? strokeUnrotatedBounds(cmd, layout.widthPx, layout.heightPx)
  if (!bounds) return cmd

  const existingDeg = cmd.rotationDeg ?? 0

  if (!rotateAsRigidGroup) {
    return {
      ...cmd,
      rotationBounds: bounds,
      rotationDeg: normalizeDeg(existingDeg + radToDeg(deltaRad)),
    }
  }

  const groupBounds = groupRotationFrame?.rect
  if (!groupBounds) return cmd

  const groupStartDeg = groupRotationFrame?.rotationDeg ?? 0
  return {
    ...cmd,
    rotationBounds: groupBounds,
    rotationDeg: normalizeDeg(groupStartDeg + radToDeg(deltaRad)),
  }
}

export function rotateAnnotationCommand(
  cmd: AnnotationCommand,
  pivot: [number, number],
  deltaRad: number,
  layout?: RotateAnnotationLayout,
  rotateAsRigidGroup = false,
  groupRotationFrame?: OrientedSelectionFrame | null,
): AnnotationCommand {
  if (Math.abs(deltaRad) < 1e-9) return cmd
  switch (cmd.kind) {
    case 'line':
      return {
        ...cmd,
        a: rotateNormPointForGesture(cmd.a, pivot, deltaRad, layout),
        b: rotateNormPointForGesture(cmd.b, pivot, deltaRad, layout),
      }
    case 'arrow':
      return {
        ...cmd,
        from: rotateNormPointForGesture(cmd.from, pivot, deltaRad, layout),
        to: rotateNormPointForGesture(cmd.to, pivot, deltaRad, layout),
      }
    case 'rect':
    case 'ellipse':
    case 'triangle': {
      const nextDeg = normalizeDeg(shapeRotationDeg(cmd) + radToDeg(deltaRad))
      if (rotateAsRigidGroup && layout) {
        const cx = cmd.x + cmd.w / 2
        const cy = cmd.y + cmd.h / 2
        const newCenter = rotateNormPointForGesture([cx, cy], pivot, deltaRad, layout)
        return {
          ...cmd,
          x: newCenter[0] - cmd.w / 2,
          y: newCenter[1] - cmd.h / 2,
          rotationDeg: nextDeg,
        }
      }
      return { ...cmd, rotationDeg: nextDeg }
    }
    case 'stroke':
      if (!isRotatablePenMarkerStroke(cmd)) return cmd
      if (!layout) {
        if (!cmd.rotationBounds) return cmd
        return {
          ...cmd,
          rotationDeg: normalizeDeg((cmd.rotationDeg ?? 0) + radToDeg(deltaRad)),
        }
      }
      return rotatePenMarkerStrokeAroundPivot(
        cmd,
        deltaRad,
        layout,
        rotateAsRigidGroup,
        groupRotationFrame,
      )
    default:
      return cmd
  }
}

export function rotateAnnotationCommands(
  commands: readonly AnnotationCommand[],
  ids: ReadonlySet<string>,
  pivot: [number, number],
  deltaRad: number,
  layout?: RotateAnnotationLayout,
  groupRotationFrame?: OrientedSelectionFrame | null,
): AnnotationCommand[] {
  if (Math.abs(deltaRad) < 1e-9) return [...commands]
  const rotateAsRigidGroup = ids.size > 1
  return commands.map((c) => {
    if (!ids.has(c.id)) return c
    let cmd = c
    if (
      layout &&
      !rotateAsRigidGroup &&
      cmd.kind === 'stroke' &&
      isRotatablePenMarkerStroke(cmd) &&
      !cmd.rotationBounds
    ) {
      cmd = snapshotStrokeRotationBounds(cmd, layout.widthPx, layout.heightPx)
    }
    return rotateAnnotationCommand(
      cmd,
      pivot,
      deltaRad,
      layout,
      rotateAsRigidGroup,
      groupRotationFrame,
    )
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
  groupRotationFrame?: OrientedSelectionFrame | null,
): AnnotationCommand[] {
  if (Math.abs(deltaRad) < 1e-9 || ids.size === 0) return commands
  const base = previewBase ?? commands
  const prepared =
    ids.size > 1
      ? [...base]
      : snapshotRotationBaseCommands(base, [...ids], layout.widthPx, layout.heightPx)
  const rotated = rotateAnnotationCommands(
    prepared,
    ids,
    pivot,
    deltaRad,
    layout,
    groupRotationFrame,
  )
  const byId = new Map<string, AnnotationCommand>()
  for (const cmd of rotated) {
    if (ids.has(cmd.id)) byId.set(cmd.id, cmd)
  }
  return commands.map((c) => byId.get(c.id) ?? c)
}

/** Rotated command snapshots only — not the full stack (avoids freezing move/scale after commit). */
export function rotatedCommandsFromCommitOverlay(
  committed: readonly AnnotationCommand[],
  rotatedIds: readonly string[],
): AnnotationCommand[] {
  const idSet = new Set(rotatedIds)
  return committed.filter((c) => idSet.has(c.id) && isRotatableShapeCommand(c))
}

/** Keep committed rotate fields visible until upstream `commands` catch up after pointer-up. */
export function mergeRotatedCommandOverlay(
  commands: readonly AnnotationCommand[],
  overlay: readonly AnnotationCommand[] | null,
): AnnotationCommand[] {
  if (!overlay || overlay.length === 0) return [...commands]
  const byId = new Map(
    overlay.filter((c) => isRotatableShapeCommand(c)).map((c) => [c.id, c]),
  )
  if (byId.size === 0) return [...commands]
  return commands.map((c) => {
    const o = byId.get(c.id)
    if (!o) return c
    if (isRotatablePenMarkerStroke(o) && isRotatablePenMarkerStroke(c)) {
      const overlayDeg = o.rotationDeg ?? 0
      const liveDeg = c.rotationDeg ?? 0
      if (Math.abs(overlayDeg) < 1e-6 && Math.abs(liveDeg) < 1e-6) {
        if (strokePointsMatch(o, c)) return c
        return {
          ...c,
          points: o.points,
          rotationBounds: o.rotationBounds ?? c.rotationBounds,
        }
      }
      if (Math.abs(overlayDeg) < 1e-6) return c
      if (Math.abs(liveDeg - overlayDeg) < 1e-6 && c.rotationBounds) return c
      return {
        ...c,
        rotationDeg: overlayDeg,
        rotationBounds: c.rotationBounds ?? o.rotationBounds,
      }
    }
    if (
      (o.kind === 'rect' || o.kind === 'ellipse' || o.kind === 'triangle') &&
      (c.kind === 'rect' || c.kind === 'ellipse' || c.kind === 'triangle')
    ) {
      const overlayDeg = o.rotationDeg ?? 0
      const liveDeg = c.rotationDeg ?? 0
      if (Math.abs(overlayDeg) < 1e-6) return c
      if (Math.abs(liveDeg - overlayDeg) < 1e-6) return c
      return { ...c, rotationDeg: overlayDeg }
    }
    return c
  })
}

export function isRotateCommitOverlaySynced(
  overlay: readonly AnnotationCommand[],
  commands: readonly AnnotationCommand[],
): boolean {
  if (overlay.length === 0) return true
  const liveById = new Map(commands.map((c) => [c.id, c]))
  for (const o of overlay) {
    if (!isRotatableShapeCommand(o)) continue
    const live = liveById.get(o.id)
    if (!live) return false
    if (isRotatablePenMarkerStroke(o) && isRotatablePenMarkerStroke(live)) {
      if ((o.rotationDeg ?? 0) !== (live.rotationDeg ?? 0)) return false
      if (!strokePointsMatch(o, live)) return false
      if (!live.rotationBounds) return false
      continue
    }
    if (shapeRotationDeg(o) !== shapeRotationDeg(live)) return false
  }
  return true
}

export function orientedFrameCenter(frame: OrientedSelectionFrame): [number, number] {
  return [frame.rect.x + frame.rect.w / 2, frame.rect.y + frame.rect.h / 2]
}

export function orientedFrameTopCenterNorm(
  frame: OrientedSelectionFrame,
  widthPx: number,
  heightPx: number,
): [number, number] {
  const center = orientedFrameCenter(frame)
  const top: [number, number] = [center[0], frame.rect.y]
  const rad = degToRad(frame.rotationDeg)
  if (Math.abs(rad) < 1e-6) return top
  return rotateNormPointInPixelSpace(top, center, rad, widthPx, heightPx)
}

export function rotationHandleNormPositionForFrame(
  frame: OrientedSelectionFrame,
  widthPx: number,
  heightPx: number,
  offsetPx = SELECTION_ROTATION_HANDLE_OFFSET_PX,
): [number, number] {
  if (widthPx <= 0 || heightPx <= 0) return orientedFrameCenter(frame)
  const half = SELECTION_ROTATION_HANDLE_SIZE_PX / 2
  const cx = (frame.rect.x + frame.rect.w / 2) * widthPx
  const cy = (frame.rect.y + frame.rect.h / 2) * heightPx
  const hPx = frame.rect.h * heightPx
  const d = hPx / 2 + offsetPx + half
  const rad = degToRad(frame.rotationDeg)
  // Match OrientedFrameShell + rotation handle in selection-bounds-chrome:
  // local offset (0, -(h/2 + stem + handle/2)) rotated around frame center.
  const hx = cx + d * Math.sin(rad)
  const hy = cy - d * Math.cos(rad)
  return [hx / widthPx, hy / heightPx]
}

/** @deprecated Prefer rotationHandleNormPositionForFrame. */
export function rotationHandleNormPosition(
  bounds: NormRect,
  heightPx: number,
  offsetPx = SELECTION_ROTATION_HANDLE_OFFSET_PX,
): [number, number] {
  return rotationHandleNormPositionForFrame(
    { rect: bounds, rotationDeg: 0 },
    heightPx,
    heightPx,
    offsetPx,
  )
}

export function hitTestRotationHandleForFrame(
  point: [number, number],
  frame: OrientedSelectionFrame,
  widthPx: number,
  heightPx: number,
  hitRadiusPx = ROTATION_HANDLE_HIT_RADIUS_PX,
): boolean {
  const [hx, hy] = rotationHandleNormPositionForFrame(frame, widthPx, heightPx)
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

/** Snapshot commands + oriented start frame when a rotate gesture begins. */
export function prepareRotationGestureState(
  commands: readonly AnnotationCommand[],
  rotIds: readonly string[],
  handleFrame: OrientedSelectionFrame,
  layout: RotateAnnotationLayout,
): {
  pivot: [number, number]
  startFrame: OrientedSelectionFrame
  baseCommands: AnnotationCommand[]
} {
  const isGroup = rotIds.length > 1
  return {
    pivot: orientedFrameCenter(handleFrame),
    startFrame: {
      rect: { ...handleFrame.rect },
      rotationDeg: handleFrame.rotationDeg,
    },
    baseCommands: isGroup
      ? [...commands]
      : snapshotRotationBaseCommands(commands, rotIds, layout.widthPx, layout.heightPx),
  }
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

/** Oriented group selection chrome after rigid multi-stroke rotate commit. */
export function committedRotationFrameFromGesture(
  startFrame: OrientedSelectionFrame | null,
  deltaRad: number,
  rotatedIdCount: number,
): OrientedSelectionFrame | null {
  if (!startFrame || rotatedIdCount < 2 || Math.abs(deltaRad) < 1e-6) return null
  return {
    rect: startFrame.rect,
    rotationDeg: normalizeDeg(startFrame.rotationDeg + radToDeg(deltaRad)),
  }
}

export function angleFromPivotToPoint(pivot: [number, number], point: [number, number]): number {
  return Math.atan2(point[1] - pivot[1], point[0] - pivot[0])
}

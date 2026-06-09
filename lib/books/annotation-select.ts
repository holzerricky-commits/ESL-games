import type { AnnotationCommand, StrokeAnnotationCommand } from '@/lib/books/annotation-command-types'
import { connectedComponentsAmongSelectedPenMarker } from '@/lib/books/annotation-connected-strokes'
import { MARKER_LINE_WIDTH, PEN_LINE_WIDTH } from '@/lib/books/annotation-draw'
import { idsInFigureGroup } from '@/lib/books/annotation-figure-group'
import { pointToSegDistSq, textCommandBBox } from '@/lib/books/annotation-geometry'
import {
  boxShapeRotatedBounds,
  degToRad,
  hitTestBoxShapeAtPoint,
  isRotatableShapeCommand,
  radToDeg,
  rotatePointAroundPivot,
} from '@/lib/books/annotation-rotation'

/** Stamp / callout hit radius as fraction of min(page width, height). */
export const STAMP_RADIUS_NORM = 0.06
export const CALLOUT_RADIUS_NORM = 0.04

export type NormRect = { x: number; y: number; w: number; h: number }

/** Selection chrome box that can spin with the shape. */
export type OrientedSelectionFrame = {
  rect: NormRect
  rotationDeg: number
}

export function orientedSelectionFrameForCommand(
  cmd: AnnotationCommand,
  widthPx: number,
  heightPx: number,
): OrientedSelectionFrame | null {
  switch (cmd.kind) {
    case 'rect':
    case 'ellipse':
    case 'triangle':
      if (cmd.w <= 0 || cmd.h <= 0) return null
      return {
        rect: { x: cmd.x, y: cmd.y, w: cmd.w, h: cmd.h },
        rotationDeg: cmd.rotationDeg ?? 0,
      }
    case 'line':
    case 'arrow': {
      const a = cmd.kind === 'line' ? cmd.a : cmd.from
      const b = cmd.kind === 'line' ? cmd.b : cmd.to
      const minX = Math.min(a[0], b[0])
      const minY = Math.min(a[1], b[1])
      const maxX = Math.max(a[0], b[0])
      const maxY = Math.max(a[1], b[1])
      const pad = 0.008
      const spanW = maxX - minX
      const spanH = maxY - minY
      const w = Math.max(spanW, pad)
      const h = Math.max(spanH, pad)
      return {
        rect: {
          x: minX - (w - spanW) / 2,
          y: minY - (h - spanH) / 2,
          w,
          h,
        },
        rotationDeg: radToDeg(Math.atan2(b[1] - a[1], b[0] - a[0])),
      }
    }
    case 'stroke':
      if (cmd.tool !== 'pen' && cmd.tool !== 'marker') return null
      return strokeOrientedSelectionFrame(cmd, widthPx, heightPx)
    default: {
      const bounds = getAnnotationBounds(cmd, widthPx, heightPx)
      return bounds && bounds.w > 0 && bounds.h > 0
        ? { rect: bounds, rotationDeg: 0 }
        : null
    }
  }
}

/** Unrotated bbox used for stroke rotation pivot and selection chrome. */
export function strokeUnrotatedBounds(
  cmd: StrokeAnnotationCommand,
  widthPx: number,
  heightPx: number,
): NormRect | null {
  if (cmd.rotationBounds) return cmd.rotationBounds
  const pad = strokePadNorm(cmd, widthPx, heightPx)
  return normRectFromPoints(cmd.points, pad)
}

export function strokeOrientedSelectionFrame(
  cmd: StrokeAnnotationCommand,
  widthPx: number,
  heightPx: number,
): OrientedSelectionFrame | null {
  const rect = strokeUnrotatedBounds(cmd, widthPx, heightPx)
  if (!rect || rect.w <= 0 || rect.h <= 0) return null
  return { rect, rotationDeg: cmd.rotationDeg ?? 0 }
}

export function snapshotStrokeRotationBounds(
  cmd: StrokeAnnotationCommand,
  widthPx: number,
  heightPx: number,
): StrokeAnnotationCommand {
  if (cmd.rotationBounds) return cmd
  const bounds = strokeUnrotatedBounds(cmd, widthPx, heightPx)
  if (!bounds) return cmd
  return { ...cmd, rotationBounds: bounds }
}

const SELECT_POINT_HIT_PAD = 0.014

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

function normRectFromPoints(pts: [number, number][], pad: number): NormRect | null {
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
    x: clamp01(minX - pad),
    y: clamp01(minY - pad),
    w: clamp01(maxX - minX + pad * 2),
    h: clamp01(maxY - minY + pad * 2),
  }
}

/** Half-width pad in normalized page space (matches select hit-testing). */
export function strokePadNorm(cmd: StrokeAnnotationCommand, widthPx: number, heightPx: number): number {
  const scale = cmd.widthScale ?? 1
  const linePx = cmd.tool === 'marker' ? MARKER_LINE_WIDTH * scale : PEN_LINE_WIDTH * scale
  return (linePx * 0.55) / Math.min(widthPx, heightPx)
}

function strokeHitAtPoint(
  cmd: StrokeAnnotationCommand,
  nx: number,
  ny: number,
  widthPx: number,
  heightPx: number,
): boolean {
  if (cmd.points.length < 1) return false
  let testX = nx
  let testY = ny
  const deg = cmd.rotationDeg ?? 0
  if (cmd.rotationBounds && Math.abs(deg) > 1e-6) {
    const cx = cmd.rotationBounds.x + cmd.rotationBounds.w / 2
    const cy = cmd.rotationBounds.y + cmd.rotationBounds.h / 2
    ;[testX, testY] = rotatePointAroundPivot([nx, ny], [cx, cy], -degToRad(deg))
  }
  const thresh = strokePadNorm(cmd, widthPx, heightPx) + SELECT_POINT_HIT_PAD
  const threshSq = thresh * thresh
  if (cmd.points.length === 1) {
    const [x, y] = cmd.points[0]!
    const dx = testX - x
    const dy = testY - y
    return dx * dx + dy * dy <= threshSq
  }
  for (let i = 0; i < cmd.points.length - 1; i++) {
    const [x1, y1] = cmd.points[i]!
    const [x2, y2] = cmd.points[i + 1]!
    if (pointToSegDistSq(testX, testY, x1, y1, x2, y2) <= threshSq) return true
  }
  return false
}

function circleBounds(center: [number, number], radiusNorm: number): NormRect {
  return {
    x: clamp01(center[0] - radiusNorm),
    y: clamp01(center[1] - radiusNorm),
    w: clamp01(radiusNorm * 2),
    h: clamp01(radiusNorm * 2),
  }
}

/** Axis-aligned bounds for one command in normalized page space. */
export function getAnnotationBounds(
  cmd: AnnotationCommand,
  widthPx: number,
  heightPx: number,
): NormRect | null {
  switch (cmd.kind) {
    case 'stroke': {
      const deg = cmd.rotationDeg ?? 0
      const local = strokeUnrotatedBounds(cmd, widthPx, heightPx)
      if (local && Math.abs(deg) > 1e-6) {
        return boxShapeRotatedBounds({ ...local, rotationDeg: deg })
      }
      return local
    }
    case 'line':
      return normRectFromPoints([cmd.a, cmd.b], SELECT_POINT_HIT_PAD)
    case 'arrow':
      return normRectFromPoints([cmd.from, cmd.to], SELECT_POINT_HIT_PAD * 2)
    case 'rect':
    case 'ellipse':
    case 'triangle':
      return boxShapeRotatedBounds(cmd)
    case 'stamp':
      return circleBounds(cmd.center, (cmd.scale ?? 1) * STAMP_RADIUS_NORM)
    case 'callout':
      return circleBounds(cmd.center, (cmd.scale ?? 1) * CALLOUT_RADIUS_NORM)
    case 'text': {
      if (!cmd.text.trim()) return null
      const box = textCommandBBox(cmd)
      return { x: box.x, y: box.y, w: box.w, h: box.h }
    }
    case 'sticky':
      return { x: cmd.x, y: cmd.y, w: cmd.w, h: cmd.h }
    default:
      return null
  }
}

export function normRectContainsPoint(rect: NormRect, nx: number, ny: number): boolean {
  return nx >= rect.x && nx <= rect.x + rect.w && ny >= rect.y && ny <= rect.y + rect.h
}

export function normRectsOverlap(a: NormRect, b: NormRect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

/** True when `inner` lies entirely inside `outer`. */
export function normRectFullyContains(outer: NormRect, inner: NormRect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  )
}

/** Smallest axis-aligned rect enclosing all inputs. */
export function unionNormRects(rects: readonly NormRect[]): NormRect | null {
  if (rects.length === 0) return null
  let minX = rects[0]!.x
  let minY = rects[0]!.y
  let maxX = rects[0]!.x + rects[0]!.w
  let maxY = rects[0]!.y + rects[0]!.h
  for (let i = 1; i < rects.length; i++) {
    const r = rects[i]!
    minX = Math.min(minX, r.x)
    minY = Math.min(minY, r.y)
    maxX = Math.max(maxX, r.x + r.w)
    maxY = Math.max(maxY, r.y + r.h)
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

function isPenOrMarkerStroke(cmd: AnnotationCommand): cmd is StrokeAnnotationCommand {
  return cmd.kind === 'stroke' && (cmd.tool === 'pen' || cmd.tool === 'marker')
}

function isFigureGroupedPenMarker(
  cmd: AnnotationCommand,
): cmd is StrokeAnnotationCommand & { figureGroupId: string } {
  return isPenOrMarkerStroke(cmd) && cmd.figureGroupId != null
}

/** How grouped pen/marker selection outlines are drawn. */
export type GroupSelectionChrome = 'union' | 'perStroke'

/** True when every live pen/marker stroke in `figureGroupId` is in `selectedIds`. */
export function isFullFigureGroupSelected(
  commands: readonly AnnotationCommand[],
  selectedIds: readonly string[],
  figureGroupId: string,
  deadIndices?: ReadonlySet<number>,
): boolean {
  const memberIds = idsInFigureGroup(commands as AnnotationCommand[], figureGroupId, deadIndices)
  if (memberIds.length === 0) return false
  const sel = new Set(selectedIds)
  return memberIds.every((id) => sel.has(id))
}

/**
 * Selection outline rects for the select tool.
 * - `union`: one box per fully selected figure group; partial groups get per-stroke boxes.
 * - `perStroke`: one box per selected command (no group union).
 */
export function selectionOutlineRects(
  commands: readonly AnnotationCommand[],
  selectedIds: readonly string[],
  widthPx: number,
  heightPx: number,
  groupChrome: GroupSelectionChrome = 'union',
  deadIndices?: ReadonlySet<number>,
): NormRect[] {
  const groupRects = new Map<string, NormRect[]>()
  const solo: NormRect[] = []
  const ungroupedForCluster: { id: string; bounds: NormRect }[] = []
  const handledGroupMember = new Set<string>()

  for (const id of selectedIds) {
    const cmd = commands.find((c) => c.id === id)
    if (!cmd) continue
    const bounds = getAnnotationBounds(cmd, widthPx, heightPx)
    if (!bounds || bounds.w <= 0 || bounds.h <= 0) continue

    if (isPenOrMarkerStroke(cmd) && groupChrome === 'perStroke') {
      solo.push(bounds)
      continue
    }

    if (isFigureGroupedPenMarker(cmd)) {
      const gid = cmd.figureGroupId
      if (!isFullFigureGroupSelected(commands, selectedIds, gid, deadIndices)) {
        solo.push(bounds)
        continue
      }
      if (handledGroupMember.has(gid)) continue
      handledGroupMember.add(gid)
      const memberIds = idsInFigureGroup(commands as AnnotationCommand[], gid, deadIndices)
      const rects: NormRect[] = []
      for (const memberId of memberIds) {
        const member = commands.find((c) => c.id === memberId)
        if (!member) continue
        const memberBounds = getAnnotationBounds(member, widthPx, heightPx)
        if (memberBounds && memberBounds.w > 0 && memberBounds.h > 0) {
          rects.push(memberBounds)
        }
      }
      const list = groupRects.get(gid) ?? []
      list.push(...rects)
      groupRects.set(gid, list)
      continue
    }

    if (isPenOrMarkerStroke(cmd) && groupChrome === 'union') {
      ungroupedForCluster.push({ id, bounds })
      continue
    }

    solo.push(bounds)
  }

  const out: NormRect[] = []
  for (const rects of groupRects.values()) {
    const u = unionNormRects(rects)
    if (u && u.w > 0 && u.h > 0) out.push(u)
  }

  if (groupChrome === 'union' && ungroupedForCluster.length > 0) {
    const boundsById = new Map(ungroupedForCluster.map((e) => [e.id, e.bounds]))
    const components = connectedComponentsAmongSelectedPenMarker(
      commands,
      ungroupedForCluster.map((e) => e.id),
      widthPx,
      heightPx,
    )
    for (const comp of components) {
      const rects = comp
        .map((id) => boundsById.get(id))
        .filter((r): r is NormRect => r != null)
      if (rects.length === 0) continue
      if (rects.length === 1) {
        solo.push(rects[0]!)
      } else {
        const u = unionNormRects(rects)
        if (u && u.w > 0 && u.h > 0) out.push(u)
      }
    }
  } else {
    for (const { bounds } of ungroupedForCluster) {
      solo.push(bounds)
    }
  }

  for (const rect of solo) {
    out.push(rect)
  }
  return out
}

/** Oriented selection outlines — boxes rotate with shapes instead of using expanded AABBs. */
export function selectionOrientedOutlineFrames(
  commands: readonly AnnotationCommand[],
  selectedIds: readonly string[],
  widthPx: number,
  heightPx: number,
  groupChrome: GroupSelectionChrome = 'union',
  deadIndices?: ReadonlySet<number>,
): OrientedSelectionFrame[] {
  const groupFrames = new Map<string, OrientedSelectionFrame[]>()
  const solo: OrientedSelectionFrame[] = []
  const ungroupedForCluster: { id: string; frame: OrientedSelectionFrame }[] = []
  const handledGroupMember = new Set<string>()

  for (const id of selectedIds) {
    const cmd = commands.find((c) => c.id === id)
    if (!cmd) continue
    const frame = orientedSelectionFrameForCommand(cmd, widthPx, heightPx)
    if (!frame || frame.rect.w <= 0 || frame.rect.h <= 0) continue

    if (isPenOrMarkerStroke(cmd) && groupChrome === 'perStroke') {
      solo.push(frame)
      continue
    }

    if (isFigureGroupedPenMarker(cmd)) {
      const gid = cmd.figureGroupId
      if (!isFullFigureGroupSelected(commands, selectedIds, gid, deadIndices)) {
        solo.push(frame)
        continue
      }
      if (handledGroupMember.has(gid)) continue
      handledGroupMember.add(gid)
      const memberIds = idsInFigureGroup(commands as AnnotationCommand[], gid, deadIndices)
      const frames: OrientedSelectionFrame[] = []
      for (const memberId of memberIds) {
        const member = commands.find((c) => c.id === memberId)
        if (!member) continue
        const memberFrame = orientedSelectionFrameForCommand(member, widthPx, heightPx)
        if (memberFrame && memberFrame.rect.w > 0 && memberFrame.rect.h > 0) {
          frames.push(memberFrame)
        }
      }
      const list = groupFrames.get(gid) ?? []
      list.push(...frames)
      groupFrames.set(gid, list)
      continue
    }

    if (isPenOrMarkerStroke(cmd) && groupChrome === 'union') {
      ungroupedForCluster.push({ id, frame })
      continue
    }

    solo.push(frame)
  }

  const out: OrientedSelectionFrame[] = []
  for (const frames of groupFrames.values()) {
    const rects = frames.map((f) => f.rect)
    const u = unionNormRects(rects)
    if (u && u.w > 0 && u.h > 0) out.push({ rect: u, rotationDeg: 0 })
  }

  if (groupChrome === 'union' && ungroupedForCluster.length > 0) {
    const frameById = new Map(ungroupedForCluster.map((e) => [e.id, e.frame]))
    const components = connectedComponentsAmongSelectedPenMarker(
      commands,
      ungroupedForCluster.map((e) => e.id),
      widthPx,
      heightPx,
    )
    for (const comp of components) {
      const frames = comp
        .map((cid) => frameById.get(cid))
        .filter((f): f is OrientedSelectionFrame => f != null)
      if (frames.length === 0) continue
      if (frames.length === 1) {
        solo.push(frames[0]!)
      } else {
        const u = unionNormRects(frames.map((f) => f.rect))
        if (u && u.w > 0 && u.h > 0) out.push({ rect: u, rotationDeg: 0 })
      }
    }
  } else {
    for (const { frame } of ungroupedForCluster) {
      solo.push(frame)
    }
  }

  for (const frame of solo) {
    out.push(frame)
  }
  return out
}

/** Snapshot pen/marker rotation frames on selected strokes before live rotate preview. */
export function snapshotRotationBaseCommands(
  commands: readonly AnnotationCommand[],
  rotIds: readonly string[],
  widthPx: number,
  heightPx: number,
): AnnotationCommand[] {
  const idSet = new Set(rotIds)
  return commands.map((cmd) => {
    if (!idSet.has(cmd.id)) return cmd
    if (cmd.kind === 'stroke' && (cmd.tool === 'pen' || cmd.tool === 'marker')) {
      return snapshotStrokeRotationBounds(cmd, widthPx, heightPx)
    }
    return cmd
  })
}

/**
 * Selection outline boxes for chrome. During live rotate, borders track the same
 * oriented frame as corner handles (pen strokes otherwise stay at rotationDeg 0).
 */
export function selectionOutlineFramesForChrome(
  commands: readonly AnnotationCommand[],
  selectedIds: readonly string[],
  widthPx: number,
  heightPx: number,
  groupChrome: GroupSelectionChrome = 'union',
  deadIndices?: ReadonlySet<number>,
  liveRotationRad: number | null = null,
  rotationStartFrame: OrientedSelectionFrame | null = null,
): OrientedSelectionFrame[] {
  const frames = selectionOrientedOutlineFrames(
    commands,
    selectedIds,
    widthPx,
    heightPx,
    groupChrome,
    deadIndices,
  )

  if (liveRotationRad == null || !rotationStartFrame) {
    return frames
  }

  const liveDeg = rotationStartFrame.rotationDeg + radToDeg(liveRotationRad)

  if (frames.length === 1) {
    return [{ rect: rotationStartFrame.rect, rotationDeg: liveDeg }]
  }

  return frames.map((frame) =>
    frame.rotationDeg === 0 ? { rect: frame.rect, rotationDeg: liveDeg } : frame,
  )
}

export function rotationStartFrameForGesture(
  commands: readonly AnnotationCommand[],
  selectedIds: readonly string[],
  unionBounds: NormRect,
  widthPx: number,
  heightPx: number,
): OrientedSelectionFrame {
  const rotIds = selectedIds.filter((id) => {
    const cmd = commands.find((c) => c.id === id)
    return cmd != null && isRotatableShapeCommand(cmd)
  })
  if (rotIds.length === 1) {
    const cmd = commands.find((c) => c.id === rotIds[0])
    const frame = cmd ? orientedSelectionFrameForCommand(cmd, widthPx, heightPx) : null
    if (frame) return frame
  }
  return { rect: unionBounds, rotationDeg: 0 }
}

export function resolveSelectionHandleFrame(
  commands: readonly AnnotationCommand[],
  selectedIds: readonly string[],
  widthPx: number,
  heightPx: number,
  unionBounds: NormRect | null,
  liveRotationRad: number | null,
  rotationStartFrame: OrientedSelectionFrame | null,
): OrientedSelectionFrame | null {
  if (liveRotationRad != null && rotationStartFrame) {
    return {
      rect: rotationStartFrame.rect,
      rotationDeg: rotationStartFrame.rotationDeg + radToDeg(liveRotationRad),
    }
  }
  const rotIds = selectedIds.filter((id) => {
    const cmd = commands.find((c) => c.id === id)
    return cmd != null && isRotatableShapeCommand(cmd)
  })
  if (rotIds.length === 1 && selectedIds.length === 1) {
    const cmd = commands.find((c) => c.id === rotIds[0])
    if (cmd) return orientedSelectionFrameForCommand(cmd, widthPx, heightPx)
  }
  return unionBounds ? { rect: unionBounds, rotationDeg: 0 } : null
}

/**
 * CAD / AutoCAD-style marquee modes (direction of drag sets the rule):
 * - `window` (drag left → right): select only objects fully inside the box
 * - `crossing` (drag right → left): select anything the box touches
 */
export type MarqueeSelectMode = 'window' | 'crossing'

/** How marquee selection chooses window vs crossing. */
export type MarqueeSelectRule = 'follow-drag' | 'crossing' | 'window'

export const MARQUEE_SELECT_RULE_CYCLE: readonly MarqueeSelectRule[] = [
  'follow-drag',
  'crossing',
  'window',
]

export function marqueeSelectModeFromDrag(
  anchor: [number, number],
  current: [number, number],
): MarqueeSelectMode {
  return current[0] >= anchor[0] ? 'window' : 'crossing'
}

/** Resolve live/commit marquee mode from user rule and drag geometry. */
export function resolveMarqueeSelectMode(
  anchor: [number, number],
  current: [number, number],
  rule: MarqueeSelectRule,
): MarqueeSelectMode {
  if (rule === 'crossing') return 'crossing'
  if (rule === 'window') return 'window'
  return marqueeSelectModeFromDrag(anchor, current)
}

export function nextMarqueeSelectRule(current: MarqueeSelectRule): MarqueeSelectRule {
  const i = MARQUEE_SELECT_RULE_CYCLE.indexOf(current)
  const next = i < 0 ? 0 : (i + 1) % MARQUEE_SELECT_RULE_CYCLE.length
  return MARQUEE_SELECT_RULE_CYCLE[next]!
}

function commandHitAtPoint(
  cmd: AnnotationCommand,
  nx: number,
  ny: number,
  widthPx: number,
  heightPx: number,
): boolean {
  if (cmd.kind === 'stroke') return strokeHitAtPoint(cmd, nx, ny, widthPx, heightPx)
  if (cmd.kind === 'rect' || cmd.kind === 'ellipse' || cmd.kind === 'triangle') {
    return hitTestBoxShapeAtPoint(cmd, cmd.kind, nx, ny)
  }
  const bounds = getAnnotationBounds(cmd, widthPx, heightPx)
  if (!bounds) return false
  return normRectContainsPoint(bounds, nx, ny)
}

/** Topmost command index at normalized point (later in array = on top). */
export function hitTestAnnotationIndex(
  commands: AnnotationCommand[],
  nx: number,
  ny: number,
  widthPx: number,
  heightPx: number,
  skipIndices?: Set<number>,
): number | null {
  for (let i = commands.length - 1; i >= 0; i--) {
    if (skipIndices?.has(i)) continue
    if (commandHitAtPoint(commands[i]!, nx, ny, widthPx, heightPx)) return i
  }
  return null
}

/** Topmost selected command at point (for move cursor / drag while another tool is active). */
export function hitTestSelectedAnnotationIndex(
  commands: AnnotationCommand[],
  selectedIds: ReadonlySet<string> | readonly string[],
  nx: number,
  ny: number,
  widthPx: number,
  heightPx: number,
  skipIndices?: Set<number>,
): number | null {
  const idSet = selectedIds instanceof Set ? selectedIds : new Set(selectedIds)
  if (idSet.size === 0) return null
  for (let i = commands.length - 1; i >= 0; i--) {
    if (skipIndices?.has(i)) continue
    const cmd = commands[i]!
    if (!idSet.has(cmd.id)) continue
    if (commandHitAtPoint(cmd, nx, ny, widthPx, heightPx)) return i
  }
  return null
}

export function normalizeMarqueeRect(a: [number, number], b: [number, number]): NormRect {
  const x0 = clamp01(Math.min(a[0], b[0]))
  const y0 = clamp01(Math.min(a[1], b[1]))
  const x1 = clamp01(Math.max(a[0], b[0]))
  const y1 = clamp01(Math.max(a[1], b[1]))
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) }
}

/** Command ids selected by a marquee using window or crossing rules. */
export function annotationIdsInMarquee(
  commands: AnnotationCommand[],
  marquee: NormRect,
  widthPx: number,
  heightPx: number,
  mode: MarqueeSelectMode,
  skipIndices?: Set<number>,
): string[] {
  const ids: string[] = []
  for (let i = 0; i < commands.length; i++) {
    if (skipIndices?.has(i)) continue
    const cmd = commands[i]!
    const bounds = getAnnotationBounds(cmd, widthPx, heightPx)
    if (!bounds) continue
    const hit =
      mode === 'window'
        ? normRectFullyContains(marquee, bounds)
        : normRectsOverlap(bounds, marquee)
    if (hit) ids.push(cmd.id)
  }
  return ids
}

/** Shift every positional field by normalized delta. */
export function translateAnnotationCommand(
  cmd: AnnotationCommand,
  dx: number,
  dy: number,
): AnnotationCommand {
  const tx = (p: [number, number]): [number, number] => [clamp01(p[0] + dx), clamp01(p[1] + dy)]

  switch (cmd.kind) {
    case 'stroke':
      return {
        ...cmd,
        points: cmd.points.map(tx),
        ...(cmd.rotationBounds
          ? {
              rotationBounds: {
                x: clamp01(cmd.rotationBounds.x + dx),
                y: clamp01(cmd.rotationBounds.y + dy),
                w: cmd.rotationBounds.w,
                h: cmd.rotationBounds.h,
              },
            }
          : {}),
      }
    case 'line':
      return { ...cmd, a: tx(cmd.a), b: tx(cmd.b) }
    case 'arrow':
      return { ...cmd, from: tx(cmd.from), to: tx(cmd.to) }
    case 'rect':
    case 'ellipse':
    case 'triangle':
      return { ...cmd, x: clamp01(cmd.x + dx), y: clamp01(cmd.y + dy) }
    case 'stamp':
    case 'callout':
      return { ...cmd, center: tx(cmd.center) }
    case 'text':
      return { ...cmd, x: clamp01(cmd.x + dx), y: clamp01(cmd.y + dy) }
    case 'sticky':
      return { ...cmd, x: clamp01(cmd.x + dx), y: clamp01(cmd.y + dy) }
    default:
      return cmd
  }
}

export function translateAnnotationCommands(
  commands: AnnotationCommand[],
  ids: ReadonlySet<string>,
  dx: number,
  dy: number,
): AnnotationCommand[] {
  if (dx === 0 && dy === 0) return commands
  return commands.map((c) => (ids.has(c.id) ? translateAnnotationCommand(c, dx, dy) : c))
}

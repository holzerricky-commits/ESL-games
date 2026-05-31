import type { AnnotationCommand, StrokeAnnotationCommand } from '@/lib/books/annotation-command-types'
import { connectedComponentsAmongSelectedPenMarker } from '@/lib/books/annotation-connected-strokes'
import { MARKER_LINE_WIDTH, PEN_LINE_WIDTH } from '@/lib/books/annotation-draw'
import { idsInFigureGroup } from '@/lib/books/annotation-figure-group'
import { pointToSegDistSq, textCommandBBox } from '@/lib/books/annotation-geometry'

/** Stamp / callout hit radius as fraction of min(page width, height). */
export const STAMP_RADIUS_NORM = 0.06
export const CALLOUT_RADIUS_NORM = 0.04

export type NormRect = { x: number; y: number; w: number; h: number }

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
  const thresh = strokePadNorm(cmd, widthPx, heightPx) + SELECT_POINT_HIT_PAD
  const threshSq = thresh * thresh
  if (cmd.points.length === 1) {
    const [x, y] = cmd.points[0]!
    const dx = nx - x
    const dy = ny - y
    return dx * dx + dy * dy <= threshSq
  }
  for (let i = 0; i < cmd.points.length - 1; i++) {
    const [x1, y1] = cmd.points[i]!
    const [x2, y2] = cmd.points[i + 1]!
    if (pointToSegDistSq(nx, ny, x1, y1, x2, y2) <= threshSq) return true
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
    case 'stroke':
      return normRectFromPoints(cmd.points, strokePadNorm(cmd, widthPx, heightPx))
    case 'line':
      return normRectFromPoints([cmd.a, cmd.b], SELECT_POINT_HIT_PAD)
    case 'arrow':
      return normRectFromPoints([cmd.from, cmd.to], SELECT_POINT_HIT_PAD * 2)
    case 'rect':
    case 'ellipse':
    case 'triangle':
      return { x: cmd.x, y: cmd.y, w: cmd.w, h: cmd.h }
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
      return { ...cmd, points: cmd.points.map(tx) }
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

import type { AnnotationCommand, StrokeAnnotationCommand } from '@/lib/books/annotation-command-types'
import { idsInFigureGroup } from '@/lib/books/annotation-figure-group'
import { ERASER_LINE_BASE_THRESHOLD, polylineMinDistSq } from '@/lib/books/annotation-geometry'
import { strokePadNorm } from '@/lib/books/annotation-select'

export function isPenOrMarkerStroke(cmd: AnnotationCommand): cmd is StrokeAnnotationCommand {
  return cmd.kind === 'stroke' && (cmd.tool === 'pen' || cmd.tool === 'marker')
}

/** Re-export for callers that need the same pad as select hit-testing. */
export { strokePadNorm as strokeConnectPadNorm }

function figureGroupIdsMatch(
  a: StrokeAnnotationCommand,
  b: StrokeAnnotationCommand,
): 'same' | 'different' | 'ungrouped' {
  const ga = a.figureGroupId
  const gb = b.figureGroupId
  if (!ga && !gb) return 'ungrouped'
  if (ga && gb && ga === gb) return 'same'
  return 'different'
}

/** True when two pen/marker strokes belong in the same connected component for selection. */
export function strokesAreConnected(
  a: StrokeAnnotationCommand,
  b: StrokeAnnotationCommand,
  widthPx: number,
  heightPx: number,
): boolean {
  const groupMatch = figureGroupIdsMatch(a, b)
  if (groupMatch === 'different') return false
  if (groupMatch === 'same') return true
  if (a.points.length < 1 || b.points.length < 1) return false
  const padA = strokePadNorm(a, widthPx, heightPx)
  const padB = strokePadNorm(b, widthPx, heightPx)
  const thresh = padA + padB + ERASER_LINE_BASE_THRESHOLD
  const threshSq = thresh * thresh
  return polylineMinDistSq(a.points, b.points) <= threshSq
}

type StrokeEntry = { index: number; cmd: StrokeAnnotationCommand }

function collectPenMarkerStrokes(
  commands: readonly AnnotationCommand[],
  skipIndices?: ReadonlySet<number>,
): StrokeEntry[] {
  const out: StrokeEntry[] = []
  for (let i = 0; i < commands.length; i++) {
    if (skipIndices?.has(i)) continue
    const cmd = commands[i]!
    if (isPenOrMarkerStroke(cmd) && cmd.points.length >= 1) {
      out.push({ index: i, cmd })
    }
  }
  return out
}

/**
 * All pen/marker stroke ids in the same connected component as `seedId` (BFS, ungrouped geometry only).
 */
export function connectedPenMarkerStrokeIds(
  commands: readonly AnnotationCommand[],
  seedId: string,
  widthPx: number,
  heightPx: number,
  skipIndices?: ReadonlySet<number>,
): string[] {
  const strokes = collectPenMarkerStrokes(commands, skipIndices)
  const seedIdx = strokes.findIndex((s) => s.cmd.id === seedId)
  if (seedIdx < 0) return [seedId]

  const seedCmd = strokes[seedIdx]!.cmd
  if (seedCmd.figureGroupId) {
    return idsInFigureGroup(commands, seedCmd.figureGroupId, skipIndices)
  }

  const visited = new Set<number>([seedIdx])
  const queue = [seedIdx]
  const ids: string[] = []

  while (queue.length > 0) {
    const cur = queue.shift()!
    const { cmd: curCmd } = strokes[cur]!
    ids.push(curCmd.id)

    for (let j = 0; j < strokes.length; j++) {
      if (visited.has(j)) continue
      const { cmd: other } = strokes[j]!
      if (other.figureGroupId) continue
      if (strokesAreConnected(curCmd, other, widthPx, heightPx)) {
        visited.add(j)
        queue.push(j)
      }
    }
  }

  return ids
}

/**
 * Connected components among a subset of selected pen/marker ids (geometry only, same selection set).
 */
export function connectedComponentsAmongSelectedPenMarker(
  commands: readonly AnnotationCommand[],
  selectedIds: readonly string[],
  widthPx: number,
  heightPx: number,
): string[][] {
  const sel = new Set(selectedIds)
  const strokes: { id: string; cmd: StrokeAnnotationCommand }[] = []
  for (const cmd of commands) {
    if (!sel.has(cmd.id) || !isPenOrMarkerStroke(cmd) || cmd.points.length < 1) continue
    strokes.push({ id: cmd.id, cmd })
  }

  const visited = new Set<string>()
  const components: string[][] = []

  for (const { id: seedId, cmd: seedCmd } of strokes) {
    if (visited.has(seedId)) continue
    const component: string[] = []
    const queue = [seedId]
    visited.add(seedId)

    while (queue.length > 0) {
      const curId = queue.shift()!
      component.push(curId)
      const curEntry = strokes.find((s) => s.id === curId)
      if (!curEntry) continue
      const { cmd: curCmd } = curEntry
      for (const { id: otherId, cmd: otherCmd } of strokes) {
        if (visited.has(otherId)) continue
        if (strokesAreConnected(curCmd, otherCmd, widthPx, heightPx)) {
          visited.add(otherId)
          queue.push(otherId)
        }
      }
    }
    components.push(component)
  }

  return components
}

/**
 * Resolve selection ids for a select click on pen/marker ink (group id or ungrouped BFS).
 */
export function resolvePenMarkerSelectionIds(
  commands: readonly AnnotationCommand[],
  seedId: string,
  widthPx: number,
  heightPx: number,
  skipIndices?: ReadonlySet<number>,
): string[] {
  const seed = commands.find((c) => c.id === seedId)
  if (!seed || !isPenOrMarkerStroke(seed)) return [seedId]
  return connectedPenMarkerStrokeIds(commands, seedId, widthPx, heightPx, skipIndices)
}

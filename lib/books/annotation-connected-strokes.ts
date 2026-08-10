import type { AnnotationCommand, StrokeAnnotationCommand } from '@/lib/books/annotation-command-types'
import { idsInFigureGroup } from '@/lib/books/annotation-figure-group'
import { ERASER_LINE_BASE_THRESHOLD, polylineMinDistSq } from '@/lib/books/annotation-geometry'
import { strokePadNorm } from '@/lib/books/annotation-select'

export function isPenOrMarkerStroke(cmd: AnnotationCommand): cmd is StrokeAnnotationCommand {
  return cmd.kind === 'stroke' && (cmd.tool === 'pen' || cmd.tool === 'marker')
}

function isPenStroke(cmd: AnnotationCommand): cmd is StrokeAnnotationCommand {
  return cmd.kind === 'stroke' && cmd.tool === 'pen'
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

/**
 * True when two pen strokes belong in the same connected component for selection.
 * Highlighter (marker) strokes never group — always false if either side is a marker.
 */
export function strokesAreConnected(
  a: StrokeAnnotationCommand,
  b: StrokeAnnotationCommand,
  widthPx: number,
  heightPx: number,
): boolean {
  if (a.tool === 'marker' || b.tool === 'marker') return false
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

function collectPenStrokes(
  commands: AnnotationCommand[],
  skipIndices?: Set<number>,
): StrokeEntry[] {
  const out: StrokeEntry[] = []
  for (let i = 0; i < commands.length; i++) {
    if (skipIndices?.has(i)) continue
    const cmd = commands[i]!
    if (isPenStroke(cmd) && cmd.points.length >= 1) {
      out.push({ index: i, cmd })
    }
  }
  return out
}

/**
 * All pen stroke ids in the same connected component as `seedId` (BFS, ungrouped geometry only).
 * Highlighter seeds resolve to themselves only.
 */
export function connectedPenMarkerStrokeIds(
  commands: AnnotationCommand[],
  seedId: string,
  widthPx: number,
  heightPx: number,
  skipIndices?: Set<number>,
): string[] {
  const seedCmd = commands.find((c) => c.id === seedId)
  if (!seedCmd || !isPenOrMarkerStroke(seedCmd)) return [seedId]
  if (seedCmd.tool === 'marker') return [seedId]

  const strokes = collectPenStrokes(commands, skipIndices)
  const seedIdx = strokes.findIndex((s) => s.cmd.id === seedId)
  if (seedIdx < 0) return [seedId]

  const seeded = strokes[seedIdx]!.cmd
  if (seeded.figureGroupId) {
    return idsInFigureGroup(commands, seeded.figureGroupId, skipIndices)
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
 * Connected components among selected pen strokes (geometry only).
 * Selected highlighter strokes each stay a singleton component.
 */
export function connectedComponentsAmongSelectedPenMarker(
  commands: readonly AnnotationCommand[],
  selectedIds: readonly string[],
  widthPx: number,
  heightPx: number,
): string[][] {
  const sel = new Set(selectedIds)
  const components: string[][] = []

  for (const cmd of commands) {
    if (!sel.has(cmd.id) || !isPenOrMarkerStroke(cmd) || cmd.points.length < 1) continue
    if (cmd.tool === 'marker') {
      components.push([cmd.id])
    }
  }

  const pens: { id: string; cmd: StrokeAnnotationCommand }[] = []
  for (const cmd of commands) {
    if (!sel.has(cmd.id) || !isPenStroke(cmd) || cmd.points.length < 1) continue
    pens.push({ id: cmd.id, cmd })
  }

  const visited = new Set<string>()

  for (const { id: seedId } of pens) {
    if (visited.has(seedId)) continue
    const component: string[] = []
    const queue = [seedId]
    visited.add(seedId)

    while (queue.length > 0) {
      const curId = queue.shift()!
      component.push(curId)
      const curEntry = pens.find((s) => s.id === curId)
      if (!curEntry) continue
      const { cmd: curCmd } = curEntry
      for (const { id: otherId, cmd: otherCmd } of pens) {
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
 * Resolve selection ids for a select click on pen ink (group id or ungrouped BFS).
 * Highlighter clicks always resolve to the single stroke.
 */
export function resolvePenMarkerSelectionIds(
  commands: AnnotationCommand[],
  seedId: string,
  widthPx: number,
  heightPx: number,
  skipIndices?: Set<number>,
): string[] {
  const seed = commands.find((c) => c.id === seedId)
  if (!seed || !isPenOrMarkerStroke(seed)) return [seedId]
  if (seed.tool === 'marker') return [seedId]
  return connectedPenMarkerStrokeIds(commands, seedId, widthPx, heightPx, skipIndices)
}

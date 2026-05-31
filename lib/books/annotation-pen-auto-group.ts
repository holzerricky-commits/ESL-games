import type { AnnotationCommand, StrokeAnnotationCommand } from '@/lib/books/annotation-command-types'
import { ERASER_LINE_BASE_THRESHOLD, polylineMinDistSq } from '@/lib/books/annotation-geometry'
import { strokePadNorm } from '@/lib/books/annotation-select'
import { assignFigureGroupId, newFigureGroupId } from '@/lib/books/annotation-figure-group'

/** Pen strokes that should share one figure group when auto-grouping on commit. */
export function penStrokesConnectForAutoGroup(
  a: StrokeAnnotationCommand,
  b: StrokeAnnotationCommand,
  widthPx: number,
  heightPx: number,
): boolean {
  const ga = a.figureGroupId
  const gb = b.figureGroupId
  if (ga && gb && ga !== gb) return false
  if (ga && gb && ga === gb) return true
  if (a.points.length < 1 || b.points.length < 1) return false
  const padA = strokePadNorm(a, widthPx, heightPx)
  const padB = strokePadNorm(b, widthPx, heightPx)
  const thresh = padA + padB + ERASER_LINE_BASE_THRESHOLD
  return polylineMinDistSq(a.points, b.points) <= thresh * thresh
}

function isPenStroke(cmd: AnnotationCommand): cmd is StrokeAnnotationCommand {
  return cmd.kind === 'stroke' && cmd.tool === 'pen'
}

type PenStrokeEntry = { index: number; cmd: StrokeAnnotationCommand }

function collectPenStrokes(
  commands: readonly AnnotationCommand[],
  skipIndices?: ReadonlySet<number>,
): PenStrokeEntry[] {
  const out: PenStrokeEntry[] = []
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
 * Pen strokes in the same connected component as `seedId` for auto-grouping on commit.
 * Unlike select BFS, includes strokes that already have a figureGroupId.
 */
export function connectedPenStrokeIdsForAutoGroup(
  commands: readonly AnnotationCommand[],
  seedId: string,
  widthPx: number,
  heightPx: number,
  skipIndices?: ReadonlySet<number>,
): string[] {
  const strokes = collectPenStrokes(commands, skipIndices)
  const seedIdx = strokes.findIndex((s) => s.cmd.id === seedId)
  if (seedIdx < 0) return [seedId]

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
      if (penStrokesConnectForAutoGroup(curCmd, other, widthPx, heightPx)) {
        visited.add(j)
        queue.push(j)
      }
    }
  }

  return ids
}

function resolveFigureGroupIdForComponent(
  commands: readonly AnnotationCommand[],
  componentIds: readonly string[],
): string {
  const idSet = new Set(componentIds)
  let existing: string | undefined
  for (const cmd of commands) {
    if (!idSet.has(cmd.id) || !isPenStroke(cmd) || !cmd.figureGroupId) continue
    if (existing && existing !== cmd.figureGroupId) {
      return existing
    }
    existing = cmd.figureGroupId
  }
  return existing ?? newFigureGroupId()
}

/**
 * After a pen stroke is committed, assign one `figureGroupId` to it and all touching pen strokes.
 */
export function autoGroupPenStrokeAfterCommit(
  commands: AnnotationCommand[],
  newStrokeId: string,
  widthPx: number,
  heightPx: number,
  skipIndices?: ReadonlySet<number>,
): AnnotationCommand[] {
  const seed = commands.find((c) => c.id === newStrokeId)
  if (!seed || !isPenStroke(seed)) return commands

  const componentIds = connectedPenStrokeIdsForAutoGroup(
    commands,
    newStrokeId,
    widthPx,
    heightPx,
    skipIndices,
  )
  if (componentIds.length === 0) return commands

  const figureGroupId = resolveFigureGroupIdForComponent(commands, componentIds)
  return assignFigureGroupId(commands, new Set(componentIds), figureGroupId).commands
}

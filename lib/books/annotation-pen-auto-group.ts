import type { AnnotationCommand, StrokeAnnotationCommand } from '@/lib/books/annotation-command-types'
import { ERASER_LINE_BASE_THRESHOLD, polylineMinDistSq } from '@/lib/books/annotation-geometry'
import { strokePadNorm } from '@/lib/books/annotation-select'
import { assignFigureGroupId, newFigureGroupId } from '@/lib/books/annotation-figure-group'
import { PEN_AUTO_GROUP_IDLE_MS } from '@/lib/books/pen-auto-group-config'

function isPenStroke(cmd: AnnotationCommand): cmd is StrokeAnnotationCommand {
  return cmd.kind === 'stroke' && cmd.tool === 'pen'
}

/** Stamp commit time on pen strokes when they land on the canvas. */
export function stampPenStrokeOnCommit(
  cmd: StrokeAnnotationCommand,
  nowMs: number = Date.now(),
): StrokeAnnotationCommand {
  if (cmd.tool !== 'pen') return cmd
  if (cmd.committedAtMs != null) return cmd
  return { ...cmd, committedAtMs: nowMs }
}

/** Close every pen figure group so new pen ink cannot auto-join (e.g. leaving pen tool). */
export function lockPenFigureAutoJoinOnCommands(
  commands: readonly AnnotationCommand[],
): AnnotationCommand[] {
  let changed = false
  const next = commands.map((cmd) => {
    if (!isPenStroke(cmd) || !cmd.figureGroupId || cmd.figureAutoJoinClosed) return cmd
    changed = true
    return { ...cmd, figureAutoJoinClosed: true }
  })
  return changed ? next : [...commands]
}

export function penStrokesTouchGeometrically(
  a: StrokeAnnotationCommand,
  b: StrokeAnnotationCommand,
  widthPx: number,
  heightPx: number,
): boolean {
  if (a.points.length < 1 || b.points.length < 1) return false
  const padA = strokePadNorm(a, widthPx, heightPx)
  const padB = strokePadNorm(b, widthPx, heightPx)
  const thresh = padA + padB + ERASER_LINE_BASE_THRESHOLD
  return polylineMinDistSq(a.points, b.points) <= thresh * thresh
}

function isPenFigureGroupAutoJoinOpen(
  commands: readonly AnnotationCommand[],
  groupId: string,
): boolean {
  let found = false
  for (const cmd of commands) {
    if (!isPenStroke(cmd) || cmd.figureGroupId !== groupId) continue
    found = true
    if (cmd.figureAutoJoinClosed) return false
    if (cmd.committedAtMs == null) return false
  }
  return found
}

function penFigureGroupLastCommitMs(
  commands: readonly AnnotationCommand[],
  groupId: string,
): number | null {
  let max: number | null = null
  for (const cmd of commands) {
    if (!isPenStroke(cmd) || cmd.figureGroupId !== groupId) continue
    const t = cmd.committedAtMs
    if (t == null) return null
    if (max == null || t > max) max = t
  }
  return max
}

function withinIdleMs(laterMs: number, earlierMs: number): boolean {
  return laterMs - earlierMs <= PEN_AUTO_GROUP_IDLE_MS
}

/**
 * Whether `other` can auto-join the new stroke's merge window (idle gap + tool lock).
 * `anchorMs` is the newly committed stroke's `committedAtMs`.
 */
export function penStrokesEligibleForAutoJoin(
  curCmd: StrokeAnnotationCommand,
  other: StrokeAnnotationCommand,
  commands: readonly AnnotationCommand[],
  anchorMs: number,
  widthPx: number,
  heightPx: number,
): boolean {
  const ga = curCmd.figureGroupId
  const gb = other.figureGroupId
  if (ga && gb && ga !== gb) return false

  if (!penStrokesTouchGeometrically(curCmd, other, widthPx, heightPx)) return false

  if (ga && gb && ga === gb) {
    return isPenFigureGroupAutoJoinOpen(commands, ga)
  }

  if (gb) {
    if (!isPenFigureGroupAutoJoinOpen(commands, gb)) return false
    const last = penFigureGroupLastCommitMs(commands, gb)
    return last != null && withinIdleMs(anchorMs, last)
  }

  if (ga) {
    if (!isPenFigureGroupAutoJoinOpen(commands, ga)) return false
    const last = penFigureGroupLastCommitMs(commands, ga)
    return last != null && withinIdleMs(anchorMs, last)
  }

  const tCur = curCmd.committedAtMs
  const tOther = other.committedAtMs
  if (tCur == null || tOther == null) return false
  return withinIdleMs(Math.max(tCur, tOther), Math.min(tCur, tOther))
}

/** @deprecated Use penStrokesTouchGeometrically + penStrokesEligibleForAutoJoin */
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
  return penStrokesTouchGeometrically(a, b, widthPx, heightPx)
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
 * Respects idle gap and closed figure groups.
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

  const seedCmd = strokes[seedIdx]!.cmd
  const anchorMs = seedCmd.committedAtMs ?? Date.now()

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
      if (
        penStrokesEligibleForAutoJoin(curCmd, other, commands, anchorMs, widthPx, heightPx) ||
        penStrokesEligibleForAutoJoin(other, curCmd, commands, anchorMs, widthPx, heightPx)
      ) {
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

/** Append one command, then auto-group pen strokes when the preference is on. */
export function appendCommandWithPenAutoGroup(
  commands: readonly AnnotationCommand[],
  cmd: AnnotationCommand,
  options: {
    penAutoGroupConnected: boolean
    widthPx: number
    heightPx: number
    skipIndices?: ReadonlySet<number>
    nowMs?: number
  },
): AnnotationCommand[] {
  const stamped = isPenStroke(cmd) ? stampPenStrokeOnCommit(cmd, options.nowMs) : cmd
  const next = [...commands, stamped]
  if (!options.penAutoGroupConnected) return next
  if (!isPenStroke(stamped)) return next
  return autoGroupPenStrokeAfterCommit(
    next,
    stamped.id,
    options.widthPx,
    options.heightPx,
    options.skipIndices,
  )
}

/**
 * After a pen stroke is committed, assign one `figureGroupId` to it and all eligible touching pens.
 */
export function autoGroupPenStrokeAfterCommit(
  commands: AnnotationCommand[],
  newStrokeId: string,
  widthPx: number,
  heightPx: number,
  skipIndices?: ReadonlySet<number>,
): AnnotationCommand[] {
  const seedIdx = commands.findIndex((c) => c.id === newStrokeId)
  if (seedIdx < 0) return commands
  const seed = commands[seedIdx]
  if (!seed || !isPenStroke(seed)) return commands

  const stampedSeed =
    seed.committedAtMs == null ? stampPenStrokeOnCommit(seed) : seed
  const withStamp =
    stampedSeed === seed ? commands : commands.map((c, i) => (i === seedIdx ? stampedSeed : c))

  const componentIds = connectedPenStrokeIdsForAutoGroup(
    withStamp,
    newStrokeId,
    widthPx,
    heightPx,
    skipIndices,
  )
  if (componentIds.length === 0) return withStamp

  const figureGroupId = resolveFigureGroupIdForComponent(withStamp, componentIds)
  return assignFigureGroupId(withStamp, new Set(componentIds), figureGroupId).commands
}

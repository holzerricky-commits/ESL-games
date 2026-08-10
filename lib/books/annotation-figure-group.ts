import type { AnnotationCommand, StrokeAnnotationCommand } from '@/lib/books/annotation-command-types'

function isPenStroke(cmd: AnnotationCommand): cmd is StrokeAnnotationCommand {
  return cmd.kind === 'stroke' && cmd.tool === 'pen'
}

export function newFigureGroupId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `fg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`
}

/**
 * When any pen stroke in `dead` has a figure group, mark all sibling strokes dead too.
 * Highlighter strokes never participate in figure groups.
 */
export function expandDeadIndicesForFigureGroups(
  commands: readonly AnnotationCommand[],
  dead: Set<number>,
): void {
  const groupsToExpand = new Set<string>()
  for (const idx of dead) {
    const cmd = commands[idx]
    if (!cmd || !isPenStroke(cmd) || !cmd.figureGroupId) continue
    groupsToExpand.add(cmd.figureGroupId)
  }
  if (groupsToExpand.size === 0) return
  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i]!
    if (!isPenStroke(cmd) || !cmd.figureGroupId) continue
    if (groupsToExpand.has(cmd.figureGroupId)) dead.add(i)
  }
}

/** All pen stroke ids on the page with this figure group id. */
export function idsInFigureGroup(
  commands: AnnotationCommand[],
  figureGroupId: string,
  skipIndices?: ReadonlySet<number>,
): string[] {
  const ids: string[] = []
  for (let i = 0; i < commands.length; i++) {
    if (skipIndices?.has(i)) continue
    const cmd = commands[i]!
    if (isPenStroke(cmd) && cmd.figureGroupId === figureGroupId) {
      ids.push(cmd.id)
    }
  }
  return ids
}

/** Assign `figureGroupId` to selected pen strokes only; returns updated commands and affected ids. */
export function assignFigureGroupId(
  commands: AnnotationCommand[],
  selectedIds: ReadonlySet<string>,
  figureGroupId: string,
): { commands: AnnotationCommand[]; affectedIds: string[] } {
  const affectedIds: string[] = []
  const next = commands.map((cmd) => {
    if (!selectedIds.has(cmd.id) || !isPenStroke(cmd)) return cmd
    affectedIds.push(cmd.id)
    return { ...cmd, figureGroupId }
  })
  return { commands: next, affectedIds }
}

/** Selected pen strokes from `selectedIds` (highlighter never groups). */
export function selectedPenMarkerStrokes(
  commands: readonly AnnotationCommand[],
  selectedIds: readonly string[],
): StrokeAnnotationCommand[] {
  const idSet = new Set(selectedIds)
  const out: StrokeAnnotationCommand[] = []
  for (const cmd of commands) {
    if (idSet.has(cmd.id) && isPenStroke(cmd)) out.push(cmd)
  }
  return out
}

/** True when every selected pen stroke already has a `figureGroupId` (toggle → ungroup). */
export function shouldToggleSelectionToUngroup(
  commands: readonly AnnotationCommand[],
  selectedIds: readonly string[],
): boolean {
  const strokes = selectedPenMarkerStrokes(commands, selectedIds)
  if (strokes.length === 0) return false
  return strokes.every((cmd) => cmd.figureGroupId != null)
}

/**
 * Label for the selection-bar group toggle. Highlighter marks are ignored —
 * grouping is pen-only (needs 2+ pens to group; ungroup when selected pens are grouped).
 */
export function figureGroupToggleLabelForSelection(
  commands: readonly AnnotationCommand[],
  selectedIds: readonly string[],
): 'group' | 'ungroup' | undefined {
  const pens = selectedPenMarkerStrokes(commands, selectedIds)
  if (pens.length === 0) return undefined
  if (shouldToggleSelectionToUngroup(commands, selectedIds)) return 'ungroup'
  if (pens.length < 2) return undefined
  return 'group'
}

/** Remove `figureGroupId` from selected pen strokes. */
export function clearFigureGroupId(
  commands: AnnotationCommand[],
  selectedIds: ReadonlySet<string>,
): { commands: AnnotationCommand[]; affectedIds: string[] } {
  const affectedIds: string[] = []
  const next = commands.map((cmd) => {
    if (!selectedIds.has(cmd.id) || !isPenStroke(cmd) || !cmd.figureGroupId) return cmd
    affectedIds.push(cmd.id)
    const { figureGroupId: _removed, ...rest } = cmd
    return rest as StrokeAnnotationCommand
  })
  return { commands: next, affectedIds }
}

/**
 * After paste clone: map each distinct old figureGroupId to a fresh id on pen strokes only.
 */
export function remapFigureGroupIdsForPaste(commands: AnnotationCommand[]): AnnotationCommand[] {
  const oldToNew = new Map<string, string>()
  return commands.map((cmd) => {
    if (!isPenStroke(cmd) || !cmd.figureGroupId) return cmd
    let nextId = oldToNew.get(cmd.figureGroupId)
    if (!nextId) {
      nextId = newFigureGroupId()
      oldToNew.set(cmd.figureGroupId, nextId)
    }
    return { ...cmd, figureGroupId: nextId }
  })
}

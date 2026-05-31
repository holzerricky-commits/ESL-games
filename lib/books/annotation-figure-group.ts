import type { AnnotationCommand, StrokeAnnotationCommand } from '@/lib/books/annotation-command-types'

function isPenOrMarkerStroke(cmd: AnnotationCommand): cmd is StrokeAnnotationCommand {
  return cmd.kind === 'stroke' && (cmd.tool === 'pen' || cmd.tool === 'marker')
}

export function newFigureGroupId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `fg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`
}

/** All pen/marker stroke ids on the page with this figure group id. */
export function idsInFigureGroup(
  commands: AnnotationCommand[],
  figureGroupId: string,
  skipIndices?: ReadonlySet<number>,
): string[] {
  const ids: string[] = []
  for (let i = 0; i < commands.length; i++) {
    if (skipIndices?.has(i)) continue
    const cmd = commands[i]!
    if (isPenOrMarkerStroke(cmd) && cmd.figureGroupId === figureGroupId) {
      ids.push(cmd.id)
    }
  }
  return ids
}

/** Assign `figureGroupId` to selected pen/marker strokes; returns updated commands and affected ids. */
export function assignFigureGroupId(
  commands: AnnotationCommand[],
  selectedIds: ReadonlySet<string>,
  figureGroupId: string,
): { commands: AnnotationCommand[]; affectedIds: string[] } {
  const affectedIds: string[] = []
  const next = commands.map((cmd) => {
    if (!selectedIds.has(cmd.id) || !isPenOrMarkerStroke(cmd)) return cmd
    affectedIds.push(cmd.id)
    return { ...cmd, figureGroupId }
  })
  return { commands: next, affectedIds }
}

/** Selected pen/marker strokes from `selectedIds`. */
export function selectedPenMarkerStrokes(
  commands: readonly AnnotationCommand[],
  selectedIds: readonly string[],
): StrokeAnnotationCommand[] {
  const idSet = new Set(selectedIds)
  const out: StrokeAnnotationCommand[] = []
  for (const cmd of commands) {
    if (idSet.has(cmd.id) && isPenOrMarkerStroke(cmd)) out.push(cmd)
  }
  return out
}

/** True when every selected pen/marker stroke already has a `figureGroupId` (toggle → ungroup). */
export function shouldToggleSelectionToUngroup(
  commands: readonly AnnotationCommand[],
  selectedIds: readonly string[],
): boolean {
  const strokes = selectedPenMarkerStrokes(commands, selectedIds)
  if (strokes.length === 0) return false
  return strokes.every((cmd) => cmd.figureGroupId != null)
}

/** Remove `figureGroupId` from selected pen/marker strokes. */
export function clearFigureGroupId(
  commands: AnnotationCommand[],
  selectedIds: ReadonlySet<string>,
): { commands: AnnotationCommand[]; affectedIds: string[] } {
  const affectedIds: string[] = []
  const next = commands.map((cmd) => {
    if (!selectedIds.has(cmd.id) || !isPenOrMarkerStroke(cmd) || !cmd.figureGroupId) return cmd
    affectedIds.push(cmd.id)
    const { figureGroupId: _removed, ...rest } = cmd
    return rest as StrokeAnnotationCommand
  })
  return { commands: next, affectedIds }
}

/**
 * After paste clone: map each distinct old figureGroupId to a fresh id on pen/marker strokes.
 */
export function remapFigureGroupIdsForPaste(commands: AnnotationCommand[]): AnnotationCommand[] {
  const oldToNew = new Map<string, string>()
  return commands.map((cmd) => {
    if (!isPenOrMarkerStroke(cmd) || !cmd.figureGroupId) return cmd
    let nextId = oldToNew.get(cmd.figureGroupId)
    if (!nextId) {
      nextId = newFigureGroupId()
      oldToNew.set(cmd.figureGroupId, nextId)
    }
    return { ...cmd, figureGroupId: nextId }
  })
}

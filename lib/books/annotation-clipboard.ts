import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import { remapFigureGroupIdsForPaste } from '@/lib/books/annotation-figure-group'
import { translateAnnotationCommand } from '@/lib/books/annotation-select'

function newAnnotationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `ann_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`
}

function cloneCommand(cmd: AnnotationCommand): AnnotationCommand {
  if (typeof structuredClone === 'function') {
    return structuredClone(cmd)
  }
  return JSON.parse(JSON.stringify(cmd)) as AnnotationCommand
}

let clipboard: AnnotationCommand[] = []

export function setAnnotationClipboard(commands: AnnotationCommand[]): void {
  clipboard = commands.map(cloneCommand)
}

export function getAnnotationClipboard(): readonly AnnotationCommand[] {
  return clipboard
}

export function hasAnnotationClipboard(): boolean {
  return clipboard.length > 0
}

/** Deep copy with new ids and a small offset so pasted items are visible. */
export function duplicateCommandsForPaste(
  commands: readonly AnnotationCommand[],
  offset: [number, number] = [0.02, 0.02],
): AnnotationCommand[] {
  const withNewIds = commands.map((cmd) => {
    const dup = cloneCommand(cmd)
    const moved = translateAnnotationCommand(dup, offset[0], offset[1])
    return { ...moved, id: newAnnotationId() }
  })
  return remapFigureGroupIdsForPaste(withNewIds)
}

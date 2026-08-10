import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import type { GroupSelectionChrome } from '@/lib/books/annotation-select'

/** Which command ids should move when starting a select drag on hitCmd. */
export function resolveSelectMoveIdsForDrag(
  hitCmd: AnnotationCommand,
  dragSelectionIds: readonly string[],
  groupSelectionChrome: GroupSelectionChrome,
): string[] {
  if (
    groupSelectionChrome === 'perStroke' &&
    hitCmd.kind === 'stroke' &&
    (hitCmd.tool === 'pen' || hitCmd.tool === 'marker')
  ) {
    return [hitCmd.id]
  }
  return [...dragSelectionIds]
}

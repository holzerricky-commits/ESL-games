import type { AnnotationCommand } from '@/lib/books/annotation-command-types'

/** True when `next` is `prev` plus exactly one new command at the end (by id). */
export function canIncrementallyAppendSpreadSessionCommands(
  prev: readonly AnnotationCommand[],
  next: readonly AnnotationCommand[],
): boolean {
  if (next.length !== prev.length + 1) return false
  for (let i = 0; i < prev.length; i++) {
    if (prev[i]?.id !== next[i]?.id) return false
  }
  return true
}

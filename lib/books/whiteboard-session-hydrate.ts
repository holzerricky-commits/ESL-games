import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import { isWhiteboardDelegatedCanvasCommand } from '@/lib/books/ink-session-page-layer'

/** Canvas ink + text/sticky from legacy whiteboard storage → session store. */
export function hydrateWhiteboardSessionFromLegacyStorage(
  legacy: readonly AnnotationCommand[],
): AnnotationCommand[] {
  return legacy.filter(
    (c) =>
      isWhiteboardDelegatedCanvasCommand(c) || c.kind === 'text' || c.kind === 'sticky',
  )
}

/** Legacy storage rows kept on the page layer (marker, etc. — not session-owned ink or DOM). */
export function legacyStorageCommandsWithoutDelegatedInk(
  legacy: readonly AnnotationCommand[],
): AnnotationCommand[] {
  return legacy.filter(
    (c) =>
      !isWhiteboardDelegatedCanvasCommand(c) && c.kind !== 'text' && c.kind !== 'sticky',
  )
}

/** @deprecated Use legacyStorageCommandsWithoutDelegatedInk */
export const legacyStorageCommandsWithoutDelegatedPen = legacyStorageCommandsWithoutDelegatedInk

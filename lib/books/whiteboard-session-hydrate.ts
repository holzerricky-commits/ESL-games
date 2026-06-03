import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import { isWhiteboardDelegatedCanvasCommand } from '@/lib/books/ink-session-page-layer'

/** Canvas ink (strokes + shapes) from legacy whiteboard storage → session store. */
export function hydrateWhiteboardSessionFromLegacyStorage(
  legacy: readonly AnnotationCommand[],
): AnnotationCommand[] {
  return legacy.filter(isWhiteboardDelegatedCanvasCommand)
}

/** Legacy storage rows kept on the page layer (text, sticky, eraser, shapes, etc.). */
export function legacyStorageCommandsWithoutDelegatedInk(
  legacy: readonly AnnotationCommand[],
): AnnotationCommand[] {
  return legacy.filter((c) => !isWhiteboardDelegatedCanvasCommand(c))
}

/** @deprecated Use legacyStorageCommandsWithoutDelegatedInk */
export const legacyStorageCommandsWithoutDelegatedPen = legacyStorageCommandsWithoutDelegatedInk

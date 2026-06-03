import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import { isMarkerStrokeCommand } from '@/lib/books/annotation-draw'

/** Canvas commands owned by an ink session layer (book spread or whiteboard). */
export function isInkSessionDelegatedCanvasCommand(cmd: AnnotationCommand): boolean {
  if (cmd.kind === 'stroke') return true
  if (isMarkerStrokeCommand(cmd)) return true
  return (
    cmd.kind === 'line' ||
    cmd.kind === 'arrow' ||
    cmd.kind === 'rect' ||
    cmd.kind === 'ellipse' ||
    cmd.kind === 'triangle'
  )
}

/** @deprecated Use isInkSessionDelegatedCanvasCommand */
export const isSpreadDelegatedCanvasCommand = isInkSessionDelegatedCanvasCommand

/**
 * When spread ink is delegated, page layers still load/persist full storage but only
 * paint DOM + non-session canvas items (text, sticky, stamp, callout).
 */
export function pageLayerCanvasCommandsWhenSpreadInkDelegated(
  commands: readonly AnnotationCommand[],
  spreadInkDelegated: boolean,
): AnnotationCommand[] {
  if (!spreadInkDelegated) return [...commands]
  return commands.filter((c) => !isInkSessionDelegatedCanvasCommand(c))
}

/** Phase 1 whiteboard: pen only on session (superseded when full ink delegated). */
export function isWhiteboardPenDelegatedCanvasCommand(cmd: AnnotationCommand): boolean {
  return cmd.kind === 'stroke' && cmd.tool === 'pen'
}

/** Whiteboard session: strokes + shapes on session layer; text/sticky/stamp on page layer. */
export function isWhiteboardDelegatedCanvasCommand(cmd: AnnotationCommand): boolean {
  return isInkSessionDelegatedCanvasCommand(cmd)
}

export function pageLayerCanvasCommandsWhenWhiteboardPenInkDelegated(
  commands: readonly AnnotationCommand[],
  whiteboardPenInkDelegated: boolean,
): AnnotationCommand[] {
  return pageLayerCanvasCommandsWhenWhiteboardInkDelegated(commands, whiteboardPenInkDelegated)
}

export function pageLayerCanvasCommandsWhenWhiteboardInkDelegated(
  commands: readonly AnnotationCommand[],
  whiteboardInkDelegated: boolean,
): AnnotationCommand[] {
  if (!whiteboardInkDelegated) return [...commands]
  return commands.filter((c) => !isWhiteboardDelegatedCanvasCommand(c))
}

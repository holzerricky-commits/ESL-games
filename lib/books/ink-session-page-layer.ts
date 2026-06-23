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
    cmd.kind === 'triangle' ||
    cmd.kind === 'stamp' ||
    cmd.kind === 'callout'
  )
}

/** @deprecated Use isInkSessionDelegatedCanvasCommand */
export const isSpreadDelegatedCanvasCommand = isInkSessionDelegatedCanvasCommand

/** Commands owned by the book spread session (canvas + text + sticky). */
export function isSpreadSessionOwnedCommand(cmd: AnnotationCommand): boolean {
  if (isInkSessionDelegatedCanvasCommand(cmd)) return true
  return cmd.kind === 'text' || cmd.kind === 'sticky'
}

/**
 * When spread ink is delegated, page layers still load/persist full storage but only
 * paint items not owned by the spread session.
 */
export function pageLayerCommandsWhenSpreadDelegated(
  commands: readonly AnnotationCommand[],
  spreadInkDelegated: boolean,
): AnnotationCommand[] {
  if (!spreadInkDelegated) return [...commands]
  return commands.filter((c) => !isSpreadSessionOwnedCommand(c))
}

/** @deprecated Use pageLayerCommandsWhenSpreadDelegated */
export function pageLayerCanvasCommandsWhenSpreadInkDelegated(
  commands: readonly AnnotationCommand[],
  spreadInkDelegated: boolean,
): AnnotationCommand[] {
  return pageLayerCommandsWhenSpreadDelegated(commands, spreadInkDelegated)
}

/** Phase 1 whiteboard: pen only on session (superseded when full ink delegated). */
export function isWhiteboardPenDelegatedCanvasCommand(cmd: AnnotationCommand): boolean {
  return cmd.kind === 'stroke' && cmd.tool === 'pen'
}

/** Whiteboard session: strokes + shapes + stamp/callout on session layer; text/sticky on page layer (book spread migrates text/sticky to spread session). */
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
  return commands.filter(
    (c) =>
      !isWhiteboardDelegatedCanvasCommand(c) && c.kind !== 'text' && c.kind !== 'sticky',
  )
}

import type { StrokeAnnotationCommand, StrokeTool } from '@/lib/books/annotation-command-types'

type StrokeDraftLike = Pick<StrokeAnnotationCommand, 'tool' | 'points'>

export type AnnotationPaintOptions = {
  /** Refresh draft overlay only; committed ink/marker slices are already correct. */
  skipCommittedReplay?: boolean
}

/** Resolve eraser-line preview for dead-index computation while drawing. */
export function eraserLineTrailingForReplay(
  draftStroke: StrokeDraftLike | null,
  liveEraserLineDraft: StrokeDraftLike | null,
): StrokeDraftLike | null {
  if (draftStroke?.tool === 'eraser-line' && draftStroke.points.length >= 2) {
    return draftStroke
  }
  if (liveEraserLineDraft?.tool === 'eraser-line' && liveEraserLineDraft.points.length >= 2) {
    return liveEraserLineDraft
  }
  return null
}

/** Eraser-line must replay committed slices (dead-index preview); pen/marker/eraser draft only. */
export function strokeToolSkipsCommittedReplayOnLivePaint(tool: StrokeTool | undefined): boolean {
  return tool != null && tool !== 'eraser-line'
}

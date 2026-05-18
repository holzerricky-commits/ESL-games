import type { StrokeTool } from '@/lib/books/annotation-command-types'
import type { BookAnnotationInteractionMode } from '@/lib/books/annotation-storage'

/** Stroke tool implied by the current toolbar mode, or null for non-stroke tools. */
export function strokeToolForToolbarMode(
  mode: BookAnnotationInteractionMode,
): StrokeTool | null {
  if (mode === 'pen' || mode === 'marker' || mode === 'eraser-line') return mode
  if (mode === 'eraser') return 'eraser'
  return null
}

export function strokeWidthScaleForStrokeTool(
  tool: StrokeTool,
  widths: {
    strokeWidthScale: number
    eraserLineStrokeWidthScale: number
    penStrokeWidthScale: number
  },
): number {
  if (tool === 'eraser-line') return widths.eraserLineStrokeWidthScale
  if (tool === 'pen') return widths.penStrokeWidthScale
  return widths.strokeWidthScale
}

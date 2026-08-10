import type { AnnotationStrokeThicknessStep } from '@/lib/books/annotation-storage'
import { ANNOTATION_STROKE_WIDTH_STEPS } from '@/lib/books/annotation-storage'

/** Must match `MARKER_LINE_WIDTH` in annotation-draw (22). */
export const MARKER_TOOL_PREVIEW_LINE_BASE_PX = 22

export function buildMarkerToolPreviewBarHeightPx(
  markerThicknessStep: AnnotationStrokeThicknessStep,
): number {
  const scale = ANNOTATION_STROKE_WIDTH_STEPS[markerThicknessStep]
  return MARKER_TOOL_PREVIEW_LINE_BASE_PX * scale
}

import type { AnnotationLineDashStyle, ShapeFillMode } from '@/lib/books/annotation-command-types'
import type { AnnotationStrokeThicknessStep } from '@/lib/books/annotation-storage'
import { ANNOTATION_FINE_INK_STROKE_WIDTH_STEPS } from '@/lib/books/annotation-storage'
import type { PenSwatch } from '@/lib/books/annotation-palettes'
import type {
  TwoPointShapeDraft,
  TwoPointShapeDraftKind,
  TwoPointShapePreviewOptions,
} from '@/lib/books/two-point-shape-preview'

export type ShapeToolPreviewKind = TwoPointShapeDraftKind

export type ShapeToolPreviewStyleInput = {
  shapeKind: ShapeToolPreviewKind
  shapeStrokeSwatch: PenSwatch
  shapeThicknessStep: AnnotationStrokeThicknessStep
  shapeLineDashStyle: AnnotationLineDashStyle
  shapeStrokeEnabled: boolean
  shapeFillMode: ShapeFillMode
  shapeFillColor: string
  shapeRoundedCorners?: boolean
}

const LINE_DRAFT: Pick<TwoPointShapeDraft, 'anchor' | 'current'> = {
  anchor: [0.18, 0.72],
  current: [0.82, 0.28],
}

const BOX_DRAFT: Pick<TwoPointShapeDraft, 'anchor' | 'current'> = {
  anchor: [0.22, 0.32],
  current: [0.78, 0.78],
}

export function buildShapeToolPreviewDraft(kind: ShapeToolPreviewKind): TwoPointShapeDraft {
  const pts = kind === 'line' || kind === 'arrow' ? LINE_DRAFT : BOX_DRAFT
  return { kind, ...pts }
}

export function buildShapeToolPreviewOptions(
  input: ShapeToolPreviewStyleInput,
): TwoPointShapePreviewOptions {
  return {
    shapeColor: input.shapeStrokeSwatch.color,
    shapeStrokeWidthScale: ANNOTATION_FINE_INK_STROKE_WIDTH_STEPS[input.shapeThicknessStep],
    shapeLineDashStyle: input.shapeLineDashStyle,
    shapeStrokeEnabled: input.shapeStrokeEnabled,
    shapeFillMode: input.shapeFillMode,
    shapeFillColor: input.shapeFillColor,
    shapeRoundedCorners: input.shapeRoundedCorners ?? true,
  }
}

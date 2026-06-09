import type {
  AnnotationCommand,
  AnnotationLineDashStyle,
  EllipseAnnotationCommand,
  LineAnnotationCommand,
  RectAnnotationCommand,
  StrokeAnnotationCommand,
  TriangleAnnotationCommand,
} from '@/lib/books/annotation-command-types'
import { shapeFillAlphaForMode } from '@/lib/books/annotation-command-types'
import type { HoldShapeDraft } from '@/lib/books/stroke-shape-recognition'
import { roundedCornersFieldForCommit } from '@/lib/books/shape-rounded-corners'
import type { ShapeCommitOptions } from '@/lib/books/spread-command-split'

const HOLD_SHAPE_COMMIT_EPS = 0.004

function newAnnotationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `ann_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`
}

function normalizeRect(a: [number, number], b: [number, number]) {
  const x0 = Math.min(a[0], b[0])
  const y0 = Math.min(a[1], b[1])
  const x1 = Math.max(a[0], b[0])
  const y1 = Math.max(a[1], b[1])
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) }
}

function inkFromStrokeDraft(draft: StrokeAnnotationCommand): {
  color: string
  widthScale: number
  lineDashStyle: AnnotationLineDashStyle
} {
  return {
    color: draft.color ?? '#111827',
    widthScale: draft.widthScale ?? 1,
    lineDashStyle: draft.lineDashStyle ?? 'solid',
  }
}

/** Build a committed vector shape from a hold-snap draft, using stroke ink color/width. */
export function buildHoldShapeCommand(
  hold: HoldShapeDraft,
  strokeDraft: StrokeAnnotationCommand,
  shapeOpts: ShapeCommitOptions,
): AnnotationCommand | null {
  const ink = inkFromStrokeDraft(strokeDraft)
  const id = newAnnotationId()

  if (hold.kind === 'line') {
    const dist = Math.hypot(hold.current[0] - hold.anchor[0], hold.current[1] - hold.anchor[1])
    if (dist < HOLD_SHAPE_COMMIT_EPS) return null
    return {
      kind: 'line',
      id,
      a: hold.anchor,
      b: hold.current,
      color: ink.color,
      widthScale: ink.widthScale,
      lineDashStyle: ink.lineDashStyle,
    } satisfies LineAnnotationCommand
  }

  const { x, y, w, h } = normalizeRect(hold.anchor, hold.current)
  if (w < HOLD_SHAPE_COMMIT_EPS || h < HOLD_SHAPE_COMMIT_EPS) return null

  let strokeOn = shapeOpts.shapeStrokeEnabled
  const fillAlpha = shapeFillAlphaForMode(shapeOpts.shapeFillMode)
  let fillOn = fillAlpha != null
  if (!strokeOn && !fillOn) strokeOn = true

  const base = {
    id,
    x,
    y,
    w,
    h,
    strokeColor: ink.color,
    strokeWidthScale: ink.widthScale,
    lineDashStyle: ink.lineDashStyle,
    strokeVisible: strokeOn,
    fillVisible: fillOn,
    ...(fillOn && fillAlpha != null
      ? { fillColor: shapeOpts.shapeFillColor, fillAlpha }
      : {}),
    ...roundedCornersFieldForCommit(shapeOpts.shapeRoundedCorners !== false),
  }

  if (hold.kind === 'rect') {
    return { kind: 'rect', ...base } satisfies RectAnnotationCommand
  }
  if (hold.kind === 'ellipse') {
    return { kind: 'ellipse', ...base } satisfies EllipseAnnotationCommand
  }
  return { kind: 'triangle', ...base } satisfies TriangleAnnotationCommand
}

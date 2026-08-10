import type {
  AnnotationLineDashStyle,
  ArrowAnnotationCommand,
  EllipseAnnotationCommand,
  LineAnnotationCommand,
  RectAnnotationCommand,
  ShapeFillMode,
  TriangleAnnotationCommand,
} from '@/lib/books/annotation-command-types'
import { ANNOTATION_MARKER_SWATCHES } from '@/lib/books/annotation-palettes'

export type ShapeSelectionCommand =
  | LineAnnotationCommand
  | ArrowAnnotationCommand
  | RectAnnotationCommand
  | EllipseAnnotationCommand
  | TriangleAnnotationCommand

export type FilledShapeCommand =
  | RectAnnotationCommand
  | EllipseAnnotationCommand
  | TriangleAnnotationCommand

const SHAPE_KINDS = new Set<ShapeSelectionCommand['kind']>([
  'line',
  'arrow',
  'rect',
  'ellipse',
  'triangle',
])

export function isShapeSelectionCommand(cmd: { kind: string }): cmd is ShapeSelectionCommand {
  return SHAPE_KINDS.has(cmd.kind as ShapeSelectionCommand['kind'])
}

export function isFilledShapeCommand(cmd: ShapeSelectionCommand): cmd is FilledShapeCommand {
  return cmd.kind === 'rect' || cmd.kind === 'ellipse' || cmd.kind === 'triangle'
}

export function shapeStrokeColorHex(cmd: ShapeSelectionCommand): string {
  if (cmd.kind === 'line' || cmd.kind === 'arrow') return cmd.color
  return cmd.strokeColor
}

export function shapeWidthScale(cmd: ShapeSelectionCommand): number {
  if (cmd.kind === 'line' || cmd.kind === 'arrow') return cmd.widthScale ?? 1
  return cmd.strokeWidthScale ?? 1
}

export function shapeLineDashStyle(cmd: ShapeSelectionCommand): AnnotationLineDashStyle {
  return cmd.lineDashStyle ?? 'solid'
}

export function shapeFillModeForFilled(cmd: FilledShapeCommand): ShapeFillMode {
  if (!cmd.fillVisible) return 'none'
  return (cmd.fillAlpha ?? 1) < 1 ? 'transparent' : 'solid'
}

export function shapeFillColorForFilled(cmd: FilledShapeCommand): string {
  return cmd.fillColor ?? ANNOTATION_MARKER_SWATCHES[0]
}

export function shapeStrokeEnabledForFilled(cmd: FilledShapeCommand): boolean {
  return cmd.strokeVisible !== false
}

export function shapeIsLocked(cmd: ShapeSelectionCommand): boolean {
  return cmd.locked === true
}

import type {
  AnnotationLineDashStyle,
  StrokeAnnotationCommand,
} from '@/lib/books/annotation-command-types'
import { isPenOrMarkerStroke } from '@/lib/books/annotation-connected-strokes'

export type InkStrokeCommand = StrokeAnnotationCommand & { tool: 'pen' | 'marker' }

export { isPenOrMarkerStroke as isInkStrokeCommand }

export function inkStrokeColor(cmd: InkStrokeCommand): string {
  return cmd.color ?? '#111827'
}

export function inkStrokeWidthScale(cmd: InkStrokeCommand): number {
  return cmd.widthScale ?? 1
}

export function inkStrokeLineDash(cmd: InkStrokeCommand): AnnotationLineDashStyle {
  return cmd.lineDashStyle ?? 'solid'
}

export function inkStrokeIsPen(cmd: InkStrokeCommand): boolean {
  return cmd.tool === 'pen'
}

export function inkStrokeIsMarker(cmd: InkStrokeCommand): boolean {
  return cmd.tool === 'marker'
}

export function inkStrokeHasEffectPen(cmd: InkStrokeCommand): boolean {
  return cmd.tool === 'pen' && cmd.penInkStyle != null && cmd.penInkStyle !== 'solid'
}

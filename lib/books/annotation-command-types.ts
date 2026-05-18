import type { PenInkStyle } from '@/lib/books/pen-ink'

/** Legacy stroke tools (polyline on canvas). */
export type StrokeTool = 'pen' | 'marker' | 'eraser' | 'eraser-line'

/** Pen, marker, and vector shape outlines. */
export type AnnotationLineDashStyle = 'solid' | 'dashed' | 'dotted'

/** Rectangle / ellipse / triangle fill while drawing. */
export type ShapeFillMode = 'none' | 'transparent' | 'solid'

export const SHAPE_FILL_ALPHA_TRANSPARENT = 0.42
export const SHAPE_FILL_ALPHA_SOLID = 1

export function shapeFillModeHasFill(mode: ShapeFillMode): boolean {
  return mode !== 'none'
}

export function shapeFillAlphaForMode(mode: ShapeFillMode): number | undefined {
  if (mode === 'none') return undefined
  if (mode === 'solid') return SHAPE_FILL_ALPHA_SOLID
  return SHAPE_FILL_ALPHA_TRANSPARENT
}

export type StampVariant = 'check' | 'cross' | 'question' | 'star' | 'heart'

export interface StrokeAnnotationCommand {
  kind: 'stroke'
  id: string
  tool: StrokeTool
  points: [number, number][]
  widthScale?: number
  color?: string
  /** Pen effect ink (rainbow, galaxy, metallics, etc.); omit for solid/marker. */
  penInkStyle?: PenInkStyle
  /** Per-stroke pattern shift (px); retracing the same path gets different colors. */
  penInkPatternPhaseX?: number
  penInkPatternPhaseY?: number
  /** Pen/marker only; default solid. */
  lineDashStyle?: AnnotationLineDashStyle
}

export interface LineAnnotationCommand {
  kind: 'line'
  id: string
  a: [number, number]
  b: [number, number]
  color: string
  widthScale?: number
  lineDashStyle?: AnnotationLineDashStyle
}

export interface RectAnnotationCommand {
  kind: 'rect'
  id: string
  x: number
  y: number
  w: number
  h: number
  strokeColor: string
  strokeWidthScale?: number
  fillColor?: string
  fillAlpha?: number
  /** Outline dash style. */
  lineDashStyle?: AnnotationLineDashStyle
  /** Default true. If false, outline is not drawn (fill must be shown). */
  strokeVisible?: boolean
  /** Default: legacy = fill when fillColor+fillAlpha present. If false, skip fill even if colors set. */
  fillVisible?: boolean
}

export interface EllipseAnnotationCommand {
  kind: 'ellipse'
  id: string
  x: number
  y: number
  w: number
  h: number
  strokeColor: string
  strokeWidthScale?: number
  fillColor?: string
  fillAlpha?: number
  lineDashStyle?: AnnotationLineDashStyle
  strokeVisible?: boolean
  fillVisible?: boolean
}

export interface TriangleAnnotationCommand {
  kind: 'triangle'
  id: string
  x: number
  y: number
  w: number
  h: number
  strokeColor: string
  strokeWidthScale?: number
  fillColor?: string
  fillAlpha?: number
  lineDashStyle?: AnnotationLineDashStyle
  strokeVisible?: boolean
  fillVisible?: boolean
}

export interface ArrowAnnotationCommand {
  kind: 'arrow'
  id: string
  from: [number, number]
  to: [number, number]
  color: string
  widthScale?: number
  headLengthNorm?: number
  /** Dashed/dotted applies to the shaft; arrowhead stays solid. */
  lineDashStyle?: AnnotationLineDashStyle
}

export interface StampAnnotationCommand {
  kind: 'stamp'
  id: string
  variant: StampVariant
  center: [number, number]
  /** Symbol color (#RRGGBB). Question stamps use the picked color; others use fixed palette colors. */
  color: string
  scale?: number
}

export interface CalloutAnnotationCommand {
  kind: 'callout'
  id: string
  index: number
  center: [number, number]
  color: string
  scale?: number
}

/** `plain` = text only (no box). `filled` = solid background, no border or shadow. */
export type TextAnnotationVisualStyle = 'plain' | 'filled'

export interface TextAnnotationCommand {
  kind: 'text'
  id: string
  x: number
  y: number
  text: string
  fontSizeNorm: number
  color: string
  maxWidthNorm?: number
  visualStyle?: TextAnnotationVisualStyle
  /** Background when `visualStyle` is `filled` (#RRGGBB). */
  fillColor?: string
}

export interface StickyAnnotationCommand {
  kind: 'sticky'
  id: string
  x: number
  y: number
  w: number
  h: number
  text: string
  fontSizeNorm: number
  /** Note background (#RRGGBB). */
  fillColor?: string
}

export type AnnotationCommand =
  | StrokeAnnotationCommand
  | LineAnnotationCommand
  | RectAnnotationCommand
  | EllipseAnnotationCommand
  | TriangleAnnotationCommand
  | ArrowAnnotationCommand
  | StampAnnotationCommand
  | CalloutAnnotationCommand
  | TextAnnotationCommand
  | StickyAnnotationCommand

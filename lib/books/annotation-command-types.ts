/** Legacy stroke tools (polyline on canvas). */
export type StrokeTool = 'pen' | 'marker' | 'eraser' | 'eraser-line'

export type StampVariant = 'check' | 'cross' | 'question' | 'star'

export interface StrokeAnnotationCommand {
  kind: 'stroke'
  id: string
  tool: StrokeTool
  points: [number, number][]
  widthScale?: number
  color?: string
}

export interface LineAnnotationCommand {
  kind: 'line'
  id: string
  a: [number, number]
  b: [number, number]
  color: string
  widthScale?: number
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
}

export interface ArrowAnnotationCommand {
  kind: 'arrow'
  id: string
  from: [number, number]
  to: [number, number]
  color: string
  widthScale?: number
  headLengthNorm?: number
}

export interface StampAnnotationCommand {
  kind: 'stamp'
  id: string
  variant: StampVariant
  center: [number, number]
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

export interface TextAnnotationCommand {
  kind: 'text'
  id: string
  x: number
  y: number
  text: string
  fontSizeNorm: number
  color: string
  maxWidthNorm?: number
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
}

export type AnnotationCommand =
  | StrokeAnnotationCommand
  | LineAnnotationCommand
  | RectAnnotationCommand
  | EllipseAnnotationCommand
  | ArrowAnnotationCommand
  | StampAnnotationCommand
  | CalloutAnnotationCommand
  | TextAnnotationCommand
  | StickyAnnotationCommand

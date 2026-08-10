import type { AnnotationTextFontId } from '@/lib/books/annotation-text-fonts'
import type { PenInkStyle } from '@/lib/books/pen-ink'
import type { PenStrokeProfile } from '@/lib/books/pen-stroke-profile'

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

export type StampVariant =
  | 'check'
  | 'cross'
  | 'question'
  | 'star'
  | 'heart'

export type WritableStickerVariant = 'note' | 'caption' | 'speech' | 'thought'

export interface StrokeAnnotationCommand {
  kind: 'stroke'
  id: string
  tool: StrokeTool
  points: [number, number][]
  widthScale?: number
  color?: string
  /** Pen effect ink (rainbow, galaxy, metallics, etc.); omit for solid/marker. */
  penInkStyle?: PenInkStyle
  /** Pen / brush / effects; legacy strokes may still store pencil / fine-liner. */
  penStrokeProfile?: PenStrokeProfile
  /** Per-stroke pattern shift (px); retracing the same path gets different colors. */
  penInkPatternPhaseX?: number
  penInkPatternPhaseY?: number
  /** Pen/marker only; default solid. */
  lineDashStyle?: AnnotationLineDashStyle
  /** Marker only: themed upper-edge ornaments were enabled when this stroke was drawn. */
  markerDecoratedEdge?: boolean
  /** Explicit figure group; pen only (highlighter never groups). Omitted = ungrouped. */
  figureGroupId?: string
  /** Pen only: wall-clock ms when the stroke was committed (auto-group idle window). */
  committedAtMs?: number
  /** Pen only: when true, new pen strokes will not auto-join this figure group. */
  figureAutoJoinClosed?: boolean
  /**
   * Unrotated selection/draw frame (set on first rotate). Points stay in place;
   * `rotationDeg` spins ink and the selection box around this box center.
   */
  rotationBounds?: { x: number; y: number; w: number; h: number }
  /** Clockwise degrees around `rotationBounds` center. Pen/marker only. */
  rotationDeg?: number
}

export interface LineAnnotationCommand {
  kind: 'line'
  id: string
  a: [number, number]
  b: [number, number]
  color: string
  widthScale?: number
  lineDashStyle?: AnnotationLineDashStyle
  /** When true, move / scale / rotate are blocked. */
  locked?: boolean
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
  /** Clockwise rotation in degrees around the box center. */
  rotationDeg?: number
  /** Default on; explicit false draws sharp 90° corners. */
  roundedCorners?: boolean
  /** When true, move / scale / rotate are blocked. */
  locked?: boolean
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
  rotationDeg?: number
  roundedCorners?: boolean
  /** When true, move / scale / rotate are blocked. */
  locked?: boolean
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
  rotationDeg?: number
  roundedCorners?: boolean
  /** When true, move / scale / rotate are blocked. */
  locked?: boolean
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
  /** When true, move / scale / rotate are blocked. */
  locked?: boolean
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

/** Vertical placement of `y`: top edge of box (legacy) or vertical center of text block. */
export type TextAnnotationYAnchor = 'top' | 'center'

/** In-box horizontal alignment for ink inside the label field. */
export type TextAnnotationAlign = 'left' | 'center' | 'right'

/** Pinned translation on a substring of label or sticky text (spread session ink). */
export interface TextGlossAnchor {
  id: string
  start: number
  end: number
  source: string
  chinese: string
  pinyin: string
}

export interface TextAnnotationCommand {
  kind: 'text'
  id: string
  /** Normalized left edge of the label box (page coordinates). */
  x: number
  y: number
  /** When `center`, `y` is the vertical midpoint; `top` = first line stays fixed as lines grow. */
  yAnchor?: TextAnnotationYAnchor
  /** Left, center, or right alignment of text inside the box; does not move the box. */
  textAlign?: TextAnnotationAlign
  text: string
  fontSizeNorm: number
  /** Handwriting font preset; omitted on legacy annotations. */
  fontId?: AnnotationTextFontId
  color: string
  maxWidthNorm?: number
  visualStyle?: TextAnnotationVisualStyle
  /** Background when `visualStyle` is `filled` (#RRGGBB). */
  fillColor?: string
  /** Hover-review translations pinned on substrings of `text`. */
  glosses?: TextGlossAnchor[]
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
  /** Handwriting font preset; omitted on legacy annotations. */
  fontId?: AnnotationTextFontId
  /** Note background (#RRGGBB). */
  fillColor?: string
  /** Writable sticker shape; legacy stickies default to `note`. */
  writableVariant?: WritableStickerVariant
  /** Hover-review translations pinned on substrings of `text`. */
  glosses?: TextGlossAnchor[]
}

export interface ImageAnnotationCommand {
  kind: 'image'
  id: string
  x: number
  y: number
  w: number
  h: number
  /** Data URL (`data:image/...;base64,...`). */
  src: string
  alt?: string
  /** Clockwise rotation in degrees around the box center. */
  rotationDeg?: number
  /** Border color (#RRGGBB). */
  strokeColor?: string
  strokeWidthScale?: number
  /** When false, border is not drawn even if strokeColor is set. */
  strokeVisible?: boolean
  /** When true, move / scale / rotate are blocked. */
  locked?: boolean
}

/** Vocabulary flashcard: image + English + Chinese in one DOM block. */
export interface FlashcardAnnotationCommand {
  kind: 'flashcard'
  id: string
  x: number
  y: number
  w: number
  h: number
  /** Data URL for the picture area. */
  src: string
  english: string
  chinese: string
  alt?: string
  /** When true, move is blocked (resize / rotate deferred for v1). */
  locked?: boolean
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
  | ImageAnnotationCommand
  | FlashcardAnnotationCommand

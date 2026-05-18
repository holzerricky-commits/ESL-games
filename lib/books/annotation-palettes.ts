import type { PenInkStyle } from '@/lib/books/pen-ink'
import type { StampVariant } from '@/lib/books/annotation-command-types'

export type PenSwatch = {
  id: string
  label: string
  /** Primary hex (solid ink, storage fallback). Text/shape tools use this as flat stroke color. */
  color: string
  /**
   * Pattern id stored on pen strokes as `penInkStyle` (`solid` or manifest/procedural id).
   * For PNG brushes, add `public/brush-patterns/{id}.png` + a manifest row — no code change needed.
   */
  patternId: PenInkStyle
}

/** 16 pen colors: 8 solids + 8 effect inks (4–4 grid). */
export const ANNOTATION_PEN_SWATCHES: readonly PenSwatch[] = [
  { id: 'solid-black', label: 'Black', color: '#1e1b18', patternId: 'solid' },
  { id: 'solid-brown', label: 'Brown', color: '#7c2d12', patternId: 'solid' },
  { id: 'solid-orange', label: 'Orange', color: '#c2410c', patternId: 'solid' },
  { id: 'solid-gold', label: 'Gold yellow', color: '#a16207', patternId: 'solid' },
  { id: 'solid-green', label: 'Green', color: '#15803d', patternId: 'solid' },
  { id: 'solid-teal', label: 'Teal', color: '#0f766e', patternId: 'solid' },
  { id: 'solid-blue', label: 'Blue', color: '#1d4ed8', patternId: 'solid' },
  { id: 'solid-violet', label: 'Violet', color: '#6d28d9', patternId: 'solid' },
  { id: 'fx-rainbow', label: 'Rainbow', color: '#dc2626', patternId: 'rainbow' },
  { id: 'fx-galaxy', label: 'Galaxy', color: '#6366f1', patternId: 'galaxy' },
  { id: 'fx-lava', label: 'Lava', color: '#ea580c', patternId: 'lava' },
  { id: 'fx-ocean', label: 'Ocean', color: '#0d9488', patternId: 'ocean' },
  { id: 'fx-rose-gold', label: 'Rose gold', color: '#e8b4a0', patternId: 'rose-gold' },
  { id: 'fx-gold', label: 'Gold', color: '#fbbf24', patternId: 'gold' },
  { id: 'fx-silver', label: 'Silver', color: '#cbd5e1', patternId: 'silver' },
  { id: 'fx-bronze', label: 'Bronze', color: '#d97706', patternId: 'bronze' },
] as const

export const DEFAULT_PEN_SWATCH_ID = ANNOTATION_PEN_SWATCHES[0].id
export const DEFAULT_SHAPE_STROKE_SWATCH_ID = DEFAULT_PEN_SWATCH_ID

/** Text stroke colors — solids only (no effect inks). */
export const ANNOTATION_TEXT_STROKE_SWATCHES = ANNOTATION_PEN_SWATCHES.filter(
  (s) => s.patternId === 'solid',
).map((s) => s.color) as readonly string[]

export const DEFAULT_TEXT_COLOR = ANNOTATION_TEXT_STROKE_SWATCHES[0]

/** Sticky note background fills (pastel). */
export const ANNOTATION_STICKY_FILL_SWATCHES = [
  '#fef3c7',
  '#fef9c3',
  '#ffedd5',
  '#fce7f3',
  '#e0e7ff',
  '#cffafe',
  '#d1fae5',
  '#fef08a',
] as const

export const DEFAULT_STICKY_FILL_COLOR = ANNOTATION_STICKY_FILL_SWATCHES[0]

const TEXT_STROKE_COLOR_SET = new Set(
  ANNOTATION_TEXT_STROKE_SWATCHES.map((c) => c.toLowerCase()),
)
const STICKY_FILL_COLOR_SET = new Set(ANNOTATION_STICKY_FILL_SWATCHES.map((c) => c.toLowerCase()))

export function isValidTextStrokeColor(color: unknown): color is string {
  return typeof color === 'string' && TEXT_STROKE_COLOR_SET.has(color.toLowerCase())
}

export function isValidStickyFillColor(color: unknown): color is string {
  return typeof color === 'string' && STICKY_FILL_COLOR_SET.has(color.toLowerCase())
}

/** Background + border for sticky note DOM from fill hex. */
export function stickyNoteChrome(fillHex: string): { backgroundColor: string; borderColor: string } {
  const r = parseInt(fillHex.slice(1, 3), 16)
  const g = parseInt(fillHex.slice(3, 5), 16)
  const b = parseInt(fillHex.slice(5, 7), 16)
  return {
    backgroundColor: `rgba(${r},${g},${b},0.95)`,
    borderColor: `rgba(${Math.round(r * 0.45)},${Math.round(g * 0.45)},${Math.round(b * 0.45)},0.32)`,
  }
}

const penSwatchById = new Map(ANNOTATION_PEN_SWATCHES.map((s) => [s.id, s]))

export function getPenSwatch(id: string): PenSwatch {
  return penSwatchById.get(id) ?? ANNOTATION_PEN_SWATCHES[0]
}

/** `penInkStyle` value for a palette swatch (alias for `patternId`). */
export function getPenSwatchPatternId(swatch: PenSwatch): PenInkStyle {
  return swatch.patternId
}

/** Match legacy stored hex to a swatch when `penInkStyle` is missing. */
export function getPenSwatchIdForColor(hex: string): string {
  const norm = hex.toLowerCase()
  const exact = ANNOTATION_PEN_SWATCHES.find((s) => s.color.toLowerCase() === norm)
  if (exact) return exact.id
  return DEFAULT_PEN_SWATCH_ID
}

/** Highlighter marker fills (hex); drawn with transparency on canvas. */
export const ANNOTATION_MARKER_SWATCHES = [
  '#facc15',
  '#fb923c',
  '#f87171',
  '#f472b6',
  '#c084fc',
  '#818cf8',
  '#38bdf8',
  '#34d399',
  '#bef264',
  '#fcd34d',
] as const

/** Fixed stamp symbol colors (check, cross, star, heart). */
export const STAMP_COLOR_CHECK = '#16a34a'
export const STAMP_COLOR_CROSS = '#dc2626'
export const STAMP_COLOR_STAR = '#eab308'
export const STAMP_COLOR_HEART = '#dc2626'
export const DEFAULT_STAMP_QUESTION_COLOR = '#1d4ed8'

export function stampColorForVariant(variant: StampVariant, questionColor: string): string {
  if (variant === 'check') return STAMP_COLOR_CHECK
  if (variant === 'cross') return STAMP_COLOR_CROSS
  if (variant === 'star') return STAMP_COLOR_STAR
  if (variant === 'heart') return STAMP_COLOR_HEART
  return questionColor
}

/** Swatches for the question-mark stamp (user picks color). */
export const ANNOTATION_STAMP_QUESTION_SWATCHES = ANNOTATION_TEXT_STROKE_SWATCHES

/** Light fills for text “with background” mode (no border). */
export const ANNOTATION_TEXT_FILL_SWATCHES = [
  '#fef9c3',
  '#ffedd5',
  '#fce7f3',
  '#e0e7ff',
  '#cffafe',
  '#d1fae5',
  '#fef08a',
  '#e5e5e5',
] as const

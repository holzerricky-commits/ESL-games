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

/**
 * Solid pen / text stroke colors — one balanced “classroom” family (≈500 weight).
 * Vivid on cream textbook pages without neon highlighter glare.
 */
export const ANNOTATION_PEN_SWATCHES: readonly PenSwatch[] = [
  { id: 'solid-black', label: 'Black', color: '#1e293b', patternId: 'solid' },
  { id: 'solid-gray', label: 'Gray', color: '#64748b', patternId: 'solid' },
  { id: 'solid-blue', label: 'Blue', color: '#3b82f6', patternId: 'solid' },
  { id: 'solid-red', label: 'Red', color: '#ef4444', patternId: 'solid' },
  { id: 'solid-green', label: 'Green', color: '#22c55e', patternId: 'solid' },
  { id: 'solid-yellow', label: 'Yellow', color: '#facc15', patternId: 'solid' },
  { id: 'solid-lime', label: 'Lime', color: '#84cc16', patternId: 'solid' },
  { id: 'solid-orange', label: 'Orange', color: '#f97316', patternId: 'solid' },
  { id: 'solid-pink', label: 'Pink', color: '#ec4899', patternId: 'solid' },
  { id: 'solid-purple', label: 'Purple', color: '#8b5cf6', patternId: 'solid' },
  { id: 'solid-cyan', label: 'Cyan', color: '#06b6d4', patternId: 'solid' },
  { id: 'solid-brown', label: 'Brown', color: '#b45309', patternId: 'solid' },
  { id: 'solid-white', label: 'White', color: '#ffffff', patternId: 'solid' },
  { id: 'fx-rainbow', label: 'Rainbow', color: '#dc2626', patternId: 'rainbow' },
  { id: 'fx-galaxy', label: 'Galaxy', color: '#818cf8', patternId: 'galaxy' },
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

/** Retired stroke hex → current classroom palette. */
export const LEGACY_TEXT_STROKE_COLOR_MAP: Readonly<Record<string, string>> = {
  '#171717': '#1e293b',
  '#6b7280': '#64748b',
  '#2563eb': '#3b82f6',
  '#dc2626': '#ef4444',
  '#16a34a': '#22c55e',
  '#ffeb3b': '#facc15',
  '#eab308': '#facc15',
  '#ca8a04': '#facc15',
  '#fde047': '#facc15',
  '#65a30d': '#84cc16',
  '#ea580c': '#f97316',
  '#db2777': '#ec4899',
  '#7c3aed': '#8b5cf6',
  '#0891b2': '#06b6d4',
  '#78350f': '#b45309',
}
const STICKY_FILL_COLOR_SET = new Set(ANNOTATION_STICKY_FILL_SWATCHES.map((c) => c.toLowerCase()))

export function migrateTextStrokeColor(hex: string): string {
  const norm = hex.toLowerCase()
  if (TEXT_STROKE_COLOR_SET.has(norm)) return hex
  const legacy = LEGACY_TEXT_STROKE_COLOR_MAP[norm]
  if (legacy) return legacy
  return DEFAULT_TEXT_COLOR
}

export function isValidTextStrokeColor(color: unknown): color is string {
  if (typeof color !== 'string') return false
  const norm = color.toLowerCase()
  return TEXT_STROKE_COLOR_SET.has(norm) || norm in LEGACY_TEXT_STROKE_COLOR_MAP
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

/** Retired solid swatch ids → nearest replacement (localStorage / recents migration). */
export const LEGACY_PEN_SWATCH_ID_MAP: Readonly<Record<string, string>> = {
  'solid-gold': 'solid-yellow',
  'solid-teal': 'solid-cyan',
  'solid-violet': 'solid-purple',
}

const penSwatchById = new Map(ANNOTATION_PEN_SWATCHES.map((s) => [s.id, s]))

export function migratePenSwatchId(id: string): string {
  const mapped = LEGACY_PEN_SWATCH_ID_MAP[id]
  if (mapped) return mapped
  return penSwatchById.has(id) ? id : DEFAULT_PEN_SWATCH_ID
}

export function isKnownPenSwatchId(id: string): boolean {
  return penSwatchById.has(id) || id in LEGACY_PEN_SWATCH_ID_MAP
}

export function getPenSwatch(id: string): PenSwatch {
  return penSwatchById.get(migratePenSwatchId(id)) ?? ANNOTATION_PEN_SWATCHES[0]
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

/** Highlighter fills — vivid hues for multiply blend over textbook pages. */
export const ANNOTATION_MARKER_SWATCHES = [
  '#ffeb3b',
  '#ff9800',
  '#ff5252',
  '#ff4081',
  '#e040fb',
  '#448aff',
  '#00e5ff',
  '#69f0ae',
  '#c6ff00',
  '#ffd740',
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

/**
 * Text label backgrounds — same hue family as strokes (≈200 weight), softer than ink.
 * Independent picks: any stroke + any box (e.g. red text on yellow).
 */
export const ANNOTATION_TEXT_FILL_SWATCHES = [
  '#fef08a', // yellow
  '#bfdbfe', // blue
  '#fecaca', // red
  '#bbf7d0', // green
  '#d9f99d', // lime
  '#fed7aa', // orange
  '#fbcfe8', // pink
  '#ddd6fe', // purple
  '#a5f3fc', // cyan
  '#fde68a', // amber
  '#e2e8f0', // gray
  '#ffffff', // white
] as const

export const DEFAULT_TEXT_FILL_COLOR = ANNOTATION_TEXT_FILL_SWATCHES[0]

/** @deprecated Migration only — do not auto-apply when picking text color. */
export const TEXT_FILL_BY_STROKE: Readonly<Record<string, string>> = {
  '#1e293b': '#fef08a',
  '#64748b': '#e2e8f0',
  '#3b82f6': '#bfdbfe',
  '#ef4444': '#fecaca',
  '#22c55e': '#bbf7d0',
  '#facc15': '#fef08a',
  '#84cc16': '#d9f99d',
  '#f97316': '#fed7aa',
  '#ec4899': '#fbcfe8',
  '#8b5cf6': '#ddd6fe',
  '#06b6d4': '#a5f3fc',
  '#b45309': '#fde68a',
  '#ffffff': '#ffffff',
}

/** Retired text fills → current background palette. */
export const LEGACY_TEXT_FILL_COLOR_MAP: Readonly<Record<string, string>> = {
  '#faf6ef': '#fef08a',
  '#fef9c3': '#fef08a',
  '#fef3c7': '#fef08a',
  '#fde047': '#fef08a',
  '#fcd34d': '#fde68a',
  '#dbeafe': '#bfdbfe',
  '#93c5fd': '#bfdbfe',
  '#fee2e2': '#fecaca',
  '#fca5a5': '#fecaca',
  '#dcfce7': '#bbf7d0',
  '#86efac': '#bbf7d0',
  '#bef264': '#d9f99d',
  '#ffedd5': '#fed7aa',
  '#fdba74': '#fed7aa',
  '#fce7f3': '#fbcfe8',
  '#f9a8d4': '#fbcfe8',
  '#ede9fe': '#ddd6fe',
  '#c4b5fd': '#ddd6fe',
  '#cffafe': '#a5f3fc',
  '#67e8f9': '#a5f3fc',
  '#f3f4f6': '#e2e8f0',
  '#d6d3d1': '#e2e8f0',
  '#d1fae5': '#bbf7d0',
  '#e0e7ff': '#bfdbfe',
  '#e5e5e5': '#e2e8f0',
  '#cbd5e1': '#e2e8f0',
}

const TEXT_FILL_COLOR_SET = new Set(
  ANNOTATION_TEXT_FILL_SWATCHES.map((c) => c.toLowerCase()),
)

export function migrateTextFillColor(hex: string): string {
  const norm = hex.toLowerCase()
  if (TEXT_FILL_COLOR_SET.has(norm)) return hex
  const legacy = LEGACY_TEXT_FILL_COLOR_MAP[norm]
  if (legacy) return legacy
  const paired = TEXT_FILL_BY_STROKE[norm]
  if (paired) return paired
  return DEFAULT_TEXT_FILL_COLOR
}

export function suggestedTextFillForStroke(strokeHex: string): string {
  return TEXT_FILL_BY_STROKE[strokeHex.toLowerCase()] ?? DEFAULT_TEXT_FILL_COLOR
}

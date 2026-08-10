import {
  ANNOTATION_STICKY_FILL_SWATCHES,
  ANNOTATION_TEXT_FILL_SWATCHES,
  migrateTextFillColor,
} from '@/lib/books/annotation-palettes'

/** Book page / reader slot background — plain labels sit on this surface. */
export const TEXT_GLOSS_PAGE_SURFACE = '#FDFCFB'

export type TextGlossChrome = {
  backgroundColor: string
  color: string
  hoverBackgroundColor: string
  /** Optional inset ring for chips on near-white surfaces (not a transparent fill). */
  boxShadow?: string
}

type GlossPair = Pick<TextGlossChrome, 'backgroundColor' | 'color' | 'boxShadow'>

const WHITE_CHIP: GlossPair = { backgroundColor: '#ffffff', color: '#92400e' }
const YELLOW_CHIP: GlossPair = { backgroundColor: '#fef08a', color: '#92400e' }
const LIGHT_CHIP_ON_DARK: GlossPair = { backgroundColor: '#f8fafc', color: '#1e293b' }

/** Hue-matched dark ink on white chips — keyed by normalized surface hex. */
const GLOSS_PAIR_BY_SURFACE: Readonly<Record<string, GlossPair>> = {
  // Text label fills
  '#fef08a': { backgroundColor: '#ffffff', color: '#92400e' },
  '#bfdbfe': { backgroundColor: '#ffffff', color: '#1e40af' },
  '#fecaca': { backgroundColor: '#ffffff', color: '#991b1b' },
  '#bbf7d0': { backgroundColor: '#ffffff', color: '#166534' },
  '#d9f99d': { backgroundColor: '#ffffff', color: '#3f6212' },
  '#fed7aa': { backgroundColor: '#ffffff', color: '#9a3412' },
  '#fbcfe8': { backgroundColor: '#ffffff', color: '#9d174d' },
  '#ddd6fe': { backgroundColor: '#ffffff', color: '#5b21b6' },
  '#a5f3fc': { backgroundColor: '#ffffff', color: '#0e7490' },
  '#fde68a': { backgroundColor: '#ffffff', color: '#92400e' },
  '#e2e8f0': { backgroundColor: '#ffffff', color: '#334155' },
  '#ffffff': YELLOW_CHIP,

  // Sticky fills
  '#fef3c7': { backgroundColor: '#ffffff', color: '#92400e' },
  '#fef9c3': { backgroundColor: '#ffffff', color: '#854d0e' },
  '#ffedd5': { backgroundColor: '#ffffff', color: '#9a3412' },
  '#fce7f3': { backgroundColor: '#ffffff', color: '#9d174d' },
  '#e0e7ff': { backgroundColor: '#ffffff', color: '#3730a3' },
  '#cffafe': { backgroundColor: '#ffffff', color: '#0e7490' },
  '#d1fae5': { backgroundColor: '#ffffff', color: '#047857' },

  // Special surfaces
  [TEXT_GLOSS_PAGE_SURFACE.toLowerCase()]: {
    ...WHITE_CHIP,
    boxShadow: 'inset 0 0 0 1px rgba(15, 23, 42, 0.10)',
  },
  '#1e293b': LIGHT_CHIP_ON_DARK,
}

function normalizeHex(hex: string): string {
  const trimmed = hex.trim()
  if (!/^#[0-9A-Fa-f]{6}$/.test(trimmed)) return trimmed.toLowerCase()
  return trimmed.toLowerCase()
}

function hexLuminance(hex: string): number | null {
  const norm = normalizeHex(hex)
  if (!/^#[0-9a-f]{6}$/.test(norm)) return null
  const r = parseInt(norm.slice(1, 3), 16)
  const g = parseInt(norm.slice(3, 5), 16)
  const b = parseInt(norm.slice(5, 7), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

function darkenHex(hex: string, factor = 0.08): string {
  const norm = normalizeHex(hex)
  if (!/^#[0-9a-f]{6}$/.test(norm)) return hex
  const r = parseInt(norm.slice(1, 3), 16)
  const g = parseInt(norm.slice(3, 5), 16)
  const b = parseInt(norm.slice(5, 7), 16)
  const scale = 1 - factor
  const dr = Math.max(0, Math.round(r * scale))
  const dg = Math.max(0, Math.round(g * scale))
  const db = Math.max(0, Math.round(b * scale))
  return `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`
}

function fallbackPair(surfaceBg: string): GlossPair {
  const migrated = migrateTextFillColor(surfaceBg)
  const norm = normalizeHex(migrated)
  const curated = GLOSS_PAIR_BY_SURFACE[norm]
  if (curated) return curated

  const lum = hexLuminance(norm)
  if (lum != null && lum < 0.45) return LIGHT_CHIP_ON_DARK
  if (norm === '#ffffff') return YELLOW_CHIP
  return WHITE_CHIP
}

export function resolveTextGlossChrome(surfaceBg: string): TextGlossChrome {
  const norm = normalizeHex(surfaceBg)
  const pair = GLOSS_PAIR_BY_SURFACE[norm] ?? fallbackPair(surfaceBg)
  return {
    backgroundColor: pair.backgroundColor,
    color: pair.color,
    hoverBackgroundColor: darkenHex(pair.backgroundColor),
    ...(pair.boxShadow ? { boxShadow: pair.boxShadow } : {}),
  }
}

/** Surfaces covered by the curated map (for tests). */
export const CURATED_GLOSS_SURFACES = [
  ...ANNOTATION_TEXT_FILL_SWATCHES,
  ...ANNOTATION_STICKY_FILL_SWATCHES,
  TEXT_GLOSS_PAGE_SURFACE,
  '#1e293b',
] as const

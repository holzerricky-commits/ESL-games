import { isValidCustomHex, normalizeCustomHex } from '@/lib/books/annotation-custom-color'
import { hexToHsl, type Hsl } from '@/lib/books/hsl-color'

/** WCAG AA — readable pen strokes on page backgrounds. */
const MIN_CONTRAST_RATIO = 4.5
const BG_LIGHT_L_THRESHOLD = 0.55
const BG_DARK_L_THRESHOLD = 0.38
const NEUTRAL_SATURATION = 0.12

/** Teaching palette: vivid, positive solids (no brown / muddy rose). */
const INK_NEUTRAL_LIGHT = ['#1d4ed8', '#c2410c', '#15803d', '#6d28d9'] as const
/** Dark warm accents for pastel cool pages (red-orange before orange-brown). */
const INK_WARM_ON_COOL = ['#991b1b', '#9a3412', '#c2410c', '#dc2626'] as const
const INK_COOL_ON_WARM = ['#1d4ed8', '#0f766e', '#6d28d9'] as const
const INK_ON_GREEN = ['#c2410c', '#6d28d9', '#1d4ed8'] as const
const INK_ON_PURPLE = ['#fbbf24', '#0f766e', '#1d4ed8'] as const
const INK_ON_DARK = ['#fbbf24', '#faf8f5', '#a16207'] as const

const INK_RESCUE = [
  '#1d4ed8',
  '#991b1b',
  '#9a3412',
  '#c2410c',
  '#15803d',
  '#0f766e',
  '#6d28d9',
  '#dc2626',
  '#fbbf24',
  '#faf8f5',
  '#1e1b18',
] as const

const INK_RESCUE_COOL = ['#991b1b', '#9a3412', '#c2410c', '#dc2626', '#1d4ed8', '#15803d'] as const

const FALLBACK_DARK_INK = '#1d4ed8'
const FALLBACK_LIGHT_INK = '#fbbf24'

const BROWN_HUE_MIN = 18
const BROWN_HUE_MAX = 42

function parseRgb(hex: string): [number, number, number] | null {
  if (!isValidCustomHex(hex)) return null
  const h = normalizeCustomHex(hex)
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
}

function channelLuminance(channel: number): number {
  const v = channel / 255
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

function relativeLuminanceFromHex(hex: string): number {
  const rgb = parseRgb(hex)
  if (!rgb) return 0
  const [r, g, b] = rgb.map(channelLuminance)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(fgHex: string, bgHex: string): number {
  const l1 = relativeLuminanceFromHex(fgHex)
  const l2 = relativeLuminanceFromHex(bgHex)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

type BgFamily =
  | 'neutral-light'
  | 'neutral-dark'
  | 'cool'
  | 'warm'
  | 'green'
  | 'purple'
  | 'dark'

function normalizeHue(h: number): number {
  return ((h % 360) + 360) % 360
}

function classifyBackground(bg: Hsl): BgFamily {
  if (bg.l < BG_DARK_L_THRESHOLD) {
    return bg.s < NEUTRAL_SATURATION ? 'neutral-dark' : 'dark'
  }
  if (bg.s < NEUTRAL_SATURATION) {
    return bg.l >= BG_LIGHT_L_THRESHOLD ? 'neutral-light' : 'neutral-dark'
  }

  const h = normalizeHue(bg.h)
  if (h >= 70 && h < 155) return 'green'
  if (h >= 155 && h < 250) return 'cool'
  if (h >= 250 && h < 330) return 'purple'
  return 'warm'
}

function candidatesForFamily(family: BgFamily): readonly string[] {
  switch (family) {
    case 'neutral-light':
      return INK_NEUTRAL_LIGHT
    case 'neutral-dark':
    case 'dark':
      return INK_ON_DARK
    case 'cool':
      return INK_WARM_ON_COOL
    case 'warm':
      return INK_COOL_ON_WARM
    case 'green':
      return INK_ON_GREEN
    case 'purple':
      return INK_ON_PURPLE
    default:
      return INK_NEUTRAL_LIGHT
  }
}

function pickBestFromPalette(
  candidates: readonly string[],
  bgHex: string,
  preferLight: boolean,
  rescuePool: readonly string[] = INK_RESCUE,
): string {
  for (const hex of candidates) {
    if (contrastRatio(hex, bgHex) >= MIN_CONTRAST_RATIO) return hex
  }

  let best: string | null = null
  let bestCr = MIN_CONTRAST_RATIO
  for (const hex of rescuePool) {
    const cr = contrastRatio(hex, bgHex)
    if (cr >= bestCr) {
      bestCr = cr
      best = hex
    }
  }

  if (best) return best
  return preferLight ? FALLBACK_LIGHT_INK : FALLBACK_DARK_INK
}

function isBrownishInk(hex: string): boolean {
  const hsl = hexToHsl(hex)
  if (!hsl) return false
  const h = normalizeHue(hsl.h)
  return hsl.s > 0.35 && hsl.l < 0.45 && h >= BROWN_HUE_MIN && h <= BROWN_HUE_MAX
}

/**
 * Kid-friendly pen ink for a sampled background: palette picks with teaching-oriented
 * warm/cool pairs (no auto brown or pink-on-navy complements).
 */
export function deriveSmartInkFromBackground(bgHex: string): string {
  const normBg = normalizeCustomHex(bgHex)
  const bg = hexToHsl(normBg)
  if (!bg) return FALLBACK_DARK_INK

  const family = classifyBackground(bg)
  const preferLight = bg.l < BG_LIGHT_L_THRESHOLD
  const candidates = candidatesForFamily(family)
  const rescuePool = family === 'cool' ? INK_RESCUE_COOL : INK_RESCUE
  let ink = pickBestFromPalette(candidates, normBg, preferLight, rescuePool)

  if (isBrownishInk(ink)) {
    const alt = candidates.find((c) => c !== ink && contrastRatio(c, normBg) >= MIN_CONTRAST_RATIO)
    if (alt) ink = alt
  }

  return ink
}

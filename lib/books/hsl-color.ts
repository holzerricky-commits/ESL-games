import { isValidCustomHex, normalizeCustomHex } from '@/lib/books/annotation-custom-color'

export type Hsl = { h: number; s: number; l: number }

export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

export function rgbToHsl(r: number, g: number, b: number): Hsl {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const d = max - min
  let h = 0
  const l = (max + min) / 2
  if (d !== 0) {
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
    else if (max === gn) h = ((bn - rn) / d + 2) / 6
    else h = ((rn - gn) / d + 4) / 6
    return { h: h * 360, s, l }
  }
  return { h: 0, s: 0, l }
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hn = ((h % 360) + 360) % 360
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (hn < 60) [r, g, b] = [c, x, 0]
  else if (hn < 120) [r, g, b] = [x, c, 0]
  else if (hn < 180) [r, g, b] = [0, c, x]
  else if (hn < 240) [r, g, b] = [0, x, c]
  else if (hn < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ]
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)))
  return `#${[clamp(r), clamp(g), clamp(b)].map((n) => n.toString(16).padStart(2, '0')).join('')}`
}

function parseHexRgb(hex: string): [number, number, number] | null {
  if (!isValidCustomHex(hex)) return null
  const h = normalizeCustomHex(hex)
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
}

export function hexToHsl(hex: string): Hsl | null {
  const rgb = parseHexRgb(hex)
  if (!rgb) return null
  return rgbToHsl(rgb[0], rgb[1], rgb[2])
}

export function hslToHex(hsl: Hsl): string {
  const [r, g, b] = hslToRgb(hsl.h, clamp01(hsl.s), clamp01(hsl.l))
  return normalizeCustomHex(rgbToHex(r, g, b))
}

/** CSS background for the saturation/lightness field at a fixed hue. */
export function slFieldBackground(hue: number): string {
  const hn = Math.round(((hue % 360) + 360) % 360)
  return `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hn}, 100%, 50%))`
}

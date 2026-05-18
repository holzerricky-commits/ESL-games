/** Toolbar color source: preset swatch vs arbitrary hex (solid ink only). */
export type AnnotationColorSource = 'swatch' | 'custom'

const HEX6 = /^#[0-9A-Fa-f]{6}$/

export function isValidCustomHex(color: unknown): color is string {
  return typeof color === 'string' && HEX6.test(color)
}

export function normalizeCustomHex(color: string): string {
  return color.toLowerCase()
}

export function isAnnotationColorSource(v: unknown): v is AnnotationColorSource {
  return v === 'swatch' || v === 'custom'
}

/** Parse #RGB, #RRGGBB, or RRGGBB from a text field; returns null if invalid. */
export function parseCustomHexInput(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  const withHash = t.startsWith('#') ? t : `#${t}`
  if (!HEX6.test(withHash)) return null
  return normalizeCustomHex(withHash)
}

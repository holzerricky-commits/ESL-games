import manifestJson from '@/public/brush-patterns/manifest.json'

export type BrushPatternEntry = {
  id: string
  label: string
  file: string
  fallbackColor: string
}

export type BrushPatternManifest = {
  version: number
  tileSizePx: number
  patterns: BrushPatternEntry[]
}

export const BRUSH_PATTERNS_PUBLIC_BASE = '/brush-patterns'

export const BRUSH_PATTERN_MANIFEST = manifestJson as BrushPatternManifest

const patternById = new Map(BRUSH_PATTERN_MANIFEST.patterns.map((p) => [p.id, p]))

/** Pattern ids backed by PNG tiles in `public/brush-patterns/` (from manifest). */
export const ASSET_BRUSH_PATTERN_IDS = new Set(BRUSH_PATTERN_MANIFEST.patterns.map((p) => p.id))

/** Ids listed in `manifest.json` (runtime list; grows when you add PNGs). */
export function listManifestBrushPatternIds(): readonly string[] {
  return BRUSH_PATTERN_MANIFEST.patterns.map((p) => p.id)
}

export function getBrushPattern(id: string): BrushPatternEntry | undefined {
  return patternById.get(id)
}

export function getBrushPatternUrl(id: string): string | undefined {
  const entry = getBrushPattern(id)
  if (!entry) return undefined
  return `${BRUSH_PATTERNS_PUBLIC_BASE}/${entry.file}`
}

export function getBrushPatternFallbackColor(id: string): string | undefined {
  return getBrushPattern(id)?.fallbackColor
}

export function isAssetBrushPattern(id: string): boolean {
  return ASSET_BRUSH_PATTERN_IDS.has(id)
}

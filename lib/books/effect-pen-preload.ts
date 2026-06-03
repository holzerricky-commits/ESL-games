import { preloadAllManifestBrushPatterns, preloadBrushPatterns } from '@/lib/books/brush-pattern-loader'
import { isAssetBrushPattern } from '@/lib/books/brush-pattern-manifest'
import { isEffectPenInkStyle, type PenInkStyle, warmProceduralPenInkTiles } from '@/lib/books/pen-ink'
import { filterPenSwatchesForProfile } from '@/lib/books/pen-stroke-profile'

/** Start loading one effect ink PNG tile (no-op for solid / procedural-only ids). */
export function preloadPenInkStyle(ink: PenInkStyle | undefined): void {
  if (!ink || ink === 'solid') return
  if (isAssetBrushPattern(ink)) {
    preloadBrushPatterns([ink])
  }
}

/** All effect-profile swatch pattern ids from the palette. */
export function effectPenAssetPatternIds(): string[] {
  return filterPenSwatchesForProfile('effects')
    .map((s) => s.patternId)
    .filter((id): id is string => id !== 'solid' && isAssetBrushPattern(id))
}

export function preloadEffectPenProfileSwatches(): void {
  preloadBrushPatterns(effectPenAssetPatternIds())
}

/** Fullscreen book open: manifest PNGs + procedural warm + effect swatches. */
export function preloadAllEffectPenResources(): void {
  preloadAllManifestBrushPatterns()
  warmProceduralPenInkTiles()
  preloadEffectPenProfileSwatches()
}

/** Preload tiles for the active effect ink (e.g. after swatch change). */
export function preloadActiveEffectPenInk(ink: PenInkStyle | undefined): void {
  if (!isEffectPenInkStyle(ink)) return
  preloadPenInkStyle(ink)
}

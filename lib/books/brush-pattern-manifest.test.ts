import { describe, expect, it } from 'vitest'
import {
  BRUSH_PATTERN_MANIFEST,
  getBrushPattern,
  getBrushPatternFallbackColor,
  getBrushPatternUrl,
  isAssetBrushPattern,
  listManifestBrushPatternIds,
} from '@/lib/books/brush-pattern-manifest'
import { isPenInkStyle } from '@/lib/books/pen-ink'

describe('brush-pattern-manifest', () => {
  it('loads rainbow and galaxy entries', () => {
    expect(BRUSH_PATTERN_MANIFEST.version).toBe(4)
    expect(BRUSH_PATTERN_MANIFEST.tileSizePx).toBe(512)
    expect(getBrushPattern('rainbow')?.file).toBe('rainbow.png')
    expect(getBrushPattern('galaxy')?.file).toBe('galaxy.png')
  })

  it('lists manifest pattern ids', () => {
    expect(listManifestBrushPatternIds()).toEqual([
      'rainbow',
      'galaxy',
      'lava',
      'ocean',
      'rose-gold',
      'gold',
      'silver',
      'bronze',
    ])
  })

  it('builds public URLs', () => {
    expect(getBrushPatternUrl('rainbow')).toBe('/brush-patterns/rainbow.png')
    expect(getBrushPatternUrl('galaxy')).toBe('/brush-patterns/galaxy.png')
  })

  it('exposes fallback colors for asset patterns', () => {
    expect(getBrushPatternFallbackColor('rainbow')).toBe('#dc2626')
    expect(getBrushPatternFallbackColor('lava')).toBe('#ea580c')
  })

  it('marks only manifest ids as asset patterns', () => {
    expect(isAssetBrushPattern('rainbow')).toBe(true)
    expect(isAssetBrushPattern('lava')).toBe(true)
  })

  it('manifest ids validate as pen ink styles', () => {
    for (const id of listManifestBrushPatternIds()) {
      expect(isPenInkStyle(id)).toBe(true)
    }
  })
})

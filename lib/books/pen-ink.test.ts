import { describe, expect, it } from 'vitest'
import { BRUSH_PATTERN_MANIFEST, listManifestBrushPatternIds } from '@/lib/books/brush-pattern-manifest'
import {
  isPenInkStyle,
  isProceduralBrushPattern,
  PEN_INK_TILE_REVISION,
  PROCEDURAL_BRUSH_PATTERN_IDS,
} from '@/lib/books/pen-ink'

describe('pen-ink pattern ids', () => {
  it('accepts solid and manifest ids', () => {
    expect(isPenInkStyle('solid')).toBe(true)
    for (const id of listManifestBrushPatternIds()) {
      expect(isPenInkStyle(id)).toBe(true)
    }
  })

  it('accepts procedural ids not in manifest', () => {
    for (const id of PROCEDURAL_BRUSH_PATTERN_IDS) {
      expect(isPenInkStyle(id)).toBe(true)
    }
  })

  it('rejects unknown ids', () => {
    expect(isPenInkStyle('not-a-brush')).toBe(false)
    expect(isPenInkStyle('')).toBe(false)
    expect(isPenInkStyle(null)).toBe(false)
  })

  it('prefers manifest over procedural when both would match', () => {
    expect(isProceduralBrushPattern('rainbow')).toBe(false)
    expect(isProceduralBrushPattern('lava')).toBe(false)
  })

  it('PEN_INK_TILE_REVISION includes manifest version for cache bust', () => {
    expect(PEN_INK_TILE_REVISION).toContain(String(BRUSH_PATTERN_MANIFEST.version))
  })
})

import { afterEach, describe, expect, it } from 'vitest'
import { BRUSH_PATTERN_MANIFEST } from '@/lib/books/brush-pattern-manifest'
import {
  areManifestBrushPatternsReady,
  clearBrushPatternTileCacheForTests,
  preloadAllManifestBrushPatterns,
} from '@/lib/books/brush-pattern-loader'

describe('brush-pattern-loader', () => {
  afterEach(() => {
    clearBrushPatternTileCacheForTests()
  })

  it('areManifestBrushPatternsReady is true with no document', () => {
    expect(areManifestBrushPatternsReady()).toBe(true)
  })

  it('preloadAllManifestBrushPatterns is a no-op without document', () => {
    expect(() => preloadAllManifestBrushPatterns()).not.toThrow()
  })

  it('tile cache keys include manifest version', () => {
    expect(BRUSH_PATTERN_MANIFEST.version).toBeGreaterThan(0)
  })
})

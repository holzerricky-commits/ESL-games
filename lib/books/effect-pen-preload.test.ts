import { describe, expect, it } from 'vitest'
import { effectPenAssetPatternIds, preloadPenInkStyle } from '@/lib/books/effect-pen-preload'

describe('effect-pen-preload', () => {
  it('effectPenAssetPatternIds lists manifest effect patterns', () => {
    const ids = effectPenAssetPatternIds()
    expect(ids).toContain('rainbow')
    expect(ids).toContain('galaxy')
    expect(ids.length).toBeGreaterThanOrEqual(2)
  })

  it('preloadPenInkStyle is safe without document', () => {
    expect(() => preloadPenInkStyle('rainbow')).not.toThrow()
    expect(() => preloadPenInkStyle('solid')).not.toThrow()
  })
})

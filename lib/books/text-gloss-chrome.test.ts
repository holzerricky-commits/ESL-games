import { describe, expect, it } from 'vitest'
import {
  ANNOTATION_STICKY_FILL_SWATCHES,
  ANNOTATION_TEXT_FILL_SWATCHES,
} from '@/lib/books/annotation-palettes'
import {
  CURATED_GLOSS_SURFACES,
  TEXT_GLOSS_PAGE_SURFACE,
  resolveTextGlossChrome,
} from '@/lib/books/text-gloss-chrome'

function isOpaqueHex(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color)
}

function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

describe('text-gloss-chrome', () => {
  it('returns opaque hex colors for every text and sticky fill swatch', () => {
    for (const surface of [
      ...ANNOTATION_TEXT_FILL_SWATCHES,
      ...ANNOTATION_STICKY_FILL_SWATCHES,
    ]) {
      const chrome = resolveTextGlossChrome(surface)
      expect(isOpaqueHex(chrome.backgroundColor)).toBe(true)
      expect(isOpaqueHex(chrome.color)).toBe(true)
      expect(isOpaqueHex(chrome.hoverBackgroundColor)).toBe(true)
    }
  })

  it('covers all curated surfaces including page and dark caption', () => {
    expect(CURATED_GLOSS_SURFACES).toContain(TEXT_GLOSS_PAGE_SURFACE)
    expect(CURATED_GLOSS_SURFACES).toContain('#1e293b')
    for (const surface of CURATED_GLOSS_SURFACES) {
      expect(resolveTextGlossChrome(surface).backgroundColor).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })

  it('uses a non-white chip on white filled labels', () => {
    const chrome = resolveTextGlossChrome('#ffffff')
    expect(chrome.backgroundColor.toLowerCase()).not.toBe('#ffffff')
    expect(chrome.color).toBe('#92400e')
  })

  it('uses a light chip on dark caption surfaces', () => {
    const chrome = resolveTextGlossChrome('#1e293b')
    expect(chrome.backgroundColor.toLowerCase()).toBe('#f8fafc')
    expect(chrome.color.toLowerCase()).toBe('#1e293b')
  })

  it('uses a white chip with edge ring on cream page surface', () => {
    const chrome = resolveTextGlossChrome(TEXT_GLOSS_PAGE_SURFACE)
    expect(chrome.backgroundColor.toLowerCase()).toBe('#ffffff')
    expect(chrome.boxShadow).toBeDefined()
  })

  it('darkens hover background relative to base chip', () => {
    for (const surface of CURATED_GLOSS_SURFACES) {
      const chrome = resolveTextGlossChrome(surface)
      expect(luminance(chrome.hoverBackgroundColor)).toBeLessThanOrEqual(
        luminance(chrome.backgroundColor) + 0.001,
      )
    }
  })

  it('hue-matches ink for blue and green fills', () => {
    expect(resolveTextGlossChrome('#bfdbfe').color.toLowerCase()).toBe('#1e40af')
    expect(resolveTextGlossChrome('#bbf7d0').color.toLowerCase()).toBe('#166534')
  })

  it('accepts legacy migrated fill hex without throwing', () => {
    const chrome = resolveTextGlossChrome('#dbeafe')
    expect(isOpaqueHex(chrome.backgroundColor)).toBe(true)
    expect(isOpaqueHex(chrome.color)).toBe(true)
  })
})

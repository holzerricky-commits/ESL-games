import { describe, expect, it } from 'vitest'
import {
  coercePenSwatchIdForProfile,
  filterPenSwatchesForProfile,
  PEN_STROKE_PROFILE_LABEL,
  penProfileUsesEffectInk,
  penProfileWidthScaleMultiplier,
  resolvePenInkStyleForProfile,
} from '@/lib/books/pen-stroke-profile'
import { getPenSwatch, migratePenSwatchId } from '@/lib/books/annotation-palettes'

describe('pen-stroke-profile', () => {
  it('filters swatches by profile', () => {
    expect(filterPenSwatchesForProfile('pen').every((s) => s.patternId === 'solid')).toBe(true)
    expect(filterPenSwatchesForProfile('effects').every((s) => s.patternId !== 'solid')).toBe(true)
  })

  it('applies width multipliers', () => {
    expect(penProfileWidthScaleMultiplier('fine-liner')).toBeLessThan(0.5)
    expect(penProfileWidthScaleMultiplier('brush')).toBeGreaterThan(1)
  })

  it('labels legacy pen profiles kept in saved strokes', () => {
    expect(PEN_STROKE_PROFILE_LABEL.pencil).toBe('Pencil')
    expect(PEN_STROKE_PROFILE_LABEL['fine-liner']).toBe('Fine liner')
  })

  it('resolves effect ink only in effects profile', () => {
    const fx = getPenSwatch('fx-rainbow')
    expect(resolvePenInkStyleForProfile('effects', fx, 'swatch')).toBe('rainbow')
    expect(resolvePenInkStyleForProfile('pen', fx, 'swatch')).toBe('solid')
    expect(penProfileUsesEffectInk('effects')).toBe(true)
  })

  it('coerces invalid swatch for profile', () => {
    expect(coercePenSwatchIdForProfile('fx-rainbow', 'pen')).toBe('solid-black')
    expect(coercePenSwatchIdForProfile('solid-black', 'effects')).toBe('fx-rainbow')
  })

  it('migrates legacy pen swatch ids', () => {
    expect(migratePenSwatchId('solid-brown')).toBe('solid-brown')
    expect(coercePenSwatchIdForProfile('solid-brown', 'pen')).toBe('solid-brown')
    expect(migratePenSwatchId('solid-gold')).toBe('solid-yellow')
    expect(coercePenSwatchIdForProfile('solid-violet', 'pen')).toBe('solid-purple')
  })
})

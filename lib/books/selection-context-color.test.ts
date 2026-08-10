import { describe, expect, it } from 'vitest'
import {
  penSwatchIdToStrokeColor,
  shapeStrokeColorToSwatchId,
} from '@/lib/books/selection-context-color'
import { ANNOTATION_PEN_SWATCHES, DEFAULT_PEN_SWATCH_ID } from '@/lib/books/annotation-palettes'

describe('shapeStrokeColorToSwatchId', () => {
  it('returns default when color is missing', () => {
    expect(shapeStrokeColorToSwatchId(null)).toBe(DEFAULT_PEN_SWATCH_ID)
    expect(shapeStrokeColorToSwatchId(undefined)).toBe(DEFAULT_PEN_SWATCH_ID)
  })

  it('maps exact palette hex to swatch id', () => {
    const swatch = ANNOTATION_PEN_SWATCHES[2]!
    expect(shapeStrokeColorToSwatchId(swatch.color)).toBe(swatch.id)
  })

  it('is case-insensitive for known colors', () => {
    const swatch = ANNOTATION_PEN_SWATCHES[1]!
    expect(shapeStrokeColorToSwatchId(swatch.color.toUpperCase())).toBe(swatch.id)
  })

  it('falls back to default for unknown hex', () => {
    expect(shapeStrokeColorToSwatchId('#abcdef')).toBe(DEFAULT_PEN_SWATCH_ID)
  })
})

describe('penSwatchIdToStrokeColor', () => {
  it('returns swatch color for id', () => {
    const swatch = ANNOTATION_PEN_SWATCHES[0]!
    expect(penSwatchIdToStrokeColor(swatch.id)).toBe(swatch.color)
  })
})

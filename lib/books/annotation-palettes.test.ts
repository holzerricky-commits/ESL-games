import { describe, expect, it } from 'vitest'
import {
  ANNOTATION_NEUTRAL_SWATCHES,
  ANNOTATION_PEN_SWATCHES,
  ANNOTATION_SHAPE_FILL_SWATCHES,
  ANNOTATION_STICKY_FILL_SWATCHES,
  ANNOTATION_TEXT_FILL_SWATCHES,
  DEFAULT_TEXT_FILL_COLOR,
  migrateMarkerColor,
  migrateTextFillColor,
  TEXT_FILL_BY_STROKE,
} from '@/lib/books/annotation-palettes'

describe('annotation-palettes text fills', () => {
  it('defaults filled text to white on dark ink', () => {
    expect(DEFAULT_TEXT_FILL_COLOR).toBe('#ffffff')
    expect(TEXT_FILL_BY_STROKE['#1e293b']).toBe('#ffffff')
  })

  it('uses balanced yellow and matching stroke family', () => {
    const solids = ANNOTATION_PEN_SWATCHES.filter((s) => s.patternId === 'solid').map((s) => s.color)
    expect(solids).toContain('#facc15')
    expect(solids).toContain('#b45309')
    expect(TEXT_FILL_BY_STROKE['#facc15']).toBe('#fef08a')
  })

  it('migrates retired stroke and fill hex to classroom palette', () => {
    expect(migrateTextFillColor('#fef9c3')).toBe('#fef08a')
    expect(migrateTextFillColor('#93c5fd')).toBe('#bfdbfe')
    expect(migrateTextFillColor('#ffeb3b')).toBe('#fef08a')
    expect(migrateTextFillColor('#e2e8f0')).toBe('#cbd5e1')
  })

  it('keeps translate chip charcoal fill (not a classroom swatch)', () => {
    expect(migrateTextFillColor('#2a2a2e')).toBe('#2a2a2e')
    expect(migrateTextFillColor('#2A2A2E')).toBe('#2A2A2E')
  })

  it('migrates retired highlighter yellow to fluorescent default', () => {
    expect(migrateMarkerColor('#fff59d')).toBe('#ffff00')
    expect(migrateMarkerColor('#ffeb3b')).toBe('#ffff00')
    expect(migrateMarkerColor('#ffff00')).toBe('#ffff00')
  })
})

describe('annotation-palettes neutrals', () => {
  it('includes white and black in shape fill and sticky palettes', () => {
    expect(ANNOTATION_SHAPE_FILL_SWATCHES).toContain('#ffffff')
    expect(ANNOTATION_SHAPE_FILL_SWATCHES).toContain('#1e293b')
    for (const neutral of ANNOTATION_NEUTRAL_SWATCHES) {
      expect(ANNOTATION_STICKY_FILL_SWATCHES).toContain(neutral)
      expect(ANNOTATION_TEXT_FILL_SWATCHES).toContain(neutral)
    }
  })
})

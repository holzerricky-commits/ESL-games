import { describe, expect, it } from 'vitest'
import {
  ANNOTATION_PEN_SWATCHES,
  migrateMarkerColor,
  migrateTextFillColor,
  TEXT_FILL_BY_STROKE,
} from '@/lib/books/annotation-palettes'

describe('annotation-palettes text fills', () => {
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
  })

  it('migrates retired highlighter yellow to fluorescent default', () => {
    expect(migrateMarkerColor('#fff59d')).toBe('#ffff00')
    expect(migrateMarkerColor('#ffeb3b')).toBe('#ffff00')
    expect(migrateMarkerColor('#ffff00')).toBe('#ffff00')
  })
})

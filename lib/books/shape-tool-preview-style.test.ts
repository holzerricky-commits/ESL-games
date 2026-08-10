import { describe, expect, it } from 'vitest'
import { getPenSwatch } from '@/lib/books/annotation-palettes'
import {
  buildShapeToolPreviewDraft,
  buildShapeToolPreviewOptions,
} from '@/lib/books/shape-tool-preview-style'

describe('buildShapeToolPreviewDraft', () => {
  it('uses diagonal points for line and arrow', () => {
    const line = buildShapeToolPreviewDraft('line')
    const arrow = buildShapeToolPreviewDraft('arrow')
    expect(line.anchor).toEqual(arrow.anchor)
    expect(line.current).toEqual(arrow.current)
    expect(line.kind).toBe('line')
    expect(arrow.kind).toBe('arrow')
  })

  it('uses box points for filled shapes', () => {
    const rect = buildShapeToolPreviewDraft('rect')
    expect(rect.kind).toBe('rect')
    expect(rect.anchor[0]).toBeLessThan(rect.current[0])
  })
})

describe('buildShapeToolPreviewOptions', () => {
  it('maps swatch color and thickness step', () => {
    const swatch = getPenSwatch('black')
    const opts = buildShapeToolPreviewOptions({
      shapeKind: 'rect',
      shapeStrokeSwatch: swatch,
      shapeThicknessStep: 3,
      shapeLineDashStyle: 'solid',
      shapeStrokeEnabled: true,
      shapeFillMode: 'transparent',
      shapeFillColor: '#eab308',
      shapeRoundedCorners: true,
    })
    expect(opts.shapeColor).toBe(swatch.color)
    expect(opts.shapeFillColor).toBe('#eab308')
    expect(opts.shapeStrokeWidthScale).toBeGreaterThan(0)
  })
})

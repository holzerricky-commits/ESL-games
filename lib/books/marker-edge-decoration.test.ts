import { describe, expect, it } from 'vitest'
import {
  markerEdgeDecorationForColor,
  upperEdgeNormal,
} from '@/lib/books/marker-edge-decoration'

describe('markerEdgeDecorationForColor', () => {
  it('maps palette highlighter colors to silhouette styles', () => {
    expect(markerEdgeDecorationForColor('#ff9800')).toBe('flame')
    expect(markerEdgeDecorationForColor('#448aff')).toBe('wave')
    expect(markerEdgeDecorationForColor('#69f0ae')).toBe('mountain')
    expect(markerEdgeDecorationForColor('#ff4081')).toBe('scallop')
  })

  it('falls back to default for unknown custom hex', () => {
    expect(markerEdgeDecorationForColor('#aabbcc')).toBe('default')
  })
})

describe('upperEdgeNormal', () => {
  it('points upward for left-to-right strokes', () => {
    const n = upperEdgeNormal(1, 0)
    expect(n.ny).toBeLessThan(0)
  })

  it('points upward for right-to-left strokes', () => {
    const n = upperEdgeNormal(-1, 0)
    expect(n.ny).toBeLessThan(0)
  })
})

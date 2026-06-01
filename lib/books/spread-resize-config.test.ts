import { describe, expect, it } from 'vitest'
import { SPREAD_RESIZE_SCALE_EPSILON } from '@/lib/books/spread-resize-config'

describe('spread-resize-config', () => {
  it('uses a small epsilon for scale-vs-1 comparisons', () => {
    expect(SPREAD_RESIZE_SCALE_EPSILON).toBeGreaterThan(0)
    expect(SPREAD_RESIZE_SCALE_EPSILON).toBeLessThan(0.05)
  })
})

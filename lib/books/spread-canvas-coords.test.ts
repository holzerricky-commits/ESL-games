import { describe, expect, it } from 'vitest'
import { spreadClusterWidthPx } from '@/lib/books/spread-canvas-coords'

describe('spreadClusterWidthPx', () => {
  it('subtracts overlap once (two pages, one gutter pull)', () => {
    const pageW = 400
    const pull = Math.round(pageW * 0.018)
    expect(spreadClusterWidthPx(pageW, pull)).toBe(pageW * 2 - pull)
    expect(spreadClusterWidthPx(pageW, pull)).not.toBe(pageW * 2 - pull * 2)
  })
})

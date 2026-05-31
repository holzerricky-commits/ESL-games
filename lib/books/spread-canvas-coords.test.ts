import { describe, expect, it } from 'vitest'
import { spreadClusterWidthPx } from '@/lib/books/spread-canvas-coords'
import { DEFAULT_SPREAD_GUTTER_PULL_RATIO, spreadSidePullPx } from '@/lib/books/spread-gutter'

describe('spreadClusterWidthPx', () => {
  it('subtracts overlap once (two pages, one gutter pull)', () => {
    const pageW = 400
    const pull = spreadSidePullPx(pageW, DEFAULT_SPREAD_GUTTER_PULL_RATIO)
    expect(spreadClusterWidthPx(pageW, pull)).toBe(pageW * 2 - pull)
    expect(spreadClusterWidthPx(pageW, pull)).not.toBe(pageW * 2 - pull * 2)
  })
})

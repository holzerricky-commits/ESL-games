import { describe, expect, it } from 'vitest'
import { spreadSlideEnabled } from '@/lib/books/feature-flags'
import { resolveSpreadAnchorPages } from '@/lib/books/reader-spread-navigation'

describe('spread slide infrastructure', () => {
  it('keeps spread slide off for instant page turns during teaching', () => {
    expect(spreadSlideEnabled).toBe(false)
  })

  it('resolves outgoing spread pages for turn overlay snapshot', () => {
    const visiblePages = [1, 2, 3, 4, 5, 6]
    expect(resolveSpreadAnchorPages(3, visiblePages)).toEqual({ left: 3, right: 4 })
    expect(resolveSpreadAnchorPages(5, visiblePages)).toEqual({ left: 5, right: 6 })
  })
})

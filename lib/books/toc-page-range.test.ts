import { describe, expect, it } from 'vitest'
import { pageRangeForIndex } from '@/lib/books/toc-page-range'

describe('pageRangeForIndex', () => {
  it('infers end from next sibling start', () => {
    const items = [{ startPageHint: 10 }, { startPageHint: 20 }, { startPageHint: 30 }]
    expect(pageRangeForIndex(items, 0)).toEqual({ start: 10, end: 19 })
    expect(pageRangeForIndex(items, 1)).toEqual({ start: 20, end: 29 })
  })

  it('uses explicit end when set', () => {
    const items = [{ startPageHint: 5, endPageHint: 12 }]
    expect(pageRangeForIndex(items, 0)).toEqual({ start: 5, end: 12 })
  })
})

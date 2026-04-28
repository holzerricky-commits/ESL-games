import { describe, expect, it } from 'vitest'
import { buildPageAlignmentRuntime, mergeCoverIntoHiddenPages, resolveEffectiveAnchorToPdfPage } from '@/lib/books/page-alignment-runtime'

describe('mergeCoverIntoHiddenPages', () => {
  it('always includes page 1', () => {
    expect(mergeCoverIntoHiddenPages([])).toEqual([1])
    expect(mergeCoverIntoHiddenPages([3, 2])).toEqual([1, 2, 3])
    expect(mergeCoverIntoHiddenPages([1, 5])).toEqual([1, 5])
  })
})

describe('buildPageAlignmentRuntime', () => {
  it('excludes cover from visible spreads but keeps it as effective page 1 so the next page is 2', () => {
    const rt = buildPageAlignmentRuntime(5, [], [])
    expect(rt.visiblePdfPages).toEqual([2, 3, 4, 5])
    expect(rt.effectivePageByPdf.get(1)).toBe(1)
    expect(rt.effectivePageByPdf.get(2)).toBe(2)
    expect(resolveEffectiveAnchorToPdfPage(1, rt)).toBe(1)
    expect(resolveEffectiveAnchorToPdfPage(2, rt)).toBe(2)
  })

  it('still excludes additional hidden pages', () => {
    const rt = buildPageAlignmentRuntime(4, [2], [])
    expect(rt.visiblePdfPages).toEqual([3, 4])
    expect(rt.effectivePageByPdf.get(1)).toBe(1)
    expect(rt.effectivePageByPdf.get(3)).toBe(2)
  })
})

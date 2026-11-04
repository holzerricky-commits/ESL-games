import { describe, expect, it } from 'vitest'
import {
  buildPageAlignmentRuntime,
  estimatePdfTotalForEffectiveAnchor,
  mergeCoverIntoHiddenPages,
  resolveEffectiveAnchorToPdfPage,
} from '@/lib/books/page-alignment-runtime'

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

describe('estimatePdfTotalForEffectiveAnchor', () => {
  it('is large enough to resolve past ghost pages without a known PDF length', () => {
    const notCounted = [2, 3, 10, 11]
    const hidden = [1]
    const estimated = estimatePdfTotalForEffectiveAnchor(14, hidden, notCounted)
    const rt = buildPageAlignmentRuntime(estimated, hidden, notCounted)
    expect(resolveEffectiveAnchorToPdfPage(14, rt)).toBe(18)
  })
})

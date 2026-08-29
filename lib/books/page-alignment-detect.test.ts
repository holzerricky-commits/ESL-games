import { describe, expect, it } from 'vitest'
import {
  buildAlignmentCheckpoints,
  impliedFirstArabicPdfPage,
  inferNotCountedFromFolioSamples,
  listAlignDetectScanPages,
  notCountedForFirstArabicPdfPage,
  notCountedFromSyncPoint,
  pickPrintedFolioFromPageText,
} from '@/lib/books/page-alignment-detect'
import { pdfPageToPrintedPage, printedPageToPdfPage } from '@/lib/books/page-alignment'

describe('pickPrintedFolioFromPageText', () => {
  it('reads a footer-only number', () => {
    const text = `Once upon a time there was a fox.\n\nThe fox ran through the woods.\n\n14`
    expect(pickPrintedFolioFromPageText(text)).toBe(14)
  })

  it('skips TOC-like pages with many standalone numbers', () => {
    const text = `CONTENTS\n1\n2\n3\n4\n5\n6`
    expect(pickPrintedFolioFromPageText(text)).toBeNull()
  })

  it('prefers a single edge folio', () => {
    const text = `CHAPTER ONE\nA long paragraph about animals and habitats that fills the page.\n1`
    expect(pickPrintedFolioFromPageText(text)).toBe(1)
  })
})

describe('listAlignDetectScanPages', () => {
  it('includes early band and later stride', () => {
    const pages = listAlignDetectScanPages(80)
    expect(pages[0]).toBe(2)
    expect(pages).toContain(24)
    expect(pages).toContain(25)
    expect(pages).toContain(49)
    expect(pages.at(-1)).toBe(80)
    // Not every late page — stride 2 after early band
    expect(pages).not.toContain(26)
  })
})

describe('notCountedFromSyncPoint', () => {
  it('builds a small skip list from one sync pair', () => {
    const result = notCountedFromSyncPoint(18, 4, { totalPdfPages: 200 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.firstArabicPdfPage).toBe(15)
    expect(result.notCountedPdfPages).toEqual(notCountedForFirstArabicPdfPage(15))
    expect(result.pagesAlreadyMatch).toBe(false)
  })

  it('rejects the PDF-109 disaster size', () => {
    const result = notCountedFromSyncPoint(109, 1, { totalPdfPages: 200 })
    expect(result).toEqual({ ok: false, reason: 'too_large' })
  })

  it('allows pages that already match', () => {
    const result = notCountedFromSyncPoint(2, 1)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.pagesAlreadyMatch).toBe(true)
    expect(result.notCountedPdfPages).toEqual([])
  })
})

describe('inferNotCountedFromFolioSamples', () => {
  it('suggests empty not-counted when PDF 2 is printed 1', () => {
    const proposal = inferNotCountedFromFolioSamples([
      { pdfPage: 2, printedPage: 1 },
      { pdfPage: 5, printedPage: 4 },
      { pdfPage: 12, printedPage: 11 },
    ])
    expect(proposal.pagesAlreadyMatch).toBe(true)
    expect(proposal.notCountedPdfPages).toEqual([])
    expect(proposal.firstArabicPdfPage).toBe(2)
    expect(proposal.matchingSamples).toBe(3)
    expect(proposal.confidence).toBe('high')
    expect(proposal.consecutivePairs).toBeGreaterThanOrEqual(1)
  })

  it('ghosts front matter when printed 1 starts later', () => {
    const proposal = inferNotCountedFromFolioSamples(
      [
        { pdfPage: 14, printedPage: 1 },
        { pdfPage: 15, printedPage: 2 },
        { pdfPage: 20, printedPage: 7 },
      ],
      200,
    )
    expect(proposal.firstArabicPdfPage).toBe(14)
    expect(proposal.notCountedPdfPages).toEqual(notCountedForFirstArabicPdfPage(14))
    expect(proposal.notCountedPdfPages).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
    expect(proposal.matchingSamples).toBe(3)
    expect(printedPageToPdfPage(1, proposal.notCountedPdfPages, 200)).toBe(14)
    expect(pdfPageToPrintedPage(20, proposal.notCountedPdfPages)).toBe(7)
  })

  it('infers from later pages when first visible folio is printed 4', () => {
    const proposal = inferNotCountedFromFolioSamples(
      [
        { pdfPage: 18, printedPage: 4 },
        { pdfPage: 19, printedPage: 5 },
        { pdfPage: 24, printedPage: 10 },
      ],
      200,
    )
    expect(proposal.firstArabicPdfPage).toBe(15)
    expect(proposal.notCountedPdfPages).toEqual(notCountedForFirstArabicPdfPage(15))
    expect(proposal.matchingSamples).toBe(3)
    expect(proposal.firstObservedPrintedPage).toBe(4)
    expect(proposal.confidence === 'high' || proposal.confidence === 'medium').toBe(true)
    expect(printedPageToPdfPage(4, proposal.notCountedPdfPages, 200)).toBe(18)
    expect(printedPageToPdfPage(10, proposal.notCountedPdfPages, 200)).toBe(24)
  })

  it('prefers consistent later samples over a noisy early folio', () => {
    const proposal = inferNotCountedFromFolioSamples(
      [
        // Wrong early noise (e.g. chapter “1” on a front page)
        { pdfPage: 3, printedPage: 1 },
        { pdfPage: 18, printedPage: 4 },
        { pdfPage: 19, printedPage: 5 },
        { pdfPage: 24, printedPage: 10 },
      ],
      200,
    )
    expect(proposal.firstArabicPdfPage).toBe(15)
    expect(proposal.matchingSamples).toBe(3)
    expect(proposal.consecutivePairs).toBeGreaterThanOrEqual(1)
  })

  it('computes implied first Arabic page', () => {
    expect(impliedFirstArabicPdfPage({ pdfPage: 14, printedPage: 1 })).toBe(14)
    expect(impliedFirstArabicPdfPage({ pdfPage: 20, printedPage: 7 })).toBe(14)
    expect(impliedFirstArabicPdfPage({ pdfPage: 18, printedPage: 4 })).toBe(15)
  })
})

describe('buildAlignmentCheckpoints', () => {
  it('maps printed checkpoints through not-counted pages', () => {
    const notCounted = notCountedForFirstArabicPdfPage(14)
    const checkpoints = buildAlignmentCheckpoints({
      notCountedPdfPages: notCounted,
      totalPdfPages: 100,
      printedPageHints: [25],
    })
    expect(checkpoints.some((c) => c.printedPage === 4 && c.pdfPage === 17)).toBe(true)
    expect(checkpoints.some((c) => c.printedPage === 10 && c.pdfPage === 23)).toBe(true)
  })

  it('leads with first observed folio when numbering starts at 4', () => {
    const notCounted = notCountedForFirstArabicPdfPage(15)
    const checkpoints = buildAlignmentCheckpoints({
      notCountedPdfPages: notCounted,
      totalPdfPages: 100,
      observedPrintedPages: [4],
    })
    expect(checkpoints[0]).toMatchObject({ printedPage: 4, pdfPage: 18 })
    expect(checkpoints.some((c) => c.printedPage === 10)).toBe(true)
  })

  it('returns empty without total pages', () => {
    expect(
      buildAlignmentCheckpoints({
        notCountedPdfPages: [],
        totalPdfPages: null,
      }),
    ).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import { buildPageAlignmentRuntime } from '@/lib/books/page-alignment-runtime'
import {
  resolveStoryTitleThumbPdfPage,
  resolveUnitCoverThumbPdfPage,
} from '@/lib/books/story-thumb-pdf-page'
import type { BookRecord, BookUnitRecord } from '@/lib/books/types'

const unit: BookUnitRecord = {
  id: 'u1',
  title: 'Unit 1',
  filePath: 'u.pdf',
  startPageHint: 1,
}

const book: BookRecord = {
  id: 'b1',
  title: 'Test',
  pageAlignmentByFile: {
    'u.pdf': { notCountedPdfPages: [3], hiddenPdfPages: [] },
  },
  units: [unit],
}

describe('story-thumb-pdf-page', () => {
  it('maps unit cover printed hint through alignment', () => {
    // printed 3 skips ghost PDF 3 → PDF 4
    expect(resolveUnitCoverThumbPdfPage({ ...unit, startPageHint: 3 }, book, 50)).toBe(4)
  })

  it('story thumb is mapped title page (no +1)', () => {
    const lesson = { id: 'l1', title: 'Lesson', startPageHint: 10 }
    const part = { id: 'p1', title: 'Jump!', startPageHint: 10 }
    // printed 10 with ghost PDF 3 → PDF 11
    expect(
      resolveStoryTitleThumbPdfPage({
        book,
        unit,
        lesson,
        part,
        partRangeStart: 10,
        totalPdfPages: 50,
      }),
    ).toBe(11)
  })

  it('uses wizard alignmentRuntime when provided', () => {
    const runtime = buildPageAlignmentRuntime(50, [], [2, 3])
    const lesson = { id: 'l1', title: 'Lesson', startPageHint: 5 }
    const part = { id: 'p1', title: 'Story', startPageHint: 5 }
    // printed 5 with ghosts 2+3 → PDF 7
    expect(
      resolveStoryTitleThumbPdfPage({
        book: { ...book, pageAlignmentByFile: {} },
        unit,
        lesson,
        part,
        partRangeStart: 5,
        totalPdfPages: 50,
        alignmentRuntime: runtime,
      }),
    ).toBe(7)
  })

  it('without TOC anchors, uses the raw start as PDF page', () => {
    const lesson = { id: 'l1', title: 'Lesson' }
    const part = { id: 'p1', title: 'Story' }
    expect(
      resolveStoryTitleThumbPdfPage({
        book,
        unit,
        lesson,
        part,
        partRangeStart: 20,
        totalPdfPages: 50,
      }),
    ).toBe(20)
  })
})

import { describe, expect, it } from 'vitest'
import {
  buildUnitRangesFromToc,
  draftsToUnits,
} from '@/lib/books/toc-import'

describe('buildUnitRangesFromToc', () => {
  it('builds structure-first unit drafts', () => {
    const drafts = buildUnitRangesFromToc([
      { title: 'Unit One', printedPage: 10, needsReview: false, rawLine: 'Unit One 10' },
      { title: 'Unit Two', printedPage: 16, needsReview: true, rawLine: 'Unit Two 16' },
    ])
    expect(drafts).toHaveLength(2)
    expect(drafts[0]).toMatchObject({ title: 'Unit One', needsReview: false })
    expect(drafts[1]).toMatchObject({ title: 'Unit Two', needsReview: true })
  })
})

describe('draftsToUnits', () => {
  it('persists lessons and parts without page-range metadata', () => {
    const drafts = [
      {
        id: 'u1',
        title: 'Unit 1',
        needsReview: false,
      },
    ]
    const units = draftsToUnits('book.pdf', drafts, [
      [
        {
          id: 'l1',
          title: 'Lesson A',
          parts: [
            { id: 'p1', title: 'Part 1' },
          ],
        },
      ],
    ])
    expect(units[0]!.lessons?.[0]!.title).toBe('Lesson A')
    expect(units[0]!.lessons?.[0]!.parts?.[0]!.title).toBe('Part 1')
  })
})

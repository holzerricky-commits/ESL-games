import { describe, expect, it } from 'vitest'
import { mergeOutlineUnitsOntoBook } from '@/lib/books/merge-outline-units'
import type { BookRecord } from '@/lib/books/types'
import type { TocUnitDraft } from '@/lib/books/toc-import'

const FILE_A = 'book-library/wonders/unit-a.pdf'
const FILE_B = 'book-library/wonders/unit-b.pdf'

function bookWithTwoPdfs(): BookRecord {
  return {
    id: 'wonders',
    title: 'Wonders',
    units: [
      { id: 'unit-a', title: 'Unit A', filePath: FILE_A },
      { id: 'unit-b', title: 'Unit B', filePath: FILE_B },
    ],
  }
}

function draft(id: string, title: string, filePath: string): TocUnitDraft {
  return { id, title, needsReview: false, filePath }
}

describe('mergeOutlineUnitsOntoBook', () => {
  it('keeps the other PDF when saving an outline for one file', () => {
    const merged = mergeOutlineUnitsOntoBook(
      bookWithTwoPdfs(),
      FILE_A,
      [draft('unit-a', 'Unit A revised', FILE_A)],
      [[{ id: 'lesson-1', title: 'Story' }]],
    )

    expect(merged.map((unit) => ({ id: unit.id, filePath: unit.filePath, lessons: unit.lessons?.length ?? 0 }))).toEqual([
      { id: 'unit-a', filePath: FILE_A, lessons: 1 },
      { id: 'unit-b', filePath: FILE_B, lessons: 0 },
    ])
  })

  it('does not duplicate or retarget the other file when drafts include every unit', () => {
    const merged = mergeOutlineUnitsOntoBook(
      bookWithTwoPdfs(),
      FILE_A,
      [draft('unit-a', 'Unit A', FILE_A), draft('unit-b', 'Unit B', FILE_B)],
      [[{ id: 'lesson-1', title: 'Story' }], []],
    )

    expect(merged).toHaveLength(2)
    expect(new Set(merged.map((unit) => unit.id)).size).toBe(2)
    expect(merged.find((unit) => unit.id === 'unit-b')?.filePath).toBe(FILE_B)
    expect(merged.find((unit) => unit.id === 'unit-a')?.filePath).toBe(FILE_A)
    expect(merged.find((unit) => unit.id === 'unit-a')?.lessons?.[0]?.title).toBe('Story')
  })

  it('replaces the whole unit list for a single-PDF book', () => {
    const book: BookRecord = {
      id: 'reader',
      title: 'Reader',
      units: [
        { id: 'old-1', title: 'Old 1', filePath: FILE_A },
        { id: 'old-2', title: 'Old 2', filePath: FILE_A },
      ],
    }
    const merged = mergeOutlineUnitsOntoBook(
      book,
      FILE_A,
      [draft('new-1', 'Week 1', FILE_A)],
      [],
    )
    expect(merged.map((unit) => unit.id)).toEqual(['new-1'])
    expect(merged[0]?.filePath).toBe(FILE_A)
  })
})

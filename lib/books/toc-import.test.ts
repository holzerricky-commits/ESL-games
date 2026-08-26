import { describe, expect, it } from 'vitest'
import {
  buildUnitRangesFromToc,
  draftsToUnits,
  mergeDraftsForSourceFile,
  unitsToStructureDrafts,
} from '@/lib/books/toc-import'
import type { BookUnitRecord } from '@/lib/books/types'

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

  it('keeps each draft on its own PDF instead of the currently selected file', () => {
    const units = draftsToUnits('book-library/x/unit-a.pdf', [
      { id: 'u1', title: 'Unit 1', needsReview: false, filePath: 'book-library/x/unit-a.pdf' },
      { id: 'u2', title: 'Unit 2', needsReview: false, filePath: 'book-library/x/unit-b.pdf', endPageHint: 40 },
    ])
    expect(units.map((unit) => unit.filePath)).toEqual([
      'book-library/x/unit-a.pdf',
      'book-library/x/unit-b.pdf',
    ])
    expect(units[1]).toMatchObject({ id: 'u2', endPageHint: 40 })
  })

  it('falls back to the selected file when a new draft has no filePath', () => {
    const units = draftsToUnits('book-library/x/unit-a.pdf', [
      { id: 'u3', title: 'Unit 3', needsReview: false },
    ])
    expect(units[0]!.filePath).toBe('book-library/x/unit-a.pdf')
  })
})

describe('unitsToStructureDrafts', () => {
  it('round-trips file paths and end-page hints so a later save does not wipe sibling PDFs', () => {
    const saved: BookUnitRecord[] = [
      {
        id: 'u1',
        title: 'Unit 1',
        filePath: 'book-library/x/unit-a.pdf',
        startPageHint: 1,
        endPageHint: 20,
        lessons: [{ id: 'l1', title: 'Lesson A' }],
      },
      {
        id: 'u2',
        title: 'Unit 2',
        filePath: 'book-library/x/unit-b.pdf',
        startPageHint: 1,
        endPageHint: 40,
        lessons: [{ id: 'l2', title: 'Lesson B' }],
      },
    ]
    const restored = unitsToStructureDrafts(saved)
    const units = draftsToUnits('book-library/x/unit-a.pdf', restored.drafts, restored.lessonsByUnit)
    expect(units).toHaveLength(2)
    expect(units[0]).toMatchObject({
      id: 'u1',
      filePath: 'book-library/x/unit-a.pdf',
      endPageHint: 20,
    })
    expect(units[1]).toMatchObject({
      id: 'u2',
      filePath: 'book-library/x/unit-b.pdf',
      endPageHint: 40,
    })
    expect(units[1]!.lessons?.[0]!.title).toBe('Lesson B')
  })
})

describe('mergeDraftsForSourceFile', () => {
  it('replaces only the current PDF units and keeps other files in place', () => {
    const existingDrafts = [
      { id: 'u1', title: 'Unit 1', needsReview: false, filePath: 'book-library/x/unit-a.pdf' },
      { id: 'u2', title: 'Unit 2', needsReview: false, filePath: 'book-library/x/unit-b.pdf' },
    ]
    const existingLessons = [[{ id: 'l1', title: 'Old A' }], [{ id: 'l2', title: 'Keep B' }]]
    const merged = mergeDraftsForSourceFile(
      existingDrafts,
      existingLessons,
      'book-library/x/unit-a.pdf',
      [{ id: 'u1-new', title: 'Unit 1 (extracted)', needsReview: false }],
      [[{ id: 'l1-new', title: 'New A' }]],
    )
    expect(merged.drafts.map((draft) => ({ id: draft.id, filePath: draft.filePath, title: draft.title }))).toEqual([
      { id: 'u1-new', filePath: 'book-library/x/unit-a.pdf', title: 'Unit 1 (extracted)' },
      { id: 'u2', filePath: 'book-library/x/unit-b.pdf', title: 'Unit 2' },
    ])
    expect(merged.lessonsByUnit[0]![0]!.title).toBe('New A')
    expect(merged.lessonsByUnit[1]![0]!.title).toBe('Keep B')
  })
})

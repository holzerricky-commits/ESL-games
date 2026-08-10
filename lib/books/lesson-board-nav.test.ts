import { describe, expect, it } from 'vitest'
import {
  isNearEndOfUnitReader,
  lessonBoardBookAccentColor,
  lessonBoardDisplayLabel,
  lessonBoardDocumentHasNotes,
  lessonBoardFooterLabel,
  listLessonBoardShelfForStudent,
  listLessonBoardShelfUnits,
  resolveNextUnitInBook,
  shortLessonBoardBookTitle,
} from '@/lib/books/lesson-board-nav'
import { createEmptyWhiteboardSession } from '@/lib/books/whiteboard-session-types'
import {
  createMemoryWhiteboardSessionStorage,
  saveWhiteboardSessionCheckpoint,
} from '@/lib/books/whiteboard-session-storage'
import { annotationStorageLocalWhiteboardKey } from '@/lib/books/whiteboard-storage'
import type { BookRecord } from '@/lib/books/types'

function bookWithUnits(
  partial: Partial<BookRecord> & { id: string; title: string },
  units: Array<{ id: string; title: string }>,
): BookRecord {
  return {
    id: partial.id,
    title: partial.title,
    role: partial.role,
    series: partial.series,
    grade: partial.grade,
    units: units.map((u) => ({
      id: u.id,
      title: u.title,
      filePath: `book-library/${partial.id}/${u.id}.pdf`,
    })),
  }
}

describe('lesson-board-nav', () => {
  it('lessonBoardBookAccentColor is stable for the same book id', () => {
    const a = lessonBoardBookAccentColor('wonders-workshop-g3')
    const b = lessonBoardBookAccentColor('wonders-workshop-g3')
    expect(a).toBe(b)
    expect(a).toMatch(/^#[0-9A-Fa-f]{6}$/)
  })

  it('lessonBoardBookAccentColor differs for different books often enough', () => {
    const colors = new Set(
      ['book-1', 'book-2', 'book-3', 'book-4', 'book-5', 'book-6', 'book-7', 'book-8'].map(
        lessonBoardBookAccentColor,
      ),
    )
    expect(colors.size).toBeGreaterThan(1)
  })

  it('shortLessonBoardBookTitle truncates long titles', () => {
    expect(shortLessonBoardBookTitle('Short')).toBe('Short')
    expect(shortLessonBoardBookTitle('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 10)).toBe('ABCDEFGHI…')
  })

  it('lessonBoardDisplayLabel prefers catalog role', () => {
    const workshop = bookWithUnits(
      { id: 'ws', title: 'Wonders Grade 3 Workshop', role: 'Workshop' },
      [{ id: 'u1', title: 'Unit 1' }],
    )
    const literature = bookWithUnits(
      { id: 'lit', title: 'Wonders Grade 3 Literature', role: 'Literature' },
      [{ id: 'u1', title: 'Unit 1' }],
    )
    expect(lessonBoardDisplayLabel(workshop)).toBe('Workshop')
    expect(lessonBoardDisplayLabel(literature)).toBe('Literature')
    expect(lessonBoardFooterLabel({ displayLabel: 'Literature', unitTitle: 'Unit 3' })).toBe(
      'Literature · Unit 3',
    )
  })

  it('listLessonBoardShelfUnits returns empty when book has no units', () => {
    const storage = createMemoryWhiteboardSessionStorage()
    expect(
      listLessonBoardShelfUnits({
        studentId: 's1',
        book: bookWithUnits({ id: 'book-a', title: 'A' }, []),
        adapter: storage,
      }),
    ).toEqual([])
  })

  it('listLessonBoardShelfUnits marks empty units without notes', () => {
    const storage = createMemoryWhiteboardSessionStorage()
    const shelf = listLessonBoardShelfUnits({
      studentId: 's1',
      book: bookWithUnits({ id: 'book-a', title: 'A' }, [{ id: 'u1', title: 'Unit 1' }]),
      adapter: storage,
    })
    expect(shelf).toEqual([{ unitId: 'u1', title: 'Unit 1', hasNotes: false, pageCount: 0 }])
  })

  it('listLessonBoardShelfUnits reports notes and page counts for saved boards', () => {
    const storage = createMemoryWhiteboardSessionStorage()
    const book = bookWithUnits({ id: 'book-a', title: 'A' }, [
      { id: 'u1', title: 'Unit 1' },
      { id: 'u2', title: 'Unit 2' },
    ])
    const key1 = {
      studentId: 's1',
      bookId: book.id,
      unitId: 'u1',
      storagePageKey: annotationStorageLocalWhiteboardKey(book.id, 'u1'),
    }
    const withNotes = createEmptyWhiteboardSession(key1)
    withNotes.pages[0] = {
      ...withNotes.pages[0]!,
      title: 'Irregular verbs',
      commands: [
        {
          kind: 'sticky',
          id: 'c1',
          x: 0.1,
          y: 0.1,
          w: 0.2,
          h: 0.15,
          text: 'note',
          fontSizeNorm: 0.04,
          fillColor: '#fef08a',
        },
      ],
    }
    saveWhiteboardSessionCheckpoint(withNotes, storage)

    const key2 = {
      studentId: 's1',
      bookId: book.id,
      unitId: 'u2',
      storagePageKey: annotationStorageLocalWhiteboardKey(book.id, 'u2'),
    }
    saveWhiteboardSessionCheckpoint(createEmptyWhiteboardSession(key2), storage)

    const shelf = listLessonBoardShelfUnits({
      studentId: 's1',
      book,
      adapter: storage,
    })
    expect(shelf).toHaveLength(2)
    expect(shelf[0]).toMatchObject({
      unitId: 'u1',
      title: 'Unit 1',
      hasNotes: true,
      pageCount: 1,
      firstPageTitle: 'Irregular verbs',
    })
    expect(shelf[1]).toMatchObject({
      unitId: 'u2',
      title: 'Unit 2',
      hasNotes: false,
      pageCount: 1,
    })
    expect(lessonBoardDocumentHasNotes(withNotes)).toBe(true)
  })

  it('listLessonBoardShelfForStudent lists two books with one unit each', () => {
    const storage = createMemoryWhiteboardSessionStorage()
    const workshop = bookWithUnits(
      { id: 'ws', title: 'Wonders G3 Workshop', role: 'Workshop' },
      [{ id: 'u1', title: 'Unit 1' }],
    )
    const literature = bookWithUnits(
      { id: 'lit', title: 'Wonders G3 Literature', role: 'Literature' },
      [{ id: 'u1', title: 'Unit 1' }],
    )
    const shelf = listLessonBoardShelfForStudent({
      studentId: 's1',
      library: { books: [workshop, literature] },
      assignedBookIds: ['ws', 'lit'],
      adapter: storage,
    })
    expect(shelf).toHaveLength(2)
    expect(shelf.map((e) => e.displayLabel).sort()).toEqual(['Literature', 'Workshop'])
    expect(shelf.every((e) => e.unitTitle === undefined)).toBe(true)
    expect(shelf.every((e) => e.hasNotes === false)).toBe(true)
  })

  it('listLessonBoardShelfForStudent includes unit titles for multi-unit books', () => {
    const storage = createMemoryWhiteboardSessionStorage()
    const book = bookWithUnits({ id: 'ws', title: 'Workshop', role: 'Workshop' }, [
      { id: 'u1', title: 'Unit 1' },
      { id: 'u2', title: 'Unit 2' },
    ])
    const shelf = listLessonBoardShelfForStudent({
      studentId: 's1',
      library: { books: [book] },
      assignedUnitRefs: [
        { bookId: 'ws', unitId: 'u1' },
        { bookId: 'ws', unitId: 'u2' },
      ],
      adapter: storage,
    })
    expect(shelf).toHaveLength(2)
    expect(shelf.map((e) => e.unitTitle)).toEqual(['Unit 1', 'Unit 2'])
    expect(lessonBoardFooterLabel(shelf[0]!)).toBe('Workshop · Unit 1')
  })

  it('resolveNextUnitInBook returns the following unit only', () => {
    const book = bookWithUnits({ id: 'ws', title: 'Workshop', role: 'Workshop' }, [
      { id: 'u1', title: 'Unit 1' },
      { id: 'u2', title: 'Unit 2' },
      { id: 'u3', title: 'Unit 3' },
    ])
    expect(resolveNextUnitInBook(book, 'u1')).toEqual({ id: 'u2', title: 'Unit 2' })
    expect(resolveNextUnitInBook(book, 'u2')).toEqual({ id: 'u3', title: 'Unit 3' })
    expect(resolveNextUnitInBook(book, 'u3')).toBeNull()
    expect(resolveNextUnitInBook(book, 'missing')).toBeNull()
    expect(resolveNextUnitInBook(book, null)).toBeNull()
    expect(resolveNextUnitInBook(null, 'u1')).toBeNull()
  })

  it('isNearEndOfUnitReader is true on the last spread', () => {
    expect(
      isNearEndOfUnitReader({ pageNumber: 10, spreadRightPage: 11, unitMaxPage: 11 }),
    ).toBe(true)
    expect(isNearEndOfUnitReader({ pageNumber: 11, unitMaxPage: 11 })).toBe(true)
    expect(isNearEndOfUnitReader({ pageNumber: 10, unitMaxPage: 11 })).toBe(true)
    expect(
      isNearEndOfUnitReader({ pageNumber: 8, spreadRightPage: 9, unitMaxPage: 11 }),
    ).toBe(false)
    expect(isNearEndOfUnitReader({ pageNumber: 1, unitMaxPage: 1 })).toBe(true)
  })
})

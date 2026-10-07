import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  classSourceNotebookFocusStorageKey,
  classSourceNotebookLayoutStorageKey,
  classSourceBookForDigitKey,
  formatClassSourcePageLabel,
  listClassSourceBooks,
  parseClassSourceNotebookLayout,
  readClassSourceNotebookFocus,
  readClassSourceNotebookLayout,
  resolveClassSourceNotebookLayout,
  resolveClassSourceNotebookPresence,
  resolveClassSourceStripSelection,
  writeClassSourceNotebookFocus,
  writeClassSourceNotebookLayout,
} from '@/lib/books/class-source-strip'
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

describe('class-source-strip', () => {
  const workshop = bookWithUnits(
    { id: 'ws', title: 'Wonders Grade 3 Workshop', role: 'Workshop' },
    [{ id: 'u1', title: 'Unit 1' }],
  )
  const literature = bookWithUnits(
    { id: 'lit', title: 'Wonders Grade 3 Literature', role: 'Literature' },
    [
      { id: 'u1', title: 'Unit 1' },
      { id: 'u2', title: 'Unit 2' },
    ],
  )
  const library = { books: [workshop, literature] }

  it('formatClassSourcePageLabel skips empty pages', () => {
    expect(formatClassSourcePageLabel(null)).toBeNull()
    expect(formatClassSourcePageLabel(0)).toBeNull()
    expect(formatClassSourcePageLabel(12.9)).toBe('p.12')
  })

  it('lists assigned books in assignment order with role labels', () => {
    const chips = listClassSourceBooks({
      library,
      assignedBookIds: ['lit', 'ws'],
      assignedUnitRefs: [
        { bookId: 'lit', unitId: 'u2' },
        { bookId: 'ws', unitId: 'u1' },
      ],
      getSavedPage: (bookId, unitId) => (bookId === 'lit' && unitId === 'u2' ? 18 : 4),
    })
    expect(chips.map((c) => c.displayLabel)).toEqual(['Literature', 'Workshop'])
    expect(chips[0]).toMatchObject({ bookId: 'lit', unitId: 'u2', page: 18 })
    expect(chips[1]).toMatchObject({ bookId: 'ws', unitId: 'u1', page: 4 })
  })

  it('uses the live open page for the focused book', () => {
    const chips = listClassSourceBooks({
      library,
      assignedBookIds: ['ws', 'lit'],
      openBookId: 'ws',
      openUnitId: 'u1',
      openPage: 42,
      getSavedPage: () => 1,
    })
    expect(chips[0]).toMatchObject({ bookId: 'ws', page: 42 })
    expect(chips[1]?.page).toBe(1)
  })

  it('still lists a single assigned book', () => {
    const chips = listClassSourceBooks({
      library,
      assignedBookIds: ['ws'],
      openBookId: 'ws',
      openUnitId: 'u1',
      openPage: 3,
    })
    expect(chips).toHaveLength(1)
    expect(chips[0]?.displayLabel).toBe('Workshop')
  })

  it('appends the open book when it is not assigned', () => {
    const chips = listClassSourceBooks({
      library,
      assignedBookIds: ['ws'],
      openBookId: 'lit',
      openUnitId: 'u1',
      openPage: 9,
    })
    expect(chips.map((c) => c.bookId)).toEqual(['ws', 'lit'])
  })

  it('resolveClassSourceStripSelection gives notebook exclusive Focus', () => {
    expect(
      resolveClassSourceStripSelection({ focusedBookId: 'ws', notebookFocus: true }),
    ).toEqual({ focusedBookId: null, notebookFocused: true })
    expect(
      resolveClassSourceStripSelection({ focusedBookId: 'ws', notebookFocus: false }),
    ).toEqual({ focusedBookId: 'ws', notebookFocused: false })
  })

  it('resolveClassSourceNotebookPresence keeps the book selected while pinned', () => {
    expect(resolveClassSourceNotebookPresence({ notebookFocus: true, notebookOnDesk: true })).toBe(
      'tab',
    )
    expect(resolveClassSourceNotebookPresence({ notebookFocus: false, notebookOnDesk: true })).toBe(
      'present',
    )
    expect(resolveClassSourceNotebookPresence({ notebookFocus: false, notebookOnDesk: false })).toBe(
      'off',
    )
  })

  it('resolveClassSourceNotebookLayout maps desk states', () => {
    expect(
      resolveClassSourceNotebookLayout({
        sessionOpen: false,
        minimized: false,
        notebookFocus: false,
        floating: false,
      }),
    ).toBeNull()
    expect(
      resolveClassSourceNotebookLayout({
        sessionOpen: true,
        minimized: true,
        notebookFocus: false,
        floating: false,
      }),
    ).toBe('park')
    expect(
      resolveClassSourceNotebookLayout({
        sessionOpen: true,
        minimized: false,
        notebookFocus: true,
        floating: false,
      }),
    ).toBe('tab')
    expect(
      resolveClassSourceNotebookLayout({
        sessionOpen: true,
        minimized: false,
        notebookFocus: false,
        floating: true,
      }),
    ).toBe('overlay')
    expect(
      resolveClassSourceNotebookLayout({
        sessionOpen: true,
        minimized: false,
        notebookFocus: false,
        floating: false,
      }),
    ).toBe('pin')
  })

  it('parseClassSourceNotebookLayout rejects unknown values', () => {
    expect(parseClassSourceNotebookLayout('tab')).toBe('tab')
    expect(parseClassSourceNotebookLayout('float')).toBeNull()
    expect(parseClassSourceNotebookLayout(null)).toBeNull()
  })

  it('classSourceBookForDigitKey maps 1/2 to shelf order', () => {
    const chips = listClassSourceBooks({
      library,
      assignedBookIds: ['ws', 'lit'],
      assignedUnitRefs: [
        { bookId: 'ws', unitId: 'u1' },
        { bookId: 'lit', unitId: 'u1' },
      ],
    })
    expect(classSourceBookForDigitKey(chips, '1')?.bookId).toBe('ws')
    expect(classSourceBookForDigitKey(chips, '2')?.bookId).toBe('lit')
    expect(classSourceBookForDigitKey(chips, '3')).toBeNull()
    expect(classSourceBookForDigitKey(chips.slice(0, 1), '2')).toBeNull()
  })
})

describe('class-source-strip notebook layout persistence', () => {
  beforeEach(() => {
    const store: Record<string, string> = {}
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value
      },
      removeItem: (key: string) => {
        delete store[key]
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('round-trips notebook Focus for a student', () => {
    expect(readClassSourceNotebookFocus('stu-1')).toBe(false)
    writeClassSourceNotebookFocus('stu-1', true)
    expect(sessionStorage.getItem(classSourceNotebookFocusStorageKey('stu-1'))).toBe('1')
    expect(readClassSourceNotebookFocus('stu-1')).toBe(true)
    expect(readClassSourceNotebookFocus('stu-2')).toBe(false)
    writeClassSourceNotebookFocus('stu-1', false)
    expect(readClassSourceNotebookFocus('stu-1')).toBe(false)
  })

  it('round-trips Pin / Tab / Park and migrates old Focus key', () => {
    expect(readClassSourceNotebookLayout('stu-1')).toBeNull()
    writeClassSourceNotebookLayout('stu-1', 'pin')
    expect(sessionStorage.getItem(classSourceNotebookLayoutStorageKey('stu-1'))).toBe('pin')
    expect(readClassSourceNotebookLayout('stu-1')).toBe('pin')
    expect(readClassSourceNotebookFocus('stu-1')).toBe(false)
    writeClassSourceNotebookLayout('stu-1', 'tab')
    expect(readClassSourceNotebookLayout('stu-1')).toBe('tab')
    expect(readClassSourceNotebookFocus('stu-1')).toBe(true)
    writeClassSourceNotebookLayout('stu-1', null)
    expect(readClassSourceNotebookLayout('stu-1')).toBeNull()
    writeClassSourceNotebookFocus('stu-1', true)
    expect(readClassSourceNotebookLayout('stu-1')).toBe('tab')
  })
})

import { describe, expect, it } from 'vitest'
import {
  isStudentNotebookSessionKey,
  loadStudentNotebookSession,
  listStudentNotebookMergeSources,
  mergeStudentNotebookFromBookUnitBoards,
  studentNotebookSessionKey,
} from '@/lib/books/student-notebook-merge'
import { lessonBoardDocumentHasNotes } from '@/lib/books/lesson-board-nav'
import { createLessonBoardPage } from '@/lib/books/lesson-board-types'
import {
  createMemoryWhiteboardSessionStorage,
  saveWhiteboardSessionCheckpoint,
} from '@/lib/books/whiteboard-session-storage'
import {
  createEmptyWhiteboardSession,
  parseWhiteboardSessionDocId,
  whiteboardSessionDocId,
} from '@/lib/books/whiteboard-session-types'
import {
  annotationStorageLocalWhiteboardKey,
  annotationStorageStudentWhiteboardKey,
  STUDENT_NOTEBOOK_BOOK_ID,
} from '@/lib/books/whiteboard-storage'
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

const stroke = (id: string) => ({
  kind: 'stroke' as const,
  id,
  tool: 'pen' as const,
  points: [
    [0.1, 0.1],
    [0.2, 0.2],
  ] as [number, number][],
})

function saveBookUnitBoard(args: {
  storage: ReturnType<typeof createMemoryWhiteboardSessionStorage>
  studentId: string
  bookId: string
  unitId: string
  pages: ReturnType<typeof createLessonBoardPage>[]
  activePageId?: string
  updatedAt: number
}) {
  const key = {
    studentId: args.studentId,
    bookId: args.bookId,
    unitId: args.unitId,
    storagePageKey: annotationStorageLocalWhiteboardKey(args.bookId, args.unitId),
  }
  const doc = createEmptyWhiteboardSession(key, args.updatedAt)
  doc.pages = args.pages
  doc.activePageId = args.activePageId ?? args.pages[0]!.id
  doc.commands = [...(args.pages.find((p) => p.id === doc.activePageId)?.commands ?? [])]
  doc.meta = { revision: 1, dirty: false, updatedAt: args.updatedAt }
  saveWhiteboardSessionCheckpoint(doc, args.storage)
  return doc
}

describe('student-notebook-merge', () => {
  const workshop = bookWithUnits(
    { id: 'ws', title: 'Workshop', role: 'Workshop' },
    [
      { id: 'u1', title: 'Unit 1' },
      { id: 'u2', title: 'Unit 2' },
    ],
  )
  const literature = bookWithUnits(
    { id: 'lit', title: 'Literature', role: 'Literature' },
    [{ id: 'u1', title: 'Unit 1' }],
  )
  const library = { books: [workshop, literature] }

  it('lists merge sources in assigned-book then unit order', () => {
    expect(
      listStudentNotebookMergeSources({
        library,
        assignedBookIds: ['lit', 'ws'],
        openBookId: 'ws',
        openUnitId: 'u1',
      }),
    ).toEqual([
      { bookId: 'lit', unitId: 'u1' },
      { bookId: 'ws', unitId: 'u1' },
      { bookId: 'ws', unitId: 'u2' },
    ])
  })

  it('copy-merges assigned boards and stamps source hints', () => {
    const storage = createMemoryWhiteboardSessionStorage()
    const wsPage = createLessonBoardPage('standard', {
      id: 'ws-p1',
      bookPageHint: 12,
      commands: [stroke('ws-ink')],
    })
    const litPage = createLessonBoardPage('standard', {
      id: 'lit-p1',
      commands: [stroke('lit-ink')],
    })
    saveBookUnitBoard({
      storage,
      studentId: 'stu-1',
      bookId: 'ws',
      unitId: 'u1',
      pages: [wsPage],
      updatedAt: 100,
    })
    saveBookUnitBoard({
      storage,
      studentId: 'stu-1',
      bookId: 'lit',
      unitId: 'u1',
      pages: [litPage],
      updatedAt: 200,
    })

    const merged = mergeStudentNotebookFromBookUnitBoards({
      studentId: 'stu-1',
      sources: [
        { bookId: 'ws', unitId: 'u1' },
        { bookId: 'lit', unitId: 'u1' },
      ],
      adapter: storage,
      now: 999,
    })
    expect(merged).not.toBeNull()
    expect(merged!.pages.map((p) => p.id)).toEqual(['ws-p1', 'lit-p1'])
    expect(merged!.pages[0]).toMatchObject({
      sourceBookId: 'ws',
      sourceUnitId: 'u1',
      bookPageHint: 12,
    })
    expect(merged!.pages[1]).toMatchObject({ sourceBookId: 'lit', sourceUnitId: 'u1' })
    expect(merged!.activePageId).toBe('lit-p1')
    expect(merged!.key.bookId).toBe(STUDENT_NOTEBOOK_BOOK_ID)
    expect(merged!.key.storagePageKey).toBe(annotationStorageStudentWhiteboardKey('stu-1'))
    expect(lessonBoardDocumentHasNotes(merged!)).toBe(true)
  })

  it('leaves old book/unit keys in place and does not re-merge after first save', () => {
    const storage = createMemoryWhiteboardSessionStorage()
    const wsPage = createLessonBoardPage('standard', {
      id: 'ws-p1',
      commands: [stroke('ws-ink')],
    })
    saveBookUnitBoard({
      storage,
      studentId: 'stu-1',
      bookId: 'ws',
      unitId: 'u1',
      pages: [wsPage],
      updatedAt: 100,
    })
    const first = loadStudentNotebookSession(
      'stu-1',
      [{ bookId: 'ws', unitId: 'u1' }],
      storage,
    )
    saveWhiteboardSessionCheckpoint(first, storage)
    const oldKey = {
      studentId: 'stu-1',
      bookId: 'ws',
      unitId: 'u1',
      storagePageKey: annotationStorageLocalWhiteboardKey('ws', 'u1'),
    }
    expect(storage.readRoot()[`${oldKey.studentId}::${oldKey.bookId}::${oldKey.unitId}::wb::${oldKey.storagePageKey}`]).toBeTruthy()

    const litPage = createLessonBoardPage('standard', {
      id: 'lit-p1',
      commands: [stroke('lit-ink')],
    })
    saveBookUnitBoard({
      storage,
      studentId: 'stu-1',
      bookId: 'lit',
      unitId: 'u1',
      pages: [litPage],
      updatedAt: 300,
    })
    const second = loadStudentNotebookSession(
      'stu-1',
      [
        { bookId: 'ws', unitId: 'u1' },
        { bookId: 'lit', unitId: 'u1' },
      ],
      storage,
    )
    expect(second.pages.map((p) => p.id)).toEqual(['ws-p1'])
  })

  it('does not mix another student\'s boards into this notebook', () => {
    const storage = createMemoryWhiteboardSessionStorage()
    saveBookUnitBoard({
      storage,
      studentId: 'stu-2',
      bookId: 'ws',
      unitId: 'u1',
      pages: [
        createLessonBoardPage('standard', { id: 'other', commands: [stroke('x')] }),
      ],
      updatedAt: 1,
    })
    const loaded = loadStudentNotebookSession(
      'stu-1',
      [{ bookId: 'ws', unitId: 'u1' }],
      storage,
    )
    expect(loaded.pages.some((p) => p.id === 'other')).toBe(false)
    expect(loaded.key).toEqual(studentNotebookSessionKey('stu-1'))
  })

  it('skips empty book/unit boards', () => {
    const storage = createMemoryWhiteboardSessionStorage()
    const empty = createEmptyWhiteboardSession({
      studentId: 'stu-1',
      bookId: 'ws',
      unitId: 'u2',
      storagePageKey: annotationStorageLocalWhiteboardKey('ws', 'u2'),
    })
    saveWhiteboardSessionCheckpoint(empty, storage)
    saveBookUnitBoard({
      storage,
      studentId: 'stu-1',
      bookId: 'ws',
      unitId: 'u1',
      pages: [createLessonBoardPage('standard', { id: 'keep', commands: [stroke('ink')] })],
      updatedAt: 50,
    })
    const merged = mergeStudentNotebookFromBookUnitBoards({
      studentId: 'stu-1',
      sources: [
        { bookId: 'ws', unitId: 'u2' },
        { bookId: 'ws', unitId: 'u1' },
      ],
      adapter: storage,
    })
    expect(merged!.pages.map((p) => p.id)).toEqual(['keep'])
  })

  it('copy-merges leftover local boards that were not in the assigned list', () => {
    const storage = createMemoryWhiteboardSessionStorage()
    saveBookUnitBoard({
      storage,
      studentId: 'stu-1',
      bookId: 'ws',
      unitId: 'u1',
      pages: [createLessonBoardPage('standard', { id: 'assigned', commands: [stroke('a')] })],
      updatedAt: 10,
    })
    saveBookUnitBoard({
      storage,
      studentId: 'stu-1',
      bookId: 'lit',
      unitId: 'u1',
      pages: [createLessonBoardPage('standard', { id: 'leftover', commands: [stroke('b')] })],
      updatedAt: 20,
    })
    const merged = mergeStudentNotebookFromBookUnitBoards({
      studentId: 'stu-1',
      sources: [{ bookId: 'ws', unitId: 'u1' }],
      adapter: storage,
    })
    expect(merged!.pages.map((p) => p.id)).toEqual(['assigned', 'leftover'])
    expect(merged!.pages[1]).toMatchObject({ sourceBookId: 'lit', sourceUnitId: 'u1' })
  })

  it('does not write the student key during load', () => {
    const storage = createMemoryWhiteboardSessionStorage()
    saveBookUnitBoard({
      storage,
      studentId: 'stu-1',
      bookId: 'ws',
      unitId: 'u1',
      pages: [createLessonBoardPage('standard', { id: 'ws-p1', commands: [stroke('ws-ink')] })],
      updatedAt: 100,
    })
    const loaded = loadStudentNotebookSession(
      'stu-1',
      [{ bookId: 'ws', unitId: 'u1' }],
      storage,
    )
    const oldDocId = whiteboardSessionDocId({
      studentId: 'stu-1',
      bookId: 'ws',
      unitId: 'u1',
      storagePageKey: annotationStorageLocalWhiteboardKey('ws', 'u1'),
    })
    expect(storage.readRoot()[oldDocId]).toBeTruthy()
    expect(storage.readRoot()[loaded.docId]).toBeUndefined()
    expect(isStudentNotebookSessionKey(loaded.key)).toBe(true)
  })

  it('parses student notebook doc ids', () => {
    const key = studentNotebookSessionKey('stu-9')
    expect(parseWhiteboardSessionDocId(whiteboardSessionDocId(key))).toEqual(key)
  })
})

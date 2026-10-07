import { describe, expect, it } from 'vitest'
import {
  annotationStorageLocalWhiteboardKey,
  annotationStorageSessionKey,
  annotationStorageStudentWhiteboardKey,
  isStudentNotebookStorageKey,
  listWhiteboardStorageKeyCandidates,
  resolveWhiteboardStorageKey,
  STUDENT_NOTEBOOK_BOOK_ID,
} from '@/lib/books/whiteboard-storage'

describe('whiteboard-storage', () => {
  it('builds session key (legacy migration)', () => {
    expect(annotationStorageSessionKey('cls-1')).toBe('wb:session:cls-1')
  })

  it('builds lasting local book/unit key', () => {
    expect(annotationStorageLocalWhiteboardKey('book-a', 'unit-b')).toBe(
      'wb:session:local:book-a:unit-b',
    )
  })

  it('builds lasting student notebook key', () => {
    expect(annotationStorageStudentWhiteboardKey('stu-9')).toBe('wb:session:local:student:stu-9')
    expect(isStudentNotebookStorageKey('wb:session:local:student:stu-9')).toBe(true)
    expect(isStudentNotebookStorageKey('wb:session:local:book-a:unit-b')).toBe(false)
  })

  it('always resolves to the student notebook key', () => {
    expect(
      resolveWhiteboardStorageKey({
        studentId: 'stu-9',
        classSessionId: 'live-9',
        bookId: 'book-a',
        unitId: 'unit-b',
      }),
    ).toBe('wb:session:local:student:stu-9')
  })

  it('listWhiteboardStorageKeyCandidates is only the student key', () => {
    expect(
      listWhiteboardStorageKeyCandidates({
        studentId: 'stu-9',
        classSessionId: 'live-9',
        bookId: 'book-a',
        unitId: 'unit-b',
      }),
    ).toEqual(['wb:session:local:student:stu-9'])
  })

  it('student notebook sentinel is not a real library book id', () => {
    expect(STUDENT_NOTEBOOK_BOOK_ID).toBe('student')
  })
})

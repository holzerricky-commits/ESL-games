import { beforeEach, describe, expect, it } from 'vitest'
import { saveStudents } from '@/lib/storage'
import type { BookLibraryPayload } from '@/lib/books/types'
import type { StudentRecord } from '@/lib/types'
import {
  getStudentBookPlaces,
  getStudentSectionOptions,
  getStudentTeachingOpenPdfPageForBookUnit,
  getStudentUpNextBookId,
  resolveClassEndBookmark,
  resolveClassTeachingBookUnit,
  saveStudentBookPlace,
  updateStudentClassSelectedSection,
  updateStudentCurriculumBookStart,
  upsertStudentClassSession,
} from '@/lib/students/selectors'

class LocalStorageMock {
  private map = new Map<string, string>()
  clear() {
    this.map.clear()
  }
  getItem(key: string) {
    return this.map.get(key) ?? null
  }
  key(index: number) {
    return Array.from(this.map.keys())[index] ?? null
  }
  removeItem(key: string) {
    this.map.delete(key)
  }
  setItem(key: string, value: string) {
    this.map.set(key, value)
  }
  get length() {
    return this.map.size
  }
}

const library: BookLibraryPayload = {
  books: [
    {
      id: 'workshop',
      title: 'Workshop',
      units: [
        {
          id: 'w-u1',
          title: 'Unit 1',
          filePath: '/w1.pdf',
          lessons: [
            { id: 'w-l1', title: 'Lesson 1', startPageHint: 10, endPageHint: 20 },
            { id: 'w-l2', title: 'Lesson 2', startPageHint: 21, endPageHint: 30 },
          ],
        },
      ],
    },
    {
      id: 'literature',
      title: 'Literature',
      units: [
        {
          id: 'l-u1',
          title: 'Unit 1',
          filePath: '/l1.pdf',
          lessons: [{ id: 'l-l1', title: 'Story', startPageHint: 4, endPageHint: 12 }],
        },
      ],
    },
  ],
}

function seed(overrides: Partial<StudentRecord> = {}): StudentRecord {
  const nowIso = '2026-09-01T10:00:00.000Z'
  return {
    id: 'student-1',
    name: 'Lina',
    createdAt: nowIso,
    updatedAt: nowIso,
    assignedQuizIds: [],
    assignedBookIds: ['workshop', 'literature'],
    ...overrides,
  }
}

beforeEach(() => {
  const storage = new LocalStorageMock()
  Object.defineProperty(globalThis, 'localStorage', { value: storage, writable: true, configurable: true })
  Object.defineProperty(globalThis, 'window', { value: { localStorage: storage }, writable: true, configurable: true })
})

function plannedClassId(): string {
  const created = upsertStudentClassSession('student-1', {
    title: 'Next class',
    scheduledFor: new Date(Date.now() + 86400000).toISOString(),
    durationMin: 45,
  })
  if (!created.ok) throw new Error(created.error)
  return created.session.id
}

describe('student book places', () => {
  it('page turns move the place and mark the book as taught', () => {
    saveStudents([seed()])
    saveStudentBookPlace('student-1', { bookId: 'workshop', unitId: 'w-u1', pdfPage: 14 })
    expect(getStudentBookPlaces('student-1').workshop).toMatchObject({ unitId: 'w-u1', pdfPage: 14 })
    expect(getStudentUpNextBookId('student-1', library)).toBe('workshop')
    expect(getStudentTeachingOpenPdfPageForBookUnit('student-1', 'workshop', 'w-u1', library)).toBe(14)
  })

  it('next class opens the other book once the lesson end was reached, ignoring a stale class pick', () => {
    saveStudents([seed()])
    const classId = plannedClassId()
    const options = getStudentSectionOptions('student-1', library)
    const stale = options.find((o) => o.bookId === 'workshop')!
    updateStudentClassSelectedSection('student-1', classId, {
      id: stale.id,
      type: stale.type,
      bookId: stale.bookId,
      bookTitle: stale.bookTitle,
      unitId: stale.unitId,
      unitTitle: stale.unitTitle,
      title: stale.title,
    })
    saveStudentBookPlace('student-1', { bookId: 'literature', unitId: 'l-u1', pdfPage: 6 })
    saveStudentBookPlace('student-1', { bookId: 'workshop', unitId: 'w-u1', pdfPage: 19 })

    expect(resolveClassTeachingBookUnit('student-1', classId, library)).toMatchObject({
      bookId: 'literature',
      unitId: 'l-u1',
    })
    expect(getStudentTeachingOpenPdfPageForBookUnit('student-1', 'literature', 'l-u1', library)).toBe(6)
    expect(getStudentTeachingOpenPdfPageForBookUnit('student-1', 'workshop', 'w-u1', library)).toBe(21)
  })

  it('setting a starting place moves the place and makes that book up next', () => {
    saveStudents([seed()])
    const options = getStudentSectionOptions('student-1', library)
    const story = options.find((o) => o.bookId === 'literature')!
    updateStudentCurriculumBookStart('student-1', { bookId: 'literature', sectionId: story.id, mappedPage: 5 }, library)
    expect(getStudentBookPlaces('student-1').literature).toMatchObject({ unitId: 'l-u1', pdfPage: 5 })
    expect(getStudentUpNextBookId('student-1', library)).toBe('literature')
  })

  it('end-of-class bookmark uses the taught book place', () => {
    saveStudents([seed()])
    saveStudentBookPlace('student-1', { bookId: 'literature', unitId: 'l-u1', pdfPage: 9 })
    expect(resolveClassEndBookmark('student-1', {})).toEqual({ bookId: 'literature', pdfPage: 9, unitId: 'l-u1' })
  })
})

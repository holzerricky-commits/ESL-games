import { beforeEach, describe, expect, it } from 'vitest'
import { getStudents, saveStudents } from '@/lib/storage'
import type { BookLibraryPayload } from '@/lib/books/types'
import type { StudentRecord } from '@/lib/types'
import {
  getStudentBookPlaces,
  getStudentOpenTargetForBook,
  getStudentSectionOptions,
  getStudentTeachingOpenPdfPageForBookUnit,
  getStudentUpNextBookId,
  resolveClassEndBookmark,
  resolveClassTeachingBookUnit,
  saveStudentBookPlace,
  setStudentBookAssignmentStatus,
  updateStudentClassSelectedSection,
  updateStudentCurriculumAssignments,
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
    // Opening workshop itself still lands on the last flipped page (no lesson-end skip).
    expect(getStudentTeachingOpenPdfPageForBookUnit('student-1', 'workshop', 'w-u1', library)).toBe(19)
  })

  it('place at lesson end opens that page, not the next lesson', () => {
    saveStudents([seed()])
    saveStudentBookPlace('student-1', { bookId: 'workshop', unitId: 'w-u1', pdfPage: 19 })
    expect(getStudentTeachingOpenPdfPageForBookUnit('student-1', 'workshop', 'w-u1', library)).toBe(19)
    expect(getStudentUpNextBookId('student-1', library)).toBe('literature')
  })

  it('setting a starting place moves the place and makes that book up next', () => {
    saveStudents([seed()])
    const options = getStudentSectionOptions('student-1', library)
    const story = options.find((o) => o.bookId === 'literature')!
    updateStudentCurriculumBookStart('student-1', { bookId: 'literature', sectionId: story.id, mappedPage: 5 }, library)
    expect(getStudentBookPlaces('student-1').literature).toMatchObject({ unitId: 'l-u1', pdfPage: 5 })
    expect(getStudentUpNextBookId('student-1', library)).toBe('literature')
  })

  it('does not invent the first PDF when the student has no place on a multi-volume book', () => {
    const volumes: BookLibraryPayload = {
      books: [
        {
          id: 'journeys',
          title: 'Journeys',
          units: [
            { id: 'vol-1', title: 'Volume 1', filePath: '/v1.pdf' },
            { id: 'vol-2', title: 'Volume 2', filePath: '/v2.pdf' },
          ],
        },
      ],
    }
    saveStudents([
      seed({
        assignedBookIds: ['journeys'],
        assignedUnitRefs: [{ bookId: 'journeys', unitId: 'vol-2' }],
      }),
    ])
    expect(getStudentOpenTargetForBook('student-1', 'journeys', volumes)).toBeNull()
    expect(getStudentOpenTargetForBook('__books_workshop__', 'journeys', volumes)).toBeNull()
  })

  it('Books tab pin stores the picked PDF page for the next open', () => {
    const alignedLibrary: BookLibraryPayload = {
      books: [
        {
          id: 'workshop',
          title: 'Workshop',
          pageAlignmentByFile: {
            '/w1.pdf': {
              notCountedPdfPages: [2, 3, 10, 11],
              hiddenPdfPages: [1],
            },
          },
          units: [
            {
              id: 'w-u1',
              title: 'Unit 1',
              filePath: '/w1.pdf',
              lessons: [{ id: 'w-l1', title: 'Lesson 1', startPageHint: 10, endPageHint: 20 }],
            },
          ],
        },
      ],
    }
    saveStudents([
      seed({
        assignedBookIds: ['workshop'],
        assignedUnitRefs: [{ bookId: 'workshop', unitId: 'w-u1' }],
      }),
    ])
    const options = getStudentSectionOptions('student-1', alignedLibrary)
    const lesson = options.find((o) => o.bookId === 'workshop')!
    updateStudentCurriculumBookStart(
      'student-1',
      { bookId: 'workshop', sectionId: lesson.id, mappedPage: 14, pdfPage: 18 },
      alignedLibrary,
    )
    expect(getStudentBookPlaces('student-1').workshop).toMatchObject({ unitId: 'w-u1', pdfPage: 18 })
    expect(getStudentTeachingOpenPdfPageForBookUnit('student-1', 'workshop', 'w-u1', alignedLibrary)).toBe(18)
  })

  it('class page flips are what the next open uses', () => {
    saveStudents([seed()])
    const options = getStudentSectionOptions('student-1', library)
    const story = options.find((o) => o.bookId === 'literature')!
    updateStudentCurriculumBookStart(
      'student-1',
      { bookId: 'literature', sectionId: story.id, mappedPage: 5, pdfPage: 5 },
      library,
    )
    saveStudentBookPlace('student-1', { bookId: 'literature', unitId: 'l-u1', pdfPage: 9 })
    expect(getStudentTeachingOpenPdfPageForBookUnit('student-1', 'literature', 'l-u1', library)).toBe(9)
  })

  it('end-of-class bookmark uses the taught book place', () => {
    saveStudents([seed()])
    saveStudentBookPlace('student-1', { bookId: 'literature', unitId: 'l-u1', pdfPage: 9 })
    expect(resolveClassEndBookmark('student-1', {})).toEqual({ bookId: 'literature', pdfPage: 9, unitId: 'l-u1' })
  })

  it('up next skips a paused book that was taught last', () => {
    saveStudents([
      seed({
        bookAssignmentStatus: { workshop: 'paused' },
        lastTaughtBookId: 'workshop',
        bookPlaces: {
          workshop: { unitId: 'w-u1', pdfPage: 14, updatedAt: '2026-09-02T10:00:00.000Z' },
          literature: { unitId: 'l-u1', pdfPage: 6, updatedAt: '2026-09-01T10:00:00.000Z' },
        },
      }),
    ])
    expect(getStudentUpNextBookId('student-1', library)).toBe('literature')
    expect(getStudentBookPlaces('student-1').workshop?.pdfPage).toBe(14)
  })

  it('pausing keeps the place and bringing the book back restores it as up next', () => {
    saveStudents([seed()])
    saveStudentBookPlace('student-1', { bookId: 'literature', unitId: 'l-u1', pdfPage: 6 })
    saveStudentBookPlace('student-1', { bookId: 'workshop', unitId: 'w-u1', pdfPage: 14 })
    expect(setStudentBookAssignmentStatus('student-1', ['workshop'], 'paused').ok).toBe(true)
    expect(getStudentBookPlaces('student-1').workshop).toMatchObject({ pdfPage: 14 })
    expect(getStudentUpNextBookId('student-1', library)).toBe('literature')
    expect(setStudentBookAssignmentStatus('student-1', ['workshop'], 'in_class').ok).toBe(true)
    expect(getStudents().find((row) => row.id === 'student-1')?.bookAssignmentStatus).toBeUndefined()
    expect(getStudentUpNextBookId('student-1', library)).toBe('workshop')
  })

  it('assignment update keeps status on books that remain and drops a removed book', () => {
    saveStudents([
      seed({
        bookAssignmentStatus: { workshop: 'paused', literature: 'finished' },
        bookPlaces: {
          workshop: { unitId: 'w-u1', pdfPage: 14, updatedAt: '2026-09-01T10:00:00.000Z' },
        },
        curriculumBookStarts: {
          workshop: {
            sectionId: 'start-w',
            unitId: 'w-u1',
            mappedPage: 10,
            updatedAt: '2026-09-01T10:00:00.000Z',
          },
        },
      }),
    ])
    const result = updateStudentCurriculumAssignments('student-1', {
      assignedBookIds: ['workshop', 'cambridge'],
      assignedUnitRefs: [],
    })
    expect(result.ok).toBe(true)
    const saved = getStudents().find((row) => row.id === 'student-1')
    expect(saved?.bookAssignmentStatus).toEqual({ workshop: 'paused' })
    expect(saved?.bookPlaces?.workshop?.pdfPage).toBe(14)
    expect(saved?.curriculumBookStarts?.workshop).toMatchObject({ mappedPage: 10, unitId: 'w-u1' })
  })
})

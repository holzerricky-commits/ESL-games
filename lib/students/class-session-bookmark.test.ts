import { beforeEach, describe, expect, it } from 'vitest'
import { saveUnitPage } from '@/lib/books/progress'
import { buildAutoBookmarkAtEnd } from '@/lib/students/class-session-bookmark'
import type { StudentClassSession } from '@/lib/types'

class LocalStorageMock {
  private map = new Map<string, string>()

  getItem(key: string) {
    return this.map.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.map.set(key, value)
  }
}

function session(overrides: Partial<StudentClassSession> = {}): StudentClassSession {
  return {
    id: 'class-1',
    title: 'Class',
    scheduledFor: '2026-05-13T11:00:00.000Z',
    durationMin: 30,
    status: 'in_progress',
    goals: [],
    activities: [],
    plannedVocabulary: [],
    introducedWords: [],
    practicedWords: [],
    reviewedWords: [],
    learnedWords: [],
    classStartedAt: '2000-01-01T00:00:00.000Z',
    selectedSection: {
      id: 'section-1',
      type: 'lesson',
      bookId: 'book-1',
      bookTitle: 'Book 1',
      unitId: 'unit-1',
      unitTitle: 'Unit 1',
      title: 'Lesson 1',
      startPageHint: 4,
      endPageHint: 8,
    },
    createdAt: '2026-05-13T10:00:00.000Z',
    updatedAt: '2026-05-13T10:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  const storage = new LocalStorageMock()
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    writable: true,
    configurable: true,
  })
  Object.defineProperty(globalThis, 'window', {
    value: { localStorage: storage },
    writable: true,
    configurable: true,
  })
})

describe('buildAutoBookmarkAtEnd', () => {
  it('uses reader progress saved during the current class', () => {
    saveUnitPage('book-1', 'unit-1', 27)

    expect(buildAutoBookmarkAtEnd(session(), ['book-1'])).toEqual({
      bookId: 'book-1',
      unitId: 'unit-1',
      pdfPage: 27,
    })
  })

  it('ignores stale reader progress from before class start', () => {
    saveUnitPage('book-1', 'unit-1', 27)

    expect(
      buildAutoBookmarkAtEnd(
        session({ classStartedAt: '2999-01-01T00:00:00.000Z' }),
        ['book-1'],
      ),
    ).toEqual({
      bookId: 'book-1',
      unitId: 'unit-1',
      pdfPage: 8,
    })
  })
})

import { beforeEach, describe, expect, it } from 'vitest'
import { saveReaderProgressMap } from '@/lib/books/progress'
import { buildAutoBookmarkAtEnd } from '@/lib/students/class-session-bookmark'
import type { StudentClassSessionView } from '@/lib/students/types'

class LocalStorageMock {
  private map = new Map<string, string>()

  clear() {
    this.map.clear()
  }

  getItem(key: string) {
    return this.map.has(key) ? (this.map.get(key) ?? null) : null
  }

  removeItem(key: string) {
    this.map.delete(key)
  }

  setItem(key: string, value: string) {
    this.map.set(key, value)
  }
}

function makeSession(overrides: Partial<StudentClassSessionView> = {}): StudentClassSessionView {
  return {
    id: 'class-1',
    title: 'Live class',
    scheduledFor: '2026-05-14T10:00:00.000Z',
    durationMin: 50,
    status: 'in_progress',
    goals: [],
    activities: [],
    plannedVocabulary: [],
    introducedWords: [],
    practicedWords: [],
    reviewedWords: [],
    learnedWords: [],
    classStartedAt: '2026-05-14T10:00:00.000Z',
    createdAt: '2026-05-14T09:00:00.000Z',
    updatedAt: '2026-05-14T10:00:00.000Z',
    selectedSection: {
      id: 'section-1',
      type: 'part',
      bookId: 'book-1',
      bookTitle: 'Book 1',
      unitId: 'unit-1',
      unitTitle: 'Unit 1',
      title: 'Reading',
      startPageHint: 5,
      endPageHint: 8,
    },
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
  it('uses the reader page saved during the live class', () => {
    saveReaderProgressMap({
      'book-1': {
        'unit-1': {
          page: 23,
          updatedAt: '2026-05-14T10:30:00.000Z',
        },
      },
    })

    expect(buildAutoBookmarkAtEnd(makeSession(), ['book-1'])).toEqual({
      bookId: 'book-1',
      unitId: 'unit-1',
      pdfPage: 23,
    })
  })

  it('ignores stale reader progress from before the class started', () => {
    saveReaderProgressMap({
      'book-1': {
        'unit-1': {
          page: 42,
          updatedAt: '2026-05-13T10:30:00.000Z',
        },
      },
    })

    expect(buildAutoBookmarkAtEnd(makeSession(), ['book-1'])).toEqual({
      bookId: 'book-1',
      unitId: 'unit-1',
      pdfPage: 8,
    })
  })

  it('can use an assigned unit ref when the session has no selected section', () => {
    saveReaderProgressMap({
      'book-1': {
        'unit-1': {
          page: 17,
          updatedAt: '2026-05-14T10:20:00.000Z',
        },
      },
    })

    expect(
      buildAutoBookmarkAtEnd(makeSession({ selectedSection: undefined }), ['book-1'], [
        { bookId: 'book-1', unitId: 'unit-1' },
      ]),
    ).toEqual({
      bookId: 'book-1',
      unitId: 'unit-1',
      pdfPage: 17,
    })
  })
})

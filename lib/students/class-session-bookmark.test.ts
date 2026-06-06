import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildAutoBookmarkAtEnd,
} from '@/lib/students/class-session-bookmark'
import { getSavedUnitPage, scheduleSaveUnitPage } from '@/lib/books/progress'
import type { StudentClassSessionView } from '@/lib/students/types'

const storage = new Map<string, string>()

function mockLocalStorage() {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v),
      removeItem: (k: string) => storage.delete(k),
      clear: () => storage.clear(),
    },
  })
}

function session(overrides: Partial<StudentClassSessionView> = {}): StudentClassSessionView {
  return {
    id: 'class-1',
    title: 'Lesson',
    scheduledFor: '2026-06-06T10:00:00.000Z',
    durationMin: 30,
    status: 'in_progress',
    goals: [],
    activities: [],
    plannedVocabulary: [],
    introducedWords: [],
    practicedWords: [],
    reviewedWords: [],
    learnedWords: [],
    createdAt: '2026-06-06T09:00:00.000Z',
    updatedAt: '2026-06-06T09:00:00.000Z',
    ...overrides,
  }
}

describe('buildAutoBookmarkAtEnd', () => {
  beforeEach(() => {
    mockLocalStorage()
    storage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses the last saved reader page instead of the prep page hint', () => {
    scheduleSaveUnitPage('book-a', 'unit-1', 40)
    const bookmark = buildAutoBookmarkAtEnd(
      session({
        selectedSection: {
          id: 'section-1',
          type: 'part',
          bookId: 'book-a',
          bookTitle: 'Book A',
          unitId: 'unit-1',
          unitTitle: 'Unit 1',
          title: 'Prepared section',
          startPageHint: 12,
          endPageHint: 18,
        },
      }),
      ['book-a'],
      [{ bookId: 'book-a', unitId: 'unit-1' }],
    )

    expect(bookmark).toEqual({ bookId: 'book-a', unitId: 'unit-1', pdfPage: 40 })
    expect(getSavedUnitPage('book-a', 'unit-1')).toBe(40)
  })

  it('falls back to the prep hint when the reader has no saved page yet', () => {
    const bookmark = buildAutoBookmarkAtEnd(
      session({
        selectedSection: {
          id: 'section-1',
          type: 'lesson',
          bookId: 'book-a',
          bookTitle: 'Book A',
          unitId: 'unit-1',
          unitTitle: 'Unit 1',
          title: 'Prepared section',
          startPageHint: 12,
          endPageHint: 18,
        },
      }),
      ['book-a'],
      [{ bookId: 'book-a', unitId: 'unit-1' }],
    )

    expect(bookmark).toEqual({ bookId: 'book-a', unitId: 'unit-1', pdfPage: 18 })
  })
})

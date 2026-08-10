import { describe, expect, it } from 'vitest'
import {
  collectClassPrepSignals,
  dueReviewWordsForSession,
  formatPrepContextLine,
} from '@/lib/students/class-prep-signals'
import type { StudentClassSession, StudentRecord } from '@/lib/types'

function baseSession(overrides: Partial<StudentClassSession> = {}): StudentClassSession {
  return {
    id: 's1',
    title: 'Class',
    scheduledFor: '2026-07-01T10:00:00.000Z',
    durationMin: 45,
    status: 'planned',
    goals: [],
    activities: [],
    plannedVocabulary: [],
    introducedWords: [],
    practicedWords: [],
    reviewedWords: [],
    learnedWords: [],
    createdAt: '2026-07-01T09:00:00.000Z',
    updatedAt: '2026-07-01T09:00:00.000Z',
    ...overrides,
  }
}

function baseStudent(overrides: Partial<StudentRecord> = {}): StudentRecord {
  return {
    id: 'stu-1',
    name: 'Alex',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    scheduledClasses: [],
    ...overrides,
  }
}

describe('class prep signals', () => {
  it('detects clean start with no history or vocab', () => {
    const signals = collectClassPrepSignals({
      student: baseStudent(),
      resolvedSection: { bookId: 'book-1', unitId: 'unit-1' },
      sectionOption: { bookId: 'book-1', unitId: 'unit-1', startPageHint: 10 },
    })
    expect(signals.prepContextMode).toBe('clean_start')
    expect(signals.readingPosition?.source).toBe('section_start_hint')
    expect(signals.vocabSignals.needsPracticeWords).toEqual([])
    expect(formatPrepContextLine(signals)).toBe('First class — plan from book section')
  })

  it('uses bookmark page for returning students', () => {
    const student = baseStudent({
      scheduledClasses: [
        baseSession({
          id: 'done-1',
          status: 'completed',
          classEndedAt: '2026-06-28T11:00:00.000Z',
          bookmarkAtEnd: { bookId: 'book-1', unitId: 'unit-1', pdfPage: 42 },
        }),
      ],
    })
    const signals = collectClassPrepSignals({
      student,
      resolvedSection: { bookId: 'book-1', unitId: 'unit-1' },
      sectionOption: { bookId: 'book-1', unitId: 'unit-1', startPageHint: 10 },
    })
    expect(signals.prepContextMode).toBe('returning')
    expect(signals.readingPosition?.source).toBe('last_class_bookmark')
    expect(signals.readingPosition?.pdfPage).toBe(42)
    expect(signals.prepContextFlags.hasReadingPosition).toBe(true)
  })

  it('aggregates needs-practice from review plan and outcomes', () => {
    const student = baseStudent({
      scheduledClasses: [
        baseSession({
          id: 'done-1',
          status: 'completed',
          scheduledFor: '2026-06-20T10:00:00.000Z',
          introducedWords: ['hello'],
          practicedWords: ['world'],
          learnedWords: ['cat'],
          vocabularyReviewPlan: [
            {
              word: 'due-word',
              lastSeenAt: '2026-06-20T10:00:00.000Z',
              intervalDays: 3,
              nextReviewAt: '2026-06-21T10:00:00.000Z',
            },
          ],
        }),
      ],
    })
    const signals = collectClassPrepSignals({
      student,
      resolvedSection: { bookId: 'book-1', unitId: 'unit-1' },
      nowMs: Date.parse('2026-07-01T10:00:00.000Z'),
    })
    expect(signals.vocabSignals.needsPracticeWords).toEqual(
      expect.arrayContaining(['hello', 'world', 'due-word']),
    )
    expect(signals.vocabSignals.strongWords).toEqual(['cat'])
  })

  it('detects mixed mode when only saved notebook words exist', () => {
    const signals = collectClassPrepSignals({
      student: baseStudent(),
      savedWordEntries: [
        { id: '1', source: 'apple', chinese: 'x', status: 'learning' },
        { id: '2', source: 'banana', chinese: 'y', status: 'new' },
      ],
    })
    expect(signals.prepContextMode).toBe('mixed')
    expect(signals.vocabSignals.savedNotebookWords).toEqual(['apple', 'banana'])
    expect(formatPrepContextLine(signals)).toBe('No past classes yet · 2 saved words included')
  })

  it('uses section start hint when no resume page exists', () => {
    const signals = collectClassPrepSignals({
      student: baseStudent(),
      resolvedSection: { bookId: 'book-1', unitId: 'unit-1' },
      sectionOption: { bookId: 'book-1', unitId: 'unit-1', startPageHint: 15, endPageHint: 20 },
    })
    expect(signals.readingPosition?.source).toBe('section_start_hint')
    expect(signals.readingPosition?.pdfPage).toBe(15)
    expect(signals.prepContextMode).toBe('clean_start')
  })

  it('extracts due review words for history entries', () => {
    const session = baseSession({
      vocabularyReviewPlan: [
        {
          word: 'soon',
          lastSeenAt: '2026-06-01T10:00:00.000Z',
          intervalDays: 2,
          nextReviewAt: '2026-06-03T10:00:00.000Z',
        },
        {
          word: 'later',
          lastSeenAt: '2026-06-01T10:00:00.000Z',
          intervalDays: 30,
          nextReviewAt: '2026-12-01T10:00:00.000Z',
        },
      ],
    })
    expect(dueReviewWordsForSession(session, Date.parse('2026-07-01T10:00:00.000Z'))).toEqual(['soon'])
  })
})

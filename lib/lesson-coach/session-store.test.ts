import { describe, expect, it, beforeEach } from 'vitest'
import { DEFAULT_COACH_PROMPTS } from '@/lib/lesson-coach/default-prompts'
import { sanitizeLessonCoachSession } from '@/lib/lesson-coach/types'
import {
  clearLessonCoachSessionsForTests,
  createLessonCoachSession,
  getLessonCoachSession,
  patchLessonCoachSession,
} from '@/lib/lesson-coach/session-store'

describe('lesson-coach session-store', () => {
  beforeEach(() => {
    clearLessonCoachSessionsForTests()
  })

  it('creates and retrieves a session', () => {
    const id = '00000000-0000-4000-8000-000000000001'
    const created = createLessonCoachSession(id, { studentName: 'Alex' })
    expect(created.studentName).toBe('Alex')
    const got = getLessonCoachSession(id)
    expect(got?.id).toBe(id)
  })

  it('patches session fields', () => {
    const id = '00000000-0000-4000-8000-000000000002'
    createLessonCoachSession(id)
    const patched = patchLessonCoachSession(id, {
      pacingNotes: 'Review vocab',
      overlayLastSeenAt: Date.now(),
    })
    expect(patched?.pacingNotes).toBe('Review vocab')
    expect(patched?.overlayLastSeenAt).toBeTypeOf('number')
  })

  it('returns null for unknown id', () => {
    expect(getLessonCoachSession('00000000-0000-4000-8000-000000009999')).toBeNull()
  })

  it('patches dictation mode and shared text', () => {
    const id = '00000000-0000-4000-8000-000000000004'
    createLessonCoachSession(id)
    const patched = patchLessonCoachSession(id, {
      dictationMode: true,
      sharedText: 'he go to school',
      activeField: 'lesson-board',
    })
    expect(patched?.dictationMode).toBe(true)
    expect(patched?.sharedText).toBe('he go to school')
    expect(patched?.activeField).toBe('lesson-board')
  })

  it('seeds default prompt script on create', () => {
    const id = '00000000-0000-4000-8000-000000000003'
    const created = createLessonCoachSession(id)
    expect(created.promptScript).toEqual([...DEFAULT_COACH_PROMPTS])
    expect(created.promptChecked).toHaveLength(DEFAULT_COACH_PROMPTS.length)
    expect(created.promptChecked.every((v) => v === false)).toBe(true)
  })

  it('migrates legacy lesson-paper activeField to lesson-board on read', () => {
    const id = '00000000-0000-4000-8000-000000000005'
    const migrated = sanitizeLessonCoachSession({
      id,
      updatedAt: Date.now(),
      dictationMode: false,
      activeField: 'lesson-paper',
      sharedText: '',
      issueCount: 0,
      revealedCount: 0,
      issues: [],
      pacingNotes: '',
      promptScript: [],
      promptChecked: [],
      revealIndex: -1,
      textUndoStack: [],
    })
    expect(migrated?.activeField).toBe('lesson-board')
  })
})

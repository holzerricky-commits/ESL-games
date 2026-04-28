import { beforeEach, describe, expect, it } from 'vitest'
import { saveStudents } from '@/lib/storage'
import {
  generateScheduledClassesWindow,
  getStudentProfileView,
  getStudentScheduledClasses,
  getWeeklySlotAssignments,
  getStudentsListView,
  recordStudentClassOutcome,
  saveTeacherWeeklyScheduleConfig,
  transitionStudentClassStatus,
  updateStudentClassPublishedVocabulary,
  upsertStudentClassSession,
  upsertWeeklySlotAssignment,
} from '@/lib/students/selectors'
import type { StudentRecord } from '@/lib/types'

class LocalStorageMock {
  private map = new Map<string, string>()

  clear() {
    this.map.clear()
  }

  getItem(key: string) {
    return this.map.has(key) ? (this.map.get(key) ?? null) : null
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

function seedStudent(overrides: Partial<StudentRecord> = {}): StudentRecord {
  const nowIso = '2026-04-20T10:00:00.000Z'
  return {
    id: 'student-1',
    name: 'Lina',
    createdAt: nowIso,
    updatedAt: nowIso,
    assignedQuizIds: [],
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

describe('class sessions and outcomes', () => {
  it('sorts scheduled sessions and updates status/outcomes', () => {
    saveStudents([seedStudent()])
    const first = upsertStudentClassSession('student-1', {
      title: 'Lesson B',
      scheduledFor: '2026-04-22T09:00',
      durationMin: 45,
    })
    const second = upsertStudentClassSession('student-1', {
      title: 'Lesson A',
      scheduledFor: '2026-04-21T09:00',
      durationMin: 45,
    })
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    if (!first.ok || !second.ok) return

    const sessions = getStudentScheduledClasses('student-1')
    expect(sessions.map((row) => row.title)).toEqual(['Lesson A', 'Lesson B'])

    const statusResult = transitionStudentClassStatus('student-1', second.session.id, 'prepared')
    expect(statusResult.ok).toBe(true)
    const outcomeResult = recordStudentClassOutcome('student-1', second.session.id, {
      introducedWords: ['forest', 'river'],
      practicedWords: ['river'],
      learnedWords: ['river'],
      teacherNotes: 'Good speaking confidence.',
    })
    expect(outcomeResult.ok).toBe(true)

    const profile = getStudentProfileView('student-1')
    expect(profile).not.toBeNull()
    expect(profile?.scheduledClasses[0]?.status).toBe('completed')
    expect(profile?.scheduledClasses[0]?.learnedWords).toEqual(['river'])
  })

  it('links published vocabulary set to class planned words', () => {
    saveStudents([seedStudent()])
    const created = upsertStudentClassSession('student-1', {
      title: 'Vocabulary class',
      scheduledFor: '2026-04-22T09:00',
      durationMin: 45,
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const result = updateStudentClassPublishedVocabulary('student-1', created.session.id, {
      setId: 'set-123',
      status: 'published',
      words: ['river', 'valley', 'forest', 'river'],
    })
    expect(result.ok).toBe(true)

    const sessions = getStudentScheduledClasses('student-1')
    expect(sessions[0]?.plannedVocabulary).toEqual(['river', 'valley', 'forest'])
    expect(sessions[0]?.vocabularySetId).toBe('set-123')
    expect(sessions[0]?.vocabularySetStatus).toBe('published')
  })

  it('computes next class label from upcoming sessions', () => {
    saveStudents([
      seedStudent({
        scheduledClasses: [
          {
            id: 'class-old',
            title: 'Completed Class',
            scheduledFor: '2025-04-18T09:00:00.000Z',
            durationMin: 45,
            status: 'completed',
            goals: [],
            activities: [],
            plannedVocabulary: [],
            introducedWords: [],
            practicedWords: [],
            reviewedWords: [],
            learnedWords: [],
            createdAt: '2025-04-18T08:00:00.000Z',
            updatedAt: '2025-04-18T08:00:00.000Z',
          },
          {
            id: 'class-next',
            title: 'Upcoming Class',
            scheduledFor: '2099-04-25T09:00:00.000Z',
            durationMin: 45,
            status: 'planned',
            goals: [],
            activities: [],
            plannedVocabulary: [],
            introducedWords: [],
            practicedWords: [],
            reviewedWords: [],
            learnedWords: [],
            createdAt: '2025-04-18T08:00:00.000Z',
            updatedAt: '2025-04-18T08:00:00.000Z',
          },
        ],
      }),
    ])

    const list = getStudentsListView()
    expect(list).toHaveLength(1)
    expect(list[0]?.nextClassLabel).toContain('Upcoming Class')
  })
})

describe('weekly schedule slots and rolling generation', () => {
  it('prevents overlapping slots and supports 60-minute assignment', () => {
    saveStudents([seedStudent()])
    saveTeacherWeeklyScheduleConfig({
      workingDays: [1],
      startMinute: 9 * 60,
      endMinute: 12 * 60,
      slotMinutes: 30,
    })
    const first = upsertWeeklySlotAssignment({
      dayOfWeek: 1,
      startMinute: 9 * 60,
      durationMinutes: 60,
      studentId: 'student-1',
    })
    expect(first.ok).toBe(true)

    const overlap = upsertWeeklySlotAssignment({
      dayOfWeek: 1,
      startMinute: 9 * 60 + 30,
      durationMinutes: 30,
      studentId: 'student-1',
    })
    expect(overlap.ok).toBe(false)
  })

  it('generates 30-day classes idempotently from slots', () => {
    saveStudents([seedStudent()])
    saveTeacherWeeklyScheduleConfig({
      workingDays: [1],
      startMinute: 9 * 60,
      endMinute: 12 * 60,
      slotMinutes: 30,
    })
    const slot = upsertWeeklySlotAssignment({
      dayOfWeek: 1,
      startMinute: 10 * 60,
      durationMinutes: 60,
      studentId: 'student-1',
    })
    expect(slot.ok).toBe(true)
    if (!slot.ok) return
    expect(getWeeklySlotAssignments()).toHaveLength(1)

    generateScheduledClassesWindow(30)
    const firstPass = getStudentScheduledClasses('student-1')
    generateScheduledClassesWindow(30)
    const secondPass = getStudentScheduledClasses('student-1')

    expect(firstPass.length).toBeGreaterThan(0)
    expect(secondPass.length).toBe(firstPass.length)
    expect(secondPass[0]?.durationMin).toBe(60)
    expect(secondPass[0]?.sourceSlotId).toBe(slot.assignment.id)
    expect(secondPass[0]?.plannedVocabulary).toEqual([])
  })
})

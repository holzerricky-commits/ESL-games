import { describe, expect, it } from 'vitest'
import {
  resolveStudentSetupStatus,
  studentHasBookedClass,
} from '@/lib/students/student-setup-status'
import type { StudentClassSession } from '@/lib/types'

function session(overrides: Partial<StudentClassSession>): StudentClassSession {
  return {
    id: 'c1',
    title: 'Class',
    scheduledFor: '2026-08-01T10:00:00.000Z',
    durationMin: 30,
    status: 'planned',
    goals: [],
    activities: [],
    plannedVocabulary: [],
    introducedWords: [],
    practicedWords: [],
    reviewedWords: [],
    learnedWords: [],
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('student setup status', () => {
  it('treats booked classes as schedule complete even without weekly slot', () => {
    const setup = resolveStudentSetupStatus({
      studentId: 'stu-1',
      assignedBookIds: ['book-1'],
      nextClass: null,
      weeklySlotStudentIds: new Set(),
      hasBookedClass: true,
    })
    expect(setup.needsSetup).toBe(false)
    expect(setup.hasUpcomingClass).toBe(true)
    expect(setup.hasWeeklySlot).toBe(false)
  })

  it('still needs setup with a book but no weekly slot and no booked class', () => {
    const setup = resolveStudentSetupStatus({
      studentId: 'stu-1',
      assignedBookIds: ['book-1'],
      nextClass: null,
      weeklySlotStudentIds: new Set(),
      hasBookedClass: false,
    })
    expect(setup.needsSetup).toBe(true)
    expect(setup.setupHint).toMatch(/calendar|weekly/i)
  })

  it('detects planned prepared and live as booked', () => {
    expect(studentHasBookedClass([session({ status: 'planned' })])).toBe(true)
    expect(studentHasBookedClass([session({ status: 'prepared' })])).toBe(true)
    expect(studentHasBookedClass([session({ status: 'in_progress' })])).toBe(true)
    expect(studentHasBookedClass([session({ status: 'completed' })])).toBe(false)
    expect(studentHasBookedClass([session({ status: 'cancelled' })])).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import {
  CLASS_MAX_OVERTIME_MINUTES,
  CLASS_SCHEDULE_GRACE_MINUTES,
  CLASS_STARTING_SOON_MINUTES,
  canExtendClassBy,
  classEntryActionLabel,
  computeClassLiveClockPhase,
  findNextStudentSoon,
  formatClassCountdown,
  isSessionDueForHardAutoEnd,
  isSessionDueForMissed,
  isSessionEligibleForSoftAutoStart,
  remainingClassExtendBudgetMinutes,
  resolveClassEntryAction,
  resolveTodayClassTeachingState,
  sanitizeExtendedMinutesTotal,
  todayClassPrimaryAction,
  todayClassStateLabel,
} from '@/lib/students/class-schedule-lifecycle'

describe('isSessionEligibleForSoftAutoStart', () => {
  const scheduledFor = '2026-05-01T12:00:00.000Z'
  const startMs = Date.parse(scheduledFor)

  it('rejects before scheduled start', () => {
    expect(
      isSessionEligibleForSoftAutoStart(
        { id: 'c1', status: 'planned', scheduledFor, durationMin: 30 },
        startMs - 1,
      ),
    ).toBe(false)
  })

  it('accepts at scheduled start for planned and prepared', () => {
    expect(
      isSessionEligibleForSoftAutoStart(
        { id: 'c1', status: 'planned', scheduledFor, durationMin: 30 },
        startMs,
      ),
    ).toBe(true)
    expect(
      isSessionEligibleForSoftAutoStart(
        { id: 'c1', status: 'prepared', scheduledFor, durationMin: 30 },
        startMs + 60_000,
      ),
    ).toBe(true)
  })

  it('rejects in_progress / completed / cancelled', () => {
    for (const status of ['in_progress', 'completed', 'cancelled'] as const) {
      expect(
        isSessionEligibleForSoftAutoStart(
          { id: 'c1', status, scheduledFor, durationMin: 30 },
          startMs + 60_000,
        ),
      ).toBe(false)
    }
  })

  it('accepts until end + grace, then rejects', () => {
    const endMs = startMs + 30 * 60_000
    const lastOk = endMs + CLASS_SCHEDULE_GRACE_MINUTES * 60_000 - 1
    const tooLate = endMs + CLASS_SCHEDULE_GRACE_MINUTES * 60_000
    expect(
      isSessionEligibleForSoftAutoStart(
        { id: 'c1', status: 'planned', scheduledFor, durationMin: 30 },
        lastOk,
      ),
    ).toBe(true)
    expect(
      isSessionEligibleForSoftAutoStart(
        { id: 'c1', status: 'planned', scheduledFor, durationMin: 30 },
        tooLate,
      ),
    ).toBe(false)
  })
})

describe('grace / extend helpers', () => {
  const scheduledFor = '2026-05-01T12:00:00.000Z'
  const startMs = Date.parse(scheduledFor)
  const endMs = startMs + 30 * 60_000

  it('sanitizes extended minutes to 1–15', () => {
    expect(sanitizeExtendedMinutesTotal(0)).toBeUndefined()
    expect(sanitizeExtendedMinutesTotal(-1)).toBeUndefined()
    expect(sanitizeExtendedMinutesTotal(7.9)).toBe(7)
    expect(sanitizeExtendedMinutesTotal(20)).toBe(CLASS_MAX_OVERTIME_MINUTES)
  })

  it('tracks remaining extend budget against +15 cap', () => {
    expect(remainingClassExtendBudgetMinutes(0)).toBe(15)
    expect(remainingClassExtendBudgetMinutes(10)).toBe(5)
    expect(canExtendClassBy(10, 5)).toBe(true)
    expect(canExtendClassBy(10, 10)).toBe(false)
    expect(canExtendClassBy(15, 2)).toBe(false)
  })

  it('phases: active → grace → must_end', () => {
    expect(computeClassLiveClockPhase(scheduledFor, 30, endMs - 1)).toBe('active')
    expect(computeClassLiveClockPhase(scheduledFor, 30, endMs)).toBe('grace')
    expect(computeClassLiveClockPhase(scheduledFor, 30, endMs + 2 * 60_000)).toBe('grace')
    expect(
      computeClassLiveClockPhase(scheduledFor, 30, endMs + CLASS_SCHEDULE_GRACE_MINUTES * 60_000),
    ).toBe('must_end')
  })

  it('extends push effective end so grace resets after a chip', () => {
    // At original end + 1 min (in grace), +5 extend → active again with 4 min left
    const now = endMs + 60_000
    expect(computeClassLiveClockPhase(scheduledFor, 30, now, 0)).toBe('grace')
    expect(computeClassLiveClockPhase(scheduledFor, 30, now, 5)).toBe('active')
  })

  it('marks hard auto-end due only after grace on live sessions', () => {
    expect(
      isSessionDueForHardAutoEnd(
        { id: 'c1', status: 'in_progress', scheduledFor, durationMin: 30 },
        endMs + 60_000,
      ),
    ).toBe(false)
    expect(
      isSessionDueForHardAutoEnd(
        { id: 'c1', status: 'in_progress', scheduledFor, durationMin: 30 },
        endMs + CLASS_SCHEDULE_GRACE_MINUTES * 60_000,
      ),
    ).toBe(true)
    expect(
      isSessionDueForHardAutoEnd(
        { id: 'c1', status: 'planned', scheduledFor, durationMin: 30 },
        endMs + CLASS_SCHEDULE_GRACE_MINUTES * 60_000,
      ),
    ).toBe(false)
  })

  it('marks planned/prepared past grace as due for missed', () => {
    expect(
      isSessionDueForMissed(
        { id: 'c1', status: 'planned', scheduledFor, durationMin: 30 },
        endMs + CLASS_SCHEDULE_GRACE_MINUTES * 60_000 - 1,
      ),
    ).toBe(false)
    expect(
      isSessionDueForMissed(
        { id: 'c1', status: 'prepared', scheduledFor, durationMin: 30 },
        endMs + CLASS_SCHEDULE_GRACE_MINUTES * 60_000,
      ),
    ).toBe(true)
    expect(
      isSessionDueForMissed(
        { id: 'c1', status: 'in_progress', scheduledFor, durationMin: 30 },
        endMs + CLASS_SCHEDULE_GRACE_MINUTES * 60_000,
      ),
    ).toBe(false)
  })
})

describe('today teaching states (Phase 6)', () => {
  const scheduledFor = '2026-05-01T12:00:00.000Z'
  const startMs = Date.parse(scheduledFor)
  const endMs = startMs + 30 * 60_000

  it('maps upcoming / starting / live / grace / done / missed', () => {
    expect(
      resolveTodayClassTeachingState(
        { id: 'c1', status: 'planned', scheduledFor, durationMin: 30 },
        startMs - (CLASS_STARTING_SOON_MINUTES + 5) * 60_000,
      ),
    ).toBe('upcoming')
    expect(
      resolveTodayClassTeachingState(
        { id: 'c1', status: 'planned', scheduledFor, durationMin: 30 },
        startMs - 10 * 60_000,
      ),
    ).toBe('starting')
    expect(
      resolveTodayClassTeachingState(
        { id: 'c1', status: 'in_progress', scheduledFor, durationMin: 30 },
        startMs + 5 * 60_000,
      ),
    ).toBe('live')
    expect(
      resolveTodayClassTeachingState(
        { id: 'c1', status: 'in_progress', scheduledFor, durationMin: 30 },
        endMs + 60_000,
      ),
    ).toBe('grace')
    expect(resolveTodayClassTeachingState({ id: 'c1', status: 'completed', scheduledFor, durationMin: 30 })).toBe(
      'done',
    )
    expect(resolveTodayClassTeachingState({ id: 'c1', status: 'missed', scheduledFor, durationMin: 30 })).toBe(
      'missed',
    )
  })

  it('picks one primary action per state', () => {
    expect(todayClassPrimaryAction('upcoming')).toBe('start')
    expect(todayClassPrimaryAction('starting')).toBe('start')
    expect(todayClassPrimaryAction('live')).toBe('continue')
    expect(todayClassPrimaryAction('grace')).toBe('continue')
    expect(todayClassPrimaryAction('missed')).toBe('reschedule')
    expect(todayClassPrimaryAction('done')).toBe('none')
    expect(todayClassStateLabel('grace')).toBe('Grace')
  })

  it('finds next student soon during grace', () => {
    const live = {
      studentId: 's1',
      studentName: 'Lina',
      session: {
        id: 'live-1',
        status: 'in_progress' as const,
        scheduledFor,
        durationMin: 30,
      },
    }
    const next = {
      studentId: 's2',
      studentName: 'Maya',
      session: {
        id: 'next-1',
        status: 'planned' as const,
        scheduledFor: new Date(endMs + 3 * 60_000).toISOString(),
        durationMin: 30,
      },
    }
    const info = findNextStudentSoon([live, next], 'live-1', endMs + 60_000)
    expect(info?.studentName).toBe('Maya')
    expect(info?.minutesUntilStart).toBe(2)
  })
})

describe('ClassIn-style entry actions', () => {
  const scheduledFor = '2026-05-01T12:00:00.000Z'
  const startMs = Date.parse(scheduledFor)

  it('uses Prepare until the 20-minute Enter window', () => {
    expect(
      resolveClassEntryAction(
        { id: 'c1', status: 'planned', scheduledFor, durationMin: 40 },
        startMs - 25 * 60_000,
      ),
    ).toBe('prepare')
    expect(
      resolveClassEntryAction(
        { id: 'c1', status: 'prepared', scheduledFor, durationMin: 40 },
        startMs - CLASS_STARTING_SOON_MINUTES * 60_000,
      ),
    ).toBe('enter')
    expect(classEntryActionLabel('prepare')).toBe('Prepare')
    expect(classEntryActionLabel('enter')).toBe('Enter')
    expect(classEntryActionLabel('continue')).toBe('Enter')
  })

  it('formats countdown only inside 24h', () => {
    expect(formatClassCountdown(scheduledFor, startMs - 12 * 60_000)).toBe('In 12min')
    expect(formatClassCountdown(scheduledFor, startMs - 23 * 60 * 60_000)).toBe('In 23h')
    expect(formatClassCountdown(scheduledFor, startMs - 30 * 60 * 60_000)).toBeNull()
    expect(formatClassCountdown(scheduledFor, startMs + 60_000)).toBeNull()
  })
})

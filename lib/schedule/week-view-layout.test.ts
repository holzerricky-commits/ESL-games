import { describe, expect, it } from 'vitest'
import {
  PX_PER_MINUTE,
  assignOverlapLanes,
  isScheduleGridSlotOccupied,
  snapDurationFromHeightPx,
  snapDurationMinutes,
  snapMinuteFromClick,
  type ScheduleEventBlockLayout,
} from '@/lib/schedule/week-view-layout'
import type { TodaysClassSessionRow } from '@/lib/students/selectors'
import type { StudentClassSession } from '@/lib/types'

function fakeRow(id: string, studentId: string, scheduledFor: string, durationMin: number): TodaysClassSessionRow {
  const session = {
    id,
    title: 'Class',
    scheduledFor,
    durationMin,
    status: 'planned',
    goals: [],
    activities: [],
    plannedVocabulary: [],
    introducedWords: [],
    practicedWords: [],
    reviewedWords: [],
    learnedWords: [],
    createdAt: scheduledFor,
    updatedAt: scheduledFor,
  } as StudentClassSession
  return { studentId, studentName: studentId, session }
}

describe('schedule drag layout helpers', () => {
  it('snaps click offset to 30-minute grid within teaching window', () => {
    expect(snapMinuteFromClick(0, PX_PER_MINUTE, 9 * 60, 17 * 60)).toBe(9 * 60)
    expect(snapMinuteFromClick(36, PX_PER_MINUTE, 9 * 60, 17 * 60)).toBe(9 * 60 + 30)
  })

  it('uses half-open cells so lower half of a band stays on that slot', () => {
    const start = 8 * 60
    const end = 17 * 60
    // 8:30 band is oy 36–72; mid/lower half previously rounded up to 9:00
    expect(snapMinuteFromClick(36, PX_PER_MINUTE, start, end)).toBe(8 * 60 + 30)
    expect(snapMinuteFromClick(54, PX_PER_MINUTE, start, end)).toBe(8 * 60 + 30)
    expect(snapMinuteFromClick(71, PX_PER_MINUTE, start, end)).toBe(8 * 60 + 30)
    // Exactly on the 9:00 line → 9:00
    expect(snapMinuteFromClick(72, PX_PER_MINUTE, start, end)).toBe(9 * 60)
  })

  it('respects duration when snapping start minute', () => {
    expect(snapMinuteFromClick(8 * 60 * PX_PER_MINUTE, PX_PER_MINUTE, 9 * 60, 17 * 60, 60)).toBe(16 * 60)
  })

  it('snaps resize height to nearest class length preset', () => {
    expect(snapDurationMinutes(25)).toBe(25)
    expect(snapDurationMinutes(50)).toBe(50)
    expect(snapDurationMinutes(40)).toBe(45)
    expect(snapDurationMinutes(55)).toBe(60)
    expect(snapDurationFromHeightPx(36, PX_PER_MINUTE)).toBe(30)
    expect(snapDurationFromHeightPx(72, PX_PER_MINUTE)).toBe(60)
  })
})

describe('assignOverlapLanes', () => {
  it('places overlapping blocks in separate lanes', () => {
    const a: ScheduleEventBlockLayout = {
      row: fakeRow('a', 's1', '2026-07-22T10:00:00', 60),
      topPx: 0,
      heightPx: 60,
      dayIndex: 0,
      laneIndex: 0,
      laneCount: 1,
    }
    const b: ScheduleEventBlockLayout = {
      row: fakeRow('b', 's2', '2026-07-22T10:30:00', 60),
      topPx: 30,
      heightPx: 60,
      dayIndex: 0,
      laneIndex: 0,
      laneCount: 1,
    }
    const packed = assignOverlapLanes([a, b])
    expect(packed).toHaveLength(2)
    const lanes = new Set(packed.map((row) => row.laneIndex))
    expect(lanes.size).toBe(2)
    expect(packed.every((row) => row.laneCount === 2)).toBe(true)
  })

  it('keeps non-overlapping blocks full width', () => {
    const a: ScheduleEventBlockLayout = {
      row: fakeRow('a', 's1', '2026-07-22T09:00:00', 30),
      topPx: 0,
      heightPx: 30,
      dayIndex: 0,
      laneIndex: 0,
      laneCount: 1,
    }
    const b: ScheduleEventBlockLayout = {
      row: fakeRow('b', 's2', '2026-07-22T10:00:00', 30),
      topPx: 60,
      heightPx: 30,
      dayIndex: 0,
      laneIndex: 0,
      laneCount: 1,
    }
    const packed = assignOverlapLanes([a, b])
    expect(packed.every((row) => row.laneIndex === 0 && row.laneCount === 1)).toBe(true)
  })
})

describe('isScheduleGridSlotOccupied', () => {
  it('marks half-hour slots covered by an existing class as occupied', () => {
    const block: ScheduleEventBlockLayout = {
      row: fakeRow('a', 's1', '2026-07-22T08:30:00', 60),
      topPx: 36,
      heightPx: 72,
      dayIndex: 1,
      laneIndex: 0,
      laneCount: 1,
    }
    expect(isScheduleGridSlotOccupied(1, 8 * 60 + 30, [block])).toBe(true)
    expect(isScheduleGridSlotOccupied(1, 9 * 60, [block])).toBe(true)
    expect(isScheduleGridSlotOccupied(1, 9 * 60 + 30, [block])).toBe(false)
    expect(isScheduleGridSlotOccupied(0, 8 * 60 + 30, [block])).toBe(false)
  })

  it('ignores cancelled classes', () => {
    const row = fakeRow('a', 's1', '2026-07-22T10:00:00', 30)
    row.session.status = 'cancelled'
    const block: ScheduleEventBlockLayout = {
      row,
      topPx: 0,
      heightPx: 36,
      dayIndex: 0,
      laneIndex: 0,
      laneCount: 1,
    }
    expect(isScheduleGridSlotOccupied(0, 10 * 60, [block])).toBe(false)
  })
})

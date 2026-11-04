import { describe, expect, it } from 'vitest'
import type { StudentClassSession } from '@/lib/types'
import type { DashboardDaySessionRow } from '@/lib/students/selectors'
import {
  computeDashboardDayWindow,
  DASHBOARD_DAY_EMPTY_END_MINUTE,
  DASHBOARD_DAY_EMPTY_START_MINUTE,
  DASHBOARD_DAY_PAD_MINUTES,
  DASHBOARD_DAY_PX_PER_MINUTE,
  dashboardDayGridHeightPx,
  dashboardNowLineTopPx,
  layoutDashboardDayBlocks,
  pickDashboardDaySelection,
} from '@/lib/dashboard/day-timeline-layout'

function session(partial: Partial<StudentClassSession> & Pick<StudentClassSession, 'id' | 'scheduledFor'>): StudentClassSession {
  return {
    id: partial.id,
    title: partial.title ?? 'Class',
    scheduledFor: partial.scheduledFor,
    durationMin: partial.durationMin ?? 30,
    status: partial.status ?? 'planned',
    createdAt: partial.createdAt ?? '2026-01-01T00:00:00.000Z',
    updatedAt: partial.updatedAt ?? '2026-01-01T00:00:00.000Z',
    ...partial,
  } as StudentClassSession
}

function row(
  sessionFields: Partial<StudentClassSession> & Pick<StudentClassSession, 'id' | 'scheduledFor'>,
  name = 'Lina',
): DashboardDaySessionRow {
  return {
    studentId: 'student-1',
    studentName: name,
    session: session(sessionFields),
  }
}

describe('computeDashboardDayWindow', () => {
  it('pads 30 minutes around the day’s classes', () => {
    const window = computeDashboardDayWindow([
      { scheduledFor: '2026-06-15T10:00:00', durationMin: 30, status: 'planned' },
      { scheduledFor: '2026-06-15T14:00:00', durationMin: 60, status: 'planned' },
    ])
    expect(window.startMinute).toBe(10 * 60 - DASHBOARD_DAY_PAD_MINUTES)
    expect(window.endMinute).toBe(14 * 60 + 60 + DASHBOARD_DAY_PAD_MINUTES)
  })

  it('falls back to a daytime window when empty', () => {
    expect(computeDashboardDayWindow([])).toEqual({
      startMinute: DASHBOARD_DAY_EMPTY_START_MINUTE,
      endMinute: DASHBOARD_DAY_EMPTY_END_MINUTE,
    })
  })
})

describe('layoutDashboardDayBlocks', () => {
  it('places blocks by scheduled start and packs overlaps', () => {
    const window = { startMinute: 9 * 60, endMinute: 12 * 60 }
    const layouts = layoutDashboardDayBlocks(
      [
        row({ id: 'a', scheduledFor: '2026-06-15T10:00:00', durationMin: 60 }),
        row({ id: 'b', scheduledFor: '2026-06-15T10:30:00', durationMin: 30 }, 'Maya'),
      ],
      window,
    )
    expect(layouts).toHaveLength(2)
    const a = layouts.find((l) => l.row.session.id === 'a')!
    const b = layouts.find((l) => l.row.session.id === 'b')!
    expect(a.topPx).toBe((10 * 60 - 9 * 60) * DASHBOARD_DAY_PX_PER_MINUTE)
    expect(a.heightPx).toBe(60 * DASHBOARD_DAY_PX_PER_MINUTE)
    expect(b.topPx).toBe((10 * 60 + 30 - 9 * 60) * DASHBOARD_DAY_PX_PER_MINUTE)
    expect(Math.max(a.laneCount, b.laneCount)).toBeGreaterThanOrEqual(2)
    expect(a.laneIndex).not.toBe(b.laneIndex)
  })

  it('keeps completed classes on their scheduled clock slot', () => {
    const window = { startMinute: 9 * 60, endMinute: 11 * 60 }
    const layouts = layoutDashboardDayBlocks(
      [
        row({
          id: 'done',
          scheduledFor: '2026-06-15T09:30:00',
          durationMin: 30,
          status: 'completed',
          classEndedAt: '2026-06-15T10:05:00',
        }),
      ],
      window,
    )
    expect(layouts[0]?.topPx).toBe(30 * DASHBOARD_DAY_PX_PER_MINUTE)
  })
})

describe('dashboardNowLineTopPx / grid height', () => {
  it('maps now into the window', () => {
    const window = { startMinute: 9 * 60, endMinute: 12 * 60 }
    const noon = new Date(2026, 5, 15, 10, 0, 0).getTime()
    expect(dashboardNowLineTopPx(window, noon)).toBe(60 * DASHBOARD_DAY_PX_PER_MINUTE)
    expect(dashboardDayGridHeightPx(window)).toBe(3 * 60 * DASHBOARD_DAY_PX_PER_MINUTE)
  })

  it('hides the now line outside the window', () => {
    const window = { startMinute: 9 * 60, endMinute: 12 * 60 }
    const early = new Date(2026, 5, 15, 7, 0, 0).getTime()
    expect(dashboardNowLineTopPx(window, early)).toBeNull()
  })
})

describe('pickDashboardDaySelection', () => {
  const day = new Date(2026, 5, 15)

  it('prefers a live class', () => {
    const nowMs = new Date(2026, 5, 15, 10, 15, 0).getTime()
    const picked = pickDashboardDaySelection(
      [
        row({ id: 'later', scheduledFor: '2026-06-15T14:00:00', status: 'planned' }),
        row({
          id: 'live',
          scheduledFor: '2026-06-15T10:00:00',
          status: 'in_progress',
          durationMin: 45,
        }),
      ],
      day,
      nowMs,
    )
    expect(picked?.session.id).toBe('live')
  })

  it('prefers starting-soon over later upcoming', () => {
    const nowMs = new Date(2026, 5, 15, 9, 50, 0).getTime()
    const picked = pickDashboardDaySelection(
      [
        row({ id: 'soon', scheduledFor: '2026-06-15T10:00:00', status: 'planned' }),
        row({ id: 'later', scheduledFor: '2026-06-15T14:00:00', status: 'planned' }),
      ],
      day,
      nowMs,
    )
    expect(picked?.session.id).toBe('soon')
  })

  it('falls back to the last class of the day when everything is done', () => {
    const nowMs = new Date(2026, 5, 15, 18, 0, 0).getTime()
    const picked = pickDashboardDaySelection(
      [
        row({ id: 'a', scheduledFor: '2026-06-15T09:00:00', status: 'completed' }),
        row({ id: 'b', scheduledFor: '2026-06-15T11:00:00', status: 'completed' }),
      ],
      day,
      nowMs,
    )
    expect(picked?.session.id).toBe('b')
  })

  it('on another day picks the first open class', () => {
    const nowMs = new Date(2026, 5, 15, 12, 0, 0).getTime()
    const otherDay = new Date(2026, 5, 16)
    const picked = pickDashboardDaySelection(
      [
        row({ id: 'done', scheduledFor: '2026-06-16T09:00:00', status: 'completed' }),
        row({ id: 'open', scheduledFor: '2026-06-16T14:00:00', status: 'planned' }),
      ],
      otherDay,
      nowMs,
    )
    expect(picked?.session.id).toBe('open')
  })
})

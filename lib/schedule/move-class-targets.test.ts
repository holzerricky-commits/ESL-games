import { describe, expect, it } from 'vitest'
import {
  canMoveClassSessionStatus,
  computePlusMinutesMoveTarget,
  computeTomorrowSameTimeMoveTarget,
  dateFromLocalDateKey,
  isMoveClassUrgent,
  normalizeMoveDuration,
  snapScheduleStartMinute,
} from '@/lib/schedule/move-class-targets'

describe('move-class-targets', () => {
  it('normalizes duration to 30 or 60', () => {
    expect(normalizeMoveDuration(60)).toBe(60)
    expect(normalizeMoveDuration(45)).toBe(45)
    expect(normalizeMoveDuration(30)).toBe(30)
    expect(normalizeMoveDuration(12)).toBe(15)
    expect(normalizeMoveDuration(200)).toBe(180)
  })

  it('snaps start minutes to 30-minute grid', () => {
    expect(snapScheduleStartMinute(10 * 60 + 15)).toBe(10 * 60)
    expect(snapScheduleStartMinute(10 * 60 + 30)).toBe(10 * 60 + 30)
  })

  it('parses local date keys', () => {
    const d = dateFromLocalDateKey('2026-07-22')
    expect(d).toBeTruthy()
    expect(d!.getFullYear()).toBe(2026)
    expect(d!.getMonth()).toBe(6)
    expect(d!.getDate()).toBe(22)
    expect(dateFromLocalDateKey('nope')).toBeNull()
  })

  it('allows move for planned/prepared/live/missed', () => {
    expect(canMoveClassSessionStatus('planned')).toBe(true)
    expect(canMoveClassSessionStatus('prepared')).toBe(true)
    expect(canMoveClassSessionStatus('in_progress')).toBe(true)
    expect(canMoveClassSessionStatus('missed')).toBe(true)
    expect(canMoveClassSessionStatus('completed')).toBe(false)
    expect(canMoveClassSessionStatus('cancelled')).toBe(false)
  })

  it('marks urgent within 15 minutes of start (including past start) or when live', () => {
    const start = '2026-07-22T10:00:00.000Z'
    const startMs = Date.parse(start)
    expect(isMoveClassUrgent(start, startMs - 10 * 60_000)).toBe(true)
    expect(isMoveClassUrgent(start, startMs - 20 * 60_000)).toBe(false)
    expect(isMoveClassUrgent(start, startMs + 60_000)).toBe(true)
    expect(isMoveClassUrgent(start, startMs - 20 * 60_000, undefined, 'in_progress')).toBe(true)
  })

  it('computes +30 minutes on the same day', () => {
    // Local construction avoids TZ drift in assertions on clock fields
    const local = new Date(2026, 6, 22, 10, 0, 0, 0)
    const result = computePlusMinutesMoveTarget({
      scheduledForIso: local.toISOString(),
      durationMin: 30,
      addMinutes: 30,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.target.targetDay.getFullYear()).toBe(2026)
    expect(result.target.targetDay.getMonth()).toBe(6)
    expect(result.target.targetDay.getDate()).toBe(22)
    expect(result.target.startMinute).toBe(10 * 60 + 30)
    expect(result.target.durationMinutes).toBe(30)
  })

  it('computes tomorrow same time', () => {
    const local = new Date(2026, 6, 22, 14, 30, 0, 0)
    const result = computeTomorrowSameTimeMoveTarget({
      scheduledForIso: local.toISOString(),
      durationMin: 60,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.target.targetDay.getDate()).toBe(23)
    expect(result.target.startMinute).toBe(14 * 60 + 30)
    expect(result.target.durationMinutes).toBe(60)
  })
})

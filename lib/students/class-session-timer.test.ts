import { describe, expect, it } from 'vitest'
import {
  CLASS_TIMER_WARNING_LAST_MINUTES,
  computeClassEffectiveEndMs,
  computeClassTimerState,
} from '@/lib/students/class-session-timer'

describe('computeClassTimerState', () => {
  /** Slot: 12:00–12:45 UTC */
  const scheduledFor = '2026-05-01T12:00:00.000Z'
  const scheduledStartMs = new Date(scheduledFor).getTime()

  it('returns muted when scheduledFor is missing', () => {
    const s = computeClassTimerState(undefined, 45, Date.now())
    expect(s.variant).toBe('muted')
    expect(s.label).toBe('—')
    expect(s.suffix).toBe('no schedule')
  })

  it('counts down to scheduled end (not click time) with more than warning window left', () => {
    const now = scheduledStartMs + 10_000
    const s = computeClassTimerState(scheduledFor, 45, now)
    expect(s.variant).toBe('normal')
    expect(s.suffix).toBe('left')
    expect(s.label).toBe('44:50')
  })

  it('late start: 2 min late on a 30 min slot → ~28 left, not 30', () => {
    const slot = '2026-05-01T12:00:00.000Z'
    const startMs = new Date(slot).getTime()
    const now = startMs + 2 * 60_000
    const s = computeClassTimerState(slot, 30, now)
    expect(s.variant).toBe('normal')
    expect(s.label).toBe('28:00')
  })

  it('early start: still ends at calendar end (more than duration left)', () => {
    const slot = '2026-05-01T12:00:00.000Z'
    const startMs = new Date(slot).getTime()
    const now = startMs - 5 * 60_000
    const s = computeClassTimerState(slot, 30, now)
    expect(s.variant).toBe('normal')
    expect(s.label).toBe('35:00')
  })

  it('enters warning in the last N minutes before scheduled end', () => {
    const now = scheduledStartMs + (45 - CLASS_TIMER_WARNING_LAST_MINUTES) * 60_000 + 30_000
    const s = computeClassTimerState(scheduledFor, 45, now)
    expect(s.variant).toBe('warning')
    expect(s.label).toBe('2:30')
  })

  it('shows over state after scheduled end', () => {
    const now = scheduledStartMs + 46 * 60_000
    const s = computeClassTimerState(scheduledFor, 45, now)
    expect(s.variant).toBe('over')
    expect(s.suffix).toBe('over')
    expect(s.label).toBe('+1:00')
  })

  it('includes optional extended minutes in effective end (Phase 3 prep)', () => {
    const end = computeClassEffectiveEndMs(scheduledFor, 30, 5)
    expect(end).toBe(scheduledStartMs + 35 * 60_000)
    const now = scheduledStartMs + 32 * 60_000
    const s = computeClassTimerState(scheduledFor, 30, now, 5)
    expect(s.label).toBe('3:00')
    expect(s.variant).toBe('warning')
  })
})

import { describe, expect, it } from 'vitest'
import { CLASS_TIMER_WARNING_LAST_MINUTES, computeClassTimerState } from '@/lib/students/class-session-timer'

describe('computeClassTimerState', () => {
  const start = '2026-05-01T12:00:00.000Z'

  it('returns muted when classStartedAt is missing', () => {
    const s = computeClassTimerState(undefined, 45, Date.now())
    expect(s.variant).toBe('muted')
    expect(s.label).toBe('—')
  })

  it('counts down in normal phase with more than warning window left', () => {
    const startMs = new Date(start).getTime()
    const now = startMs + 10_000
    const s = computeClassTimerState(start, 45, now)
    expect(s.variant).toBe('normal')
    expect(s.suffix).toBe('left')
    expect(s.label).toBe('44:50')
  })

  it('enters warning in the last N minutes', () => {
    const startMs = new Date(start).getTime()
    const now = startMs + (45 - CLASS_TIMER_WARNING_LAST_MINUTES) * 60_000 + 30_000
    const s = computeClassTimerState(start, 45, now)
    expect(s.variant).toBe('warning')
    expect(s.label).toBe('2:30')
  })

  it('shows over state after scheduled end', () => {
    const startMs = new Date(start).getTime()
    const now = startMs + 46 * 60_000
    const s = computeClassTimerState(start, 45, now)
    expect(s.variant).toBe('over')
    expect(s.suffix).toBe('over')
    expect(s.label).toBe('+1:00')
  })
})

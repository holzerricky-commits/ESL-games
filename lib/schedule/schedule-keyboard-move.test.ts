import { describe, expect, it } from 'vitest'
import { keyboardMoveChanged, nudgeKeyboardMove } from '@/lib/schedule/schedule-keyboard-move'

describe('schedule keyboard move', () => {
  const bounds = { minDayIndex: 0, maxDayIndex: 6, startMinute: 9 * 60, endMinute: 17 * 60 }

  it('nudgeKeyboardMove shifts day and time with snap', () => {
    const base = { sessionId: 'c1', dayIndex: 2, startMinute: 10 * 60, durationMinutes: 30 as const }
    const right = nudgeKeyboardMove(base, 'ArrowRight', bounds)
    expect(right.dayIndex).toBe(3)
    const down = nudgeKeyboardMove(base, 'ArrowDown', bounds)
    expect(down.startMinute).toBe(10 * 60 + 30)
  })

  it('keyboardMoveChanged detects edits', () => {
    const current = { sessionId: 'c1', dayIndex: 3, startMinute: 10 * 60, durationMinutes: 30 as const }
    const origin = { dayIndex: 2, startMinute: 10 * 60, durationMinutes: 30 as const }
    expect(keyboardMoveChanged(current, origin)).toBe(true)
  })
})

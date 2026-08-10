import { SNAP_MINUTES } from '@/lib/schedule/week-view-layout'

export interface KeyboardMoveState {
  sessionId: string
  dayIndex: number
  startMinute: number
  durationMinutes: number
}

export function nudgeKeyboardMove(
  current: KeyboardMoveState,
  key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight',
  options: {
    minDayIndex: number
    maxDayIndex: number
    startMinute: number
    endMinute: number
  },
): KeyboardMoveState {
  let { dayIndex, startMinute, durationMinutes } = current

  if (key === 'ArrowLeft') {
    dayIndex = Math.max(options.minDayIndex, dayIndex - 1)
  } else if (key === 'ArrowRight') {
    dayIndex = Math.min(options.maxDayIndex, dayIndex + 1)
  } else if (key === 'ArrowUp') {
    startMinute = Math.max(options.startMinute, startMinute - SNAP_MINUTES)
  } else if (key === 'ArrowDown') {
    const maxStart = options.endMinute - durationMinutes
    startMinute = Math.min(maxStart, startMinute + SNAP_MINUTES)
  }

  return {
    ...current,
    dayIndex,
    startMinute,
  }
}

export function keyboardMoveChanged(
  current: KeyboardMoveState,
  origin: { dayIndex: number; startMinute: number; durationMinutes: number },
): boolean {
  return (
    current.dayIndex !== origin.dayIndex ||
    current.startMinute !== origin.startMinute ||
    current.durationMinutes !== origin.durationMinutes
  )
}

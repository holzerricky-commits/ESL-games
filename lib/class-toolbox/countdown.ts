/** Max activity countdown: 99:59. Not the class session clock. */
export const MAX_COUNTDOWN_SEC = 99 * 60 + 59

export const DEFAULT_COUNTDOWN_SEC = 60

export type CountdownStatus = 'idle' | 'running' | 'paused' | 'finished'

/** [m10, m1, s10, s1] */
export type CountdownDigits = [number, number, number, number]

export type CountdownDigitIndex = 0 | 1 | 2 | 3

export function formatCountdownMs(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function msFromSec(sec: number): number {
  return Math.max(0, Math.min(MAX_COUNTDOWN_SEC, Math.floor(sec))) * 1000
}

export function secToDigits(totalSec: number): CountdownDigits {
  const clamped = Math.max(0, Math.min(MAX_COUNTDOWN_SEC, Math.floor(totalSec)))
  const m = Math.floor(clamped / 60)
  const s = clamped % 60
  return [
    Math.floor(m / 10),
    m % 10,
    Math.floor(s / 10),
    s % 10,
  ]
}

export function digitsToSec(digits: CountdownDigits): number {
  const m = digits[0] * 10 + digits[1]
  const s = digits[2] * 10 + digits[3]
  return Math.max(0, Math.min(MAX_COUNTDOWN_SEC, m * 60 + s))
}

const DIGIT_STEP_SEC: Record<CountdownDigitIndex, number> = {
  0: 600,
  1: 60,
  2: 10,
  3: 1,
}

/**
 * Step one digit up/down by its place value (e.g. sec ones = ±1s), clamped to 0…99:59.
 */
export function stepCountdownDigit(
  digits: CountdownDigits,
  index: CountdownDigitIndex,
  direction: 1 | -1,
): CountdownDigits {
  const step = DIGIT_STEP_SEC[index] * direction
  const next = digitsToSec(digits) + step
  return secToDigits(next)
}

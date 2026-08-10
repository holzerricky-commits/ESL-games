/** Activity stopwatch — counts up. Not the class session clock. */

export const MAX_STOPWATCH_SEC = 99 * 60 + 59

export type StopwatchStatus = 'idle' | 'running' | 'paused'

export function formatStopwatchMs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const clamped = Math.min(MAX_STOPWATCH_SEC, totalSec)
  const m = Math.floor(clamped / 60)
  const s = clamped % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function stopwatchMsToSec(ms: number): number {
  return Math.max(0, Math.min(MAX_STOPWATCH_SEC, Math.floor(ms / 1000)))
}

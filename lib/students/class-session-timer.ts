/** Minutes remaining at or below this → warning styling (amber + pulse). */
export const CLASS_TIMER_WARNING_LAST_MINUTES = 3

function formatClock(nonNegativeSeconds: number): string {
  const abs = Math.max(0, Math.floor(nonNegativeSeconds))
  const m = Math.floor(abs / 60)
  const s = abs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export type ClassTimerVariant = 'normal' | 'warning' | 'over' | 'muted'

export function computeClassTimerState(
  classStartedAt: string | null | undefined,
  durationMin: number,
  nowMs: number,
): { label: string; suffix: string; variant: ClassTimerVariant } {
  const startMs = classStartedAt ? new Date(classStartedAt).getTime() : NaN
  if (!Number.isFinite(startMs)) {
    return { label: '—', suffix: 'no start time', variant: 'muted' }
  }
  const safeMin = Math.max(0, durationMin)
  const endMs = startMs + safeMin * 60_000
  const remainingSec = Math.floor((endMs - nowMs) / 1000)

  if (remainingSec < 0) {
    return {
      label: `+${formatClock(-remainingSec)}`,
      suffix: 'over',
      variant: 'over',
    }
  }
  if (remainingSec <= CLASS_TIMER_WARNING_LAST_MINUTES * 60) {
    return {
      label: formatClock(remainingSec),
      suffix: 'left',
      variant: 'warning',
    }
  }
  return {
    label: formatClock(remainingSec),
    suffix: 'left',
    variant: 'normal',
  }
}

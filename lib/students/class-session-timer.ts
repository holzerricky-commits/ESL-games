/** Minutes remaining at or below this → warning styling (amber + pulse). */
export const CLASS_TIMER_WARNING_LAST_MINUTES = 3

function formatClock(nonNegativeSeconds: number): string {
  const abs = Math.max(0, Math.floor(nonNegativeSeconds))
  const m = Math.floor(abs / 60)
  const s = abs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export type ClassTimerVariant = 'normal' | 'warning' | 'over' | 'muted'

/**
 * Calendar end for the live countdown: scheduled start + length (+ optional extends).
 * `classStartedAt` is history only — late/early start does not move this end.
 */
export function computeClassEffectiveEndMs(
  scheduledFor: string | null | undefined,
  durationMin: number,
  extendedMinutesTotal: number = 0,
): number | null {
  const startMs = scheduledFor ? new Date(scheduledFor).getTime() : NaN
  if (!Number.isFinite(startMs)) return null
  const safeDuration = Math.max(0, Number.isFinite(durationMin) ? durationMin : 0)
  const safeExtend =
    Number.isFinite(extendedMinutesTotal) && extendedMinutesTotal > 0
      ? Math.floor(extendedMinutesTotal)
      : 0
  return startMs + (safeDuration + safeExtend) * 60_000
}

export function computeClassTimerState(
  scheduledFor: string | null | undefined,
  durationMin: number,
  nowMs: number,
  extendedMinutesTotal: number = 0,
): { label: string; suffix: string; variant: ClassTimerVariant } {
  const endMs = computeClassEffectiveEndMs(scheduledFor, durationMin, extendedMinutesTotal)
  if (endMs == null) {
    return { label: '—', suffix: 'no schedule', variant: 'muted' }
  }
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

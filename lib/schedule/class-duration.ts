/** Class length presets + normalization for schedule / weekly slots. */

export const CLASS_DURATION_PRESETS = [25, 30, 45, 50, 60] as const

export type ClassDurationPreset = (typeof CLASS_DURATION_PRESETS)[number]

/** Allowed stored duration (minutes). Presets + custom via Other… */
export const CLASS_DURATION_MIN = 15
export const CLASS_DURATION_MAX = 180

export function isClassDurationPreset(value: number): value is ClassDurationPreset {
  return (CLASS_DURATION_PRESETS as readonly number[]).includes(value)
}

/** Clamp and floor to a valid class length. */
export function normalizeClassDurationMinutes(raw: unknown, fallback: number = 30): number {
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return fallback
  return Math.max(CLASS_DURATION_MIN, Math.min(CLASS_DURATION_MAX, Math.floor(n)))
}

/**
 * Snap a free resize height (minutes) to the nearest preset.
 * Custom lengths already on a block stay if they're closer than any preset shift… 
 * actually for drag we always snap to presets for simplicity.
 */
export function snapDurationMinutes(minutes: number): number {
  const safe = Number.isFinite(minutes) ? minutes : 30
  let best: number = CLASS_DURATION_PRESETS[0]
  let bestDist = Math.abs(safe - best)
  for (const preset of CLASS_DURATION_PRESETS) {
    const dist = Math.abs(safe - preset)
    // On a tie, prefer the longer class (e.g. 55 → 60, not 50).
    if (dist < bestDist || (dist === bestDist && preset > best)) {
      best = preset
      bestDist = dist
    }
  }
  return best
}

export function durationSelectValue(durationMinutes: number): string {
  return isClassDurationPreset(durationMinutes) ? String(durationMinutes) : 'other'
}

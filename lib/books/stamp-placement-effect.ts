import type { StampVariant } from '@/lib/books/annotation-command-types'

export const STAMP_PLACEMENT_EFFECT_MS = 500

export type StampPlacementTransform = {
  scale: number
  rotationRad: number
  offsetXNorm: number
  offsetYNorm: number
  opacity: number
}

type StampPlacementEntry = {
  id: string
  variant: StampVariant
  center: [number, number]
  startedAt: number
}

const effects = new Map<string, StampPlacementEntry>()
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

function easeOutBack(t: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

function popScale(progress: number): number {
  if (progress <= 0) return 0
  if (progress >= 1) return 1
  if (progress < 0.65) {
    const t = progress / 0.65
    return easeOutBack(t) * 1.08
  }
  const t = (progress - 0.65) / 0.35
  return 1.08 + (1 - 1.08) * t
}

function fadeInOpacity(progress: number): number {
  if (progress >= 0.25) return 1
  return clamp01(progress / 0.25)
}

function doublePulseScale(progress: number): number {
  if (progress <= 0) return 0
  if (progress >= 1) return 1
  const wave = Math.sin(progress * Math.PI * 2)
  const base = popScale(progress)
  return base * (1 + 0.12 * Math.max(0, wave))
}

export function prefersReducedStampMotion(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/** Progress 0..1 through the stamp placement effect window. */
export function stampPlacementProgress(elapsedMs: number): number {
  return clamp01(elapsedMs / STAMP_PLACEMENT_EFFECT_MS)
}

export function getStampPlacementTransform(
  variant: StampVariant,
  elapsedMs: number,
  options?: { reducedMotion?: boolean },
): StampPlacementTransform | null {
  if (elapsedMs >= STAMP_PLACEMENT_EFFECT_MS) return null
  if (options?.reducedMotion ?? prefersReducedStampMotion()) {
    return { scale: 1, rotationRad: 0, offsetXNorm: 0, offsetYNorm: 0, opacity: 1 }
  }

  const p = stampPlacementProgress(elapsedMs)
  const scale = popScale(p)
  const opacity = fadeInOpacity(p)
  let rotationRad = 0
  let offsetXNorm = 0
  let offsetYNorm = 0
  let outScale = scale

  switch (variant) {
    case 'check':
      outScale = scale
      break
    case 'cross': {
      const shake = Math.sin(p * Math.PI * 6) * (1 - p) * 0.05
      rotationRad = shake
      break
    }
    case 'question': {
      const bounce = Math.sin(p * Math.PI) * 0.04 * (1 - p)
      rotationRad = Math.sin(p * Math.PI * 4) * 0.08 * (1 - p)
      offsetYNorm = -bounce
      break
    }
    case 'star':
      rotationRad = p * Math.PI * 2
      break
    case 'heart':
      outScale = doublePulseScale(p)
      break
    default:
      break
  }

  return {
    scale: outScale,
    rotationRad,
    offsetXNorm,
    offsetYNorm,
    opacity,
  }
}

export function registerStampPlacementEffect(
  payload: {
    id: string
    variant: StampVariant
    center: [number, number]
    startedAt?: number
  },
): void {
  if (!payload.id) return
  effects.set(payload.id, {
    id: payload.id,
    variant: payload.variant,
    center: payload.center,
    startedAt: payload.startedAt ?? Date.now(),
  })
  emit()
}

export function getStampPlacementTransformForId(
  id: string,
  now: number = Date.now(),
  options?: { reducedMotion?: boolean },
): StampPlacementTransform | null {
  const entry = effects.get(id)
  if (!entry) return null
  return getStampPlacementTransform(entry.variant, now - entry.startedAt, options)
}

export function getActiveStampPlacementIds(now: number = Date.now()): ReadonlySet<string> {
  const out = new Set<string>()
  for (const [id, entry] of effects) {
    if (now - entry.startedAt < STAMP_PLACEMENT_EFFECT_MS) out.add(id)
  }
  return out
}

export function hasActiveStampPlacementEffects(now: number = Date.now()): boolean {
  for (const entry of effects.values()) {
    if (now - entry.startedAt < STAMP_PLACEMENT_EFFECT_MS) return true
  }
  return false
}

export function clearFinishedStampPlacementEffects(now: number = Date.now()): boolean {
  let removed = false
  for (const [id, entry] of effects) {
    if (now - entry.startedAt >= STAMP_PLACEMENT_EFFECT_MS) {
      effects.delete(id)
      removed = true
    }
  }
  if (removed) emit()
  return removed
}

export function subscribeStampPlacementChanges(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Test helper — reset module state. */
export function resetStampPlacementRegistry(): void {
  effects.clear()
  emit()
}

import { describe, expect, it, beforeEach } from 'vitest'
import {
  getStampPlacementTransform,
  getStampPlacementTransformForId,
  registerStampPlacementEffect,
  resetStampPlacementRegistry,
  STAMP_PLACEMENT_EFFECT_MS,
  stampPlacementProgress,
} from '@/lib/books/stamp-placement-effect'

describe('stamp-placement-effect', () => {
  beforeEach(() => {
    resetStampPlacementRegistry()
  })

  it('progress runs 0 to 1 over effect duration', () => {
    expect(stampPlacementProgress(0)).toBe(0)
    expect(stampPlacementProgress(STAMP_PLACEMENT_EFFECT_MS / 2)).toBe(0.5)
    expect(stampPlacementProgress(STAMP_PLACEMENT_EFFECT_MS)).toBe(1)
  })

  it('returns null after effect ends', () => {
    expect(getStampPlacementTransform('star', STAMP_PLACEMENT_EFFECT_MS)).toBeNull()
  })

  it('settles to neutral transform at end of window', () => {
    const t = getStampPlacementTransform('check', STAMP_PLACEMENT_EFFECT_MS - 1)
    expect(t).not.toBeNull()
    expect(t!.scale).toBeCloseTo(1, 1)
    expect(t!.opacity).toBe(1)
  })

  it('reduced motion yields static transform', () => {
    const t = getStampPlacementTransform('star', 100, { reducedMotion: true })
    expect(t).toEqual({
      scale: 1,
      rotationRad: 0,
      offsetXNorm: 0,
      offsetYNorm: 0,
      opacity: 1,
    })
  })

  it('star spins during effect', () => {
    const mid = getStampPlacementTransform('star', STAMP_PLACEMENT_EFFECT_MS * 0.5, {
      reducedMotion: false,
    })
    expect(mid).not.toBeNull()
    expect(mid!.rotationRad).toBeGreaterThan(0.5)
  })

  it('star rotation settles upright at end of window', () => {
    const end = getStampPlacementTransform('star', STAMP_PLACEMENT_EFFECT_MS - 1, {
      reducedMotion: false,
    })
    expect(end).not.toBeNull()
    const twoPi = Math.PI * 2
    const normalized = ((end!.rotationRad % twoPi) + twoPi) % twoPi
    const distFromUpright = Math.min(normalized, twoPi - normalized)
    expect(distFromUpright).toBeLessThan(0.2)
    expect(Math.abs(normalized - Math.PI)).toBeGreaterThan(0.5)
  })

  it('registry lookup by command id', () => {
    const t0 = 1_000_000
    registerStampPlacementEffect({
      id: 'stamp-a',
      variant: 'heart',
      center: [0.5, 0.5],
      startedAt: t0,
    })
    const active = getStampPlacementTransformForId('stamp-a', t0 + 120, { reducedMotion: false })
    expect(active).not.toBeNull()
    expect(active!.scale).toBeGreaterThan(0)
    expect(getStampPlacementTransformForId('stamp-a', t0 + STAMP_PLACEMENT_EFFECT_MS)).toBeNull()
  })
})

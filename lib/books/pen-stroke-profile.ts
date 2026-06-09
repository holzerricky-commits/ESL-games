import type { PenInkStyle } from '@/lib/books/pen-ink'
import { isEffectPenInkStyle } from '@/lib/books/pen-ink'
import {
  ANNOTATION_PEN_SWATCHES,
  type PenSwatch,
  getPenSwatch,
  migratePenSwatchId,
} from '@/lib/books/annotation-palettes'

/** Active pen types in toolbar / shortcuts. */
export const PEN_STROKE_PROFILES = ['pen', 'brush', 'effects'] as const

export type ActivePenStrokeProfile = (typeof PEN_STROKE_PROFILES)[number]

/** Retired profiles — still replay from saved strokes. */
export const LEGACY_PEN_STROKE_PROFILES = ['pencil', 'fine-liner'] as const

export type LegacyPenStrokeProfile = (typeof LEGACY_PEN_STROKE_PROFILES)[number]

export type PenStrokeProfile = ActivePenStrokeProfile | LegacyPenStrokeProfile

export const DEFAULT_PEN_STROKE_PROFILE: ActivePenStrokeProfile = 'pen'

export const PEN_STROKE_PROFILE_LABEL: Record<ActivePenStrokeProfile, string> = {
  pen: 'Pen',
  brush: 'Brush',
  effects: 'Effects',
}

const ALL_PEN_STROKE_PROFILES = [...PEN_STROKE_PROFILES, ...LEGACY_PEN_STROKE_PROFILES] as const

export function isPenStrokeProfile(v: unknown): v is PenStrokeProfile {
  return typeof v === 'string' && (ALL_PEN_STROKE_PROFILES as readonly string[]).includes(v)
}

export function isActivePenStrokeProfile(v: unknown): v is ActivePenStrokeProfile {
  return typeof v === 'string' && (PEN_STROKE_PROFILES as readonly string[]).includes(v)
}

/** Map retired toolbar choices to the default pen when hydrating prefs. */
export function normalizeActivePenStrokeProfile(profile: PenStrokeProfile): ActivePenStrokeProfile {
  if (isActivePenStrokeProfile(profile)) return profile
  return DEFAULT_PEN_STROKE_PROFILE
}

export function penProfileUsesEffectInk(profile: PenStrokeProfile): boolean {
  return profile === 'effects'
}

/** Width multiplier applied on top of pen thickness steps. */
export function penProfileWidthScaleMultiplier(profile: PenStrokeProfile | undefined): number {
  switch (profile) {
    case 'brush':
      return 1.15
    case 'pencil':
      return 0.92
    case 'fine-liner':
      return 0.42
    default:
      return 1
  }
}

export type PenProfileDrawStyle = {
  alpha: number
  /** Extra soft passes for brush (width factor, alpha). */
  softPasses?: readonly { widthFactor: number; alpha: number }[]
}

export function penProfileDrawStyle(profile: PenStrokeProfile | undefined): PenProfileDrawStyle {
  switch (profile) {
    case 'brush':
      return {
        alpha: 0.88,
        softPasses: [
          { widthFactor: 1.55, alpha: 0.1 },
          { widthFactor: 1.2, alpha: 0.18 },
        ],
      }
    case 'pencil':
      return { alpha: 0.58 }
    case 'fine-liner':
      return { alpha: 0.95 }
    default:
      return { alpha: 1 }
  }
}

export function filterPenSwatchesForProfile(profile: PenStrokeProfile): readonly PenSwatch[] {
  if (profile === 'effects') {
    return ANNOTATION_PEN_SWATCHES.filter((s) => isEffectPenInkStyle(s.patternId))
  }
  return ANNOTATION_PEN_SWATCHES.filter((s) => s.patternId === 'solid')
}

export function defaultPenSwatchIdForProfile(profile: PenStrokeProfile): string {
  return filterPenSwatchesForProfile(profile)[0]?.id ?? ANNOTATION_PEN_SWATCHES[0].id
}

/** Resolve ink style from profile + swatch (effects use pattern tiles). */
export function resolvePenInkStyleForProfile(
  profile: PenStrokeProfile,
  swatch: PenSwatch,
  colorSource: 'swatch' | 'custom',
): PenInkStyle {
  if (profile === 'effects' && colorSource === 'swatch' && isEffectPenInkStyle(swatch.patternId)) {
    return swatch.patternId
  }
  return 'solid'
}

export function inferPenStrokeProfileFromStroke(
  penInkStyle: PenInkStyle | undefined,
  storedProfile: unknown,
): PenStrokeProfile {
  if (isPenStrokeProfile(storedProfile)) return storedProfile
  if (penInkStyle && isEffectPenInkStyle(penInkStyle)) return 'effects'
  return DEFAULT_PEN_STROKE_PROFILE
}

export function coercePenSwatchIdForProfile(swatchId: string, profile: PenStrokeProfile): string {
  const resolvedId = migratePenSwatchId(swatchId)
  const swatch = getPenSwatch(resolvedId)
  const allowed = filterPenSwatchesForProfile(profile)
  if (allowed.some((s) => s.id === resolvedId)) return resolvedId
  if (profile === 'effects' && isEffectPenInkStyle(swatch.patternId)) return resolvedId
  if (profile !== 'effects' && swatch.patternId === 'solid') return resolvedId
  return defaultPenSwatchIdForProfile(profile)
}

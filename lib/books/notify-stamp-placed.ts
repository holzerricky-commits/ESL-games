import type { StampVariant } from '@/lib/books/annotation-command-types'
import { playStampSound } from '@/lib/audio/play-stamp-sound'
import {
  prefersReducedStampMotion,
  registerStampPlacementEffect,
} from '@/lib/books/stamp-placement-effect'
import { resolveStampEffectsEnabledFromStorage } from '@/lib/books/student-annotation-tool-prefs'

export type StampPlacedPayload = {
  id: string
  variant: StampVariant
  center: [number, number]
}

export type NotifyStampPlacedOptions = {
  studentId?: string
  soundEnabled?: boolean
  motionEnabled?: boolean
}

/** Ephemeral placement feedback — not stored on the stamp command. */
export function notifyStampPlaced(
  payload: StampPlacedPayload,
  options: NotifyStampPlacedOptions = {},
): void {
  const effectsEnabled =
    options.soundEnabled ??
    (options.studentId ? resolveStampEffectsEnabledFromStorage(options.studentId) : true)
  const motionEnabled =
    options.motionEnabled ??
    (effectsEnabled && !prefersReducedStampMotion())

  if (motionEnabled) {
    registerStampPlacementEffect({
      id: payload.id,
      variant: payload.variant,
      center: payload.center,
    })
  }

  if (effectsEnabled) {
    playStampSound(payload.variant)
  }
}

export function notifyStampPlacedFromCommand(
  cmd: { kind: string; id: string; variant?: StampVariant; center?: [number, number] },
  options: NotifyStampPlacedOptions = {},
): void {
  if (cmd.kind !== 'stamp') return
  if (!cmd.variant || !cmd.center) return
  notifyStampPlaced(
    { id: cmd.id, variant: cmd.variant, center: cmd.center },
    options,
  )
}

import type { StampVariant } from '@/lib/books/annotation-command-types'

let sharedAudioContext: AudioContext | null = null
let activeStop: (() => void) | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctx =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return null
  if (!sharedAudioContext) {
    sharedAudioContext = new Ctx()
  }
  return sharedAudioContext
}

type ToneSpec = {
  freq: number
  at: number
  dur: number
  type?: OscillatorType
  gain?: number
}

/** Two soft chord blooms — matches the heart stamp double-pulse animation. */
export type HeartBloomSpec = {
  at: number
  /** Root + major third for a cozy, affectionate dyad. */
  freqs: readonly [number, number]
  dur: number
  gain: number
}

/** Exported for regression tests — do not use outside play-stamp-sound. */
export const HEART_STAMP_SOUND_BLOOMS: readonly HeartBloomSpec[] = [
  { at: 0, freqs: [392, 493.88], dur: 0.12, gain: 0.3 },
  { at: 0.13, freqs: [587.33, 739.99], dur: 0.2, gain: 0.28 },
]

/** Exported for regression tests — do not use outside play-stamp-sound. */
export const STAMP_SOUND_NOTE_SPECS: Record<
  Exclude<StampVariant, 'heart'>,
  readonly ToneSpec[]
> & { heart: readonly ToneSpec[] } = {
  check: [
    { freq: 659.25, at: 0, dur: 0.14 },
    { freq: 880, at: 0.06, dur: 0.16 },
  ],
  cross: [{ freq: 220, at: 0, dur: 0.12, type: 'triangle', gain: 0.28 }],
  question: [
    { freq: 440, at: 0, dur: 0.1 },
    { freq: 523.25, at: 0.08, dur: 0.14 },
  ],
  star: [
    { freq: 987.77, at: 0, dur: 0.08, gain: 0.32 },
    { freq: 1174.66, at: 0.05, dur: 0.1, gain: 0.28 },
    { freq: 1318.51, at: 0.11, dur: 0.14, gain: 0.35 },
  ],
  heart: [],
}

const STAMP_SOUND_MASTER_FADE_S = 0.38
const HEART_SOUND_MASTER_FADE_S = 0.42
const HEART_ATTACK_S = 0.045
const HEART_DETUNE_CENTS = 11

function playTones(
  notes: readonly ToneSpec[],
  masterGain = 0.12,
  masterFadeS = STAMP_SOUND_MASTER_FADE_S,
): void {
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    activeStop?.()
    activeStop = null

    const startAt = ctx.currentTime + 0.01
    const master = ctx.createGain()
    master.gain.setValueAtTime(0.0001, startAt)
    master.gain.exponentialRampToValueAtTime(masterGain, startAt + 0.015)
    master.gain.exponentialRampToValueAtTime(0.0001, startAt + masterFadeS)
    master.connect(ctx.destination)

    const stops: Array<() => void> = []
    for (const note of notes) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = note.type ?? 'sine'
      osc.frequency.setValueAtTime(note.freq, startAt + note.at)
      const peak = note.gain ?? 0.35
      gain.gain.setValueAtTime(0.0001, startAt + note.at)
      gain.gain.exponentialRampToValueAtTime(peak, startAt + note.at + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + note.at + note.dur)
      osc.connect(gain)
      gain.connect(master)
      osc.start(startAt + note.at)
      osc.stop(startAt + note.at + note.dur + 0.03)
      stops.push(() => {
        try {
          osc.stop()
        } catch {
          /* already stopped */
        }
      })
    }

    activeStop = () => {
      for (const stop of stops) stop()
    }

    void ctx.resume()
  } catch {
    /* ignore autoplay / Web Audio failures */
  }
}

function scheduleHeartOsc(
  ctx: AudioContext,
  master: GainNode,
  startAt: number,
  bloomAt: number,
  freq: number,
  peakGain: number,
  dur: number,
  detuneCents: number,
  stops: Array<() => void>,
): void {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq, startAt + bloomAt)
  osc.detune.setValueAtTime(detuneCents, startAt + bloomAt)
  gain.gain.setValueAtTime(0.0001, startAt + bloomAt)
  gain.gain.exponentialRampToValueAtTime(peakGain, startAt + bloomAt + HEART_ATTACK_S)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + bloomAt + dur)
  osc.connect(gain)
  gain.connect(master)
  osc.start(startAt + bloomAt)
  osc.stop(startAt + bloomAt + dur + 0.03)
  stops.push(() => {
    try {
      osc.stop()
    } catch {
      /* already stopped */
    }
  })
}

/** Warm double-bloom with detuned pairs — distinct from ascending check/question tones. */
function playHeartSound(): void {
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    activeStop?.()
    activeStop = null

    const startAt = ctx.currentTime + 0.01
    const master = ctx.createGain()
    master.gain.setValueAtTime(0.0001, startAt)
    master.gain.exponentialRampToValueAtTime(0.11, startAt + 0.02)
    master.gain.exponentialRampToValueAtTime(0.0001, startAt + HEART_SOUND_MASTER_FADE_S)
    master.connect(ctx.destination)

    const stops: Array<() => void> = []

    for (const bloom of HEART_STAMP_SOUND_BLOOMS) {
      const [root, third] = bloom.freqs
      const rootPeak = bloom.gain
      const thirdPeak = bloom.gain * 0.62
      scheduleHeartOsc(ctx, master, startAt, bloom.at, root, rootPeak, bloom.dur, 0, stops)
      scheduleHeartOsc(
        ctx,
        master,
        startAt,
        bloom.at,
        root,
        rootPeak * 0.42,
        bloom.dur,
        HEART_DETUNE_CENTS,
        stops,
      )
      scheduleHeartOsc(ctx, master, startAt, bloom.at, third, thirdPeak, bloom.dur * 0.92, 0, stops)
      scheduleHeartOsc(
        ctx,
        master,
        startAt,
        bloom.at,
        third,
        thirdPeak * 0.38,
        bloom.dur * 0.92,
        -HEART_DETUNE_CENTS,
        stops,
      )
    }

    activeStop = () => {
      for (const stop of stops) stop()
    }

    void ctx.resume()
  } catch {
    /* ignore autoplay / Web Audio failures */
  }
}

/** Short procedural SFX when a quick stamp is placed (~150–350ms). */
export function playStampSound(variant: StampVariant): void {
  if (variant === 'heart') {
    playHeartSound()
    return
  }
  playTones(STAMP_SOUND_NOTE_SPECS[variant] ?? STAMP_SOUND_NOTE_SPECS.check)
}

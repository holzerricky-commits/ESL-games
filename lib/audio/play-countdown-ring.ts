type ChimeTone = {
  freq: number
  at: number
  dur: number
  gain?: number
}

const CHIME_PATTERN: readonly ChimeTone[] = [
  { freq: 523.25, at: 0, dur: 0.32, gain: 0.18 },
  { freq: 659.25, at: 0.42, dur: 0.34, gain: 0.2 },
  { freq: 783.99, at: 0.88, dur: 0.5, gain: 0.22 },
]

/** Seconds between each three-note phrase. */
export const COUNTDOWN_RING_CYCLE_SEC = 1.55

/** How many times the phrase repeats. */
export const COUNTDOWN_RING_REPEAT_COUNT = 3

/** End of last note + small tail. Exported for tests. */
export const COUNTDOWN_RING_TOTAL_SEC =
  (COUNTDOWN_RING_REPEAT_COUNT - 1) * COUNTDOWN_RING_CYCLE_SEC + 0.88 + 0.5 + 0.15

export function buildCountdownRingChimes(): readonly ChimeTone[] {
  const chimes: ChimeTone[] = []
  for (let repeat = 0; repeat < COUNTDOWN_RING_REPEAT_COUNT; repeat++) {
    const offset = repeat * COUNTDOWN_RING_CYCLE_SEC
    const level = repeat === 0 ? 1 : repeat === 1 ? 0.95 : 0.9
    for (const tone of CHIME_PATTERN) {
      chimes.push({
        freq: tone.freq,
        at: tone.at + offset,
        dur: tone.dur,
        gain: (tone.gain ?? 0.2) * level,
      })
    }
  }
  return chimes
}

/** All chime events — exported for tests. */
export const COUNTDOWN_RING_CHIMES = buildCountdownRingChimes()

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

/** Resume audio early (e.g. on Start) so the end chime is not blocked by autoplay policy. */
export function warmCountdownAudio(): void {
  try {
    const ctx = getAudioContext()
    if (ctx) void ctx.resume()
  } catch {
    /* ignore */
  }
}

export function stopCountdownRing(): void {
  activeStop?.()
  activeStop = null
}

/** Gentle repeating chime when activity time hits zero (~4.7s). Calls onComplete when done. */
export function playCountdownRing(onComplete?: () => void): void {
  try {
    const ctx = getAudioContext()
    if (!ctx) {
      onComplete?.()
      return
    }

    stopCountdownRing()

    const chimes = buildCountdownRingChimes()
    const startAt = ctx.currentTime + 0.01
    const fadeEnd = startAt + COUNTDOWN_RING_TOTAL_SEC + 0.25

    const master = ctx.createGain()
    master.gain.setValueAtTime(0.0001, startAt)
    master.gain.exponentialRampToValueAtTime(0.09, startAt + 0.02)
    master.gain.setValueAtTime(0.09, startAt + COUNTDOWN_RING_TOTAL_SEC)
    master.gain.exponentialRampToValueAtTime(0.0001, fadeEnd)
    master.connect(ctx.destination)

    const stops: Array<() => void> = []

    for (const chime of chimes) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(chime.freq, startAt + chime.at)
      const peak = chime.gain ?? 0.2
      gain.gain.setValueAtTime(0.0001, startAt + chime.at)
      gain.gain.exponentialRampToValueAtTime(peak, startAt + chime.at + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + chime.at + chime.dur)
      osc.connect(gain)
      gain.connect(master)
      osc.start(startAt + chime.at)
      osc.stop(startAt + chime.at + chime.dur + 0.03)
      stops.push(() => {
        try {
          osc.stop()
        } catch {
          /* already stopped */
        }
      })
    }

    let completeTimeout: ReturnType<typeof setTimeout> | null = null
    let completed = false
    const finish = () => {
      if (completed) return
      completed = true
      if (completeTimeout != null) {
        clearTimeout(completeTimeout)
        completeTimeout = null
      }
      onComplete?.()
    }

    completeTimeout = setTimeout(finish, COUNTDOWN_RING_TOTAL_SEC * 1000)

    activeStop = () => {
      completed = true
      if (completeTimeout != null) {
        clearTimeout(completeTimeout)
        completeTimeout = null
      }
      for (const stop of stops) stop()
      try {
        master.gain.cancelScheduledValues(0)
        master.gain.setValueAtTime(0.0001, ctx.currentTime)
      } catch {
        /* ignore */
      }
    }

    void ctx.resume()
  } catch {
    onComplete?.()
  }
}

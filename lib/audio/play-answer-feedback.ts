let sharedAudioContext: AudioContext | null = null

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

/**
 * Soft low buzz for a wrong reading-check answer (~0.28s).
 * Same Web Audio family as stamp/cross — not a harsh error. Fails silently if blocked.
 */
export function playAnswerIncorrectBuzz(): void {
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    const startAt = ctx.currentTime + 0.01
    const master = ctx.createGain()
    master.gain.setValueAtTime(0.0001, startAt)
    master.gain.exponentialRampToValueAtTime(0.11, startAt + 0.02)
    master.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.28)
    master.connect(ctx.destination)

    const notes = [
      { freq: 220, at: 0, dur: 0.14, type: 'triangle' as OscillatorType, peak: 0.32 },
      { freq: 165, at: 0.1, dur: 0.16, type: 'triangle' as OscillatorType, peak: 0.26 },
    ]

    for (const note of notes) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = note.type
      osc.frequency.setValueAtTime(note.freq, startAt + note.at)
      gain.gain.setValueAtTime(0.0001, startAt + note.at)
      gain.gain.exponentialRampToValueAtTime(note.peak, startAt + note.at + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + note.at + note.dur)
      osc.connect(gain)
      gain.connect(master)
      osc.start(startAt + note.at)
      osc.stop(startAt + note.at + note.dur + 0.02)
    }

    void ctx.resume()
  } catch {
    /* ignore autoplay / Web Audio failures */
  }
}

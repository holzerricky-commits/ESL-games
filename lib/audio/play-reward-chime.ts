let sharedAudioContext: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctx = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return null
  if (!sharedAudioContext) {
    sharedAudioContext = new Ctx()
  }
  return sharedAudioContext
}

/** Create the shared AudioContext early so the first chime is not paying setup cost. */
export function warmRewardAudio(): void {
  try {
    getAudioContext()
  } catch {
    /* ignore */
  }
}

/** Short ascending celebratory chime (~0.4s). Fails silently if autoplay is blocked. */
export function playRewardChime(): void {
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    const startAt = ctx.currentTime + 0.01
    const notes = [
      { freq: 523.25, at: 0, dur: 0.12 },
      { freq: 659.25, at: 0.08, dur: 0.12 },
      { freq: 783.99, at: 0.16, dur: 0.22 },
    ]

    const master = ctx.createGain()
    master.gain.setValueAtTime(0.0001, startAt)
    master.gain.exponentialRampToValueAtTime(0.14, startAt + 0.02)
    master.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.42)
    master.connect(ctx.destination)

    for (const note of notes) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(note.freq, startAt + note.at)
      gain.gain.setValueAtTime(0.0001, startAt + note.at)
      gain.gain.exponentialRampToValueAtTime(0.35, startAt + note.at + 0.02)
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

import { describe, expect, it } from 'vitest'
import {
  HEART_STAMP_SOUND_BLOOMS,
  STAMP_SOUND_NOTE_SPECS,
} from './play-stamp-sound'

const MASTER_FADE_S = 0.38
const HEART_MASTER_FADE_S = 0.42

function noteEndAt(note: { at: number; dur: number }): number {
  return note.at + note.dur
}

function bloomEndAt(bloom: { at: number; dur: number }): number {
  return bloom.at + bloom.dur
}

describe('play-stamp-sound note specs', () => {
  it('star: three ascending high sparkle pings with strongest landing note', () => {
    const notes = STAMP_SOUND_NOTE_SPECS.star
    expect(notes).toHaveLength(3)
    expect(notes[0]!.freq).toBeLessThan(notes[1]!.freq)
    expect(notes[1]!.freq).toBeLessThan(notes[2]!.freq)
    expect(notes[0]!.freq).toBeGreaterThan(900)
    expect(notes[2]!.gain).toBeGreaterThan(notes[0]!.gain ?? 0)
    expect(notes[2]!.gain).toBeGreaterThan(notes[1]!.gain ?? 0)
    expect(noteEndAt(notes[2]!)).toBeLessThanOrEqual(MASTER_FADE_S)
  })

  it('heart: two separated warm blooms with major-third dyads', () => {
    expect(HEART_STAMP_SOUND_BLOOMS).toHaveLength(2)
    const [first, second] = HEART_STAMP_SOUND_BLOOMS
    expect(first!.at).toBe(0)
    expect(second!.at).toBeGreaterThan(bloomEndAt(first!) * 0.85)
    expect(first!.freqs[1]! / first!.freqs[0]!).toBeCloseTo(1.26, 1)
    expect(second!.freqs[0]!).toBeGreaterThan(first!.freqs[0]!)
    expect(bloomEndAt(second!)).toBeLessThanOrEqual(HEART_MASTER_FADE_S)
    expect(STAMP_SOUND_NOTE_SPECS.heart).toHaveLength(0)
  })

  it('check, cross, and question specs are unchanged', () => {
    expect(STAMP_SOUND_NOTE_SPECS.check).toHaveLength(2)
    expect(STAMP_SOUND_NOTE_SPECS.cross).toHaveLength(1)
    expect(STAMP_SOUND_NOTE_SPECS.cross[0]!.type).toBe('triangle')
    expect(STAMP_SOUND_NOTE_SPECS.question).toHaveLength(2)
    expect(STAMP_SOUND_NOTE_SPECS.check[0]!.freq).toBe(659.25)
    expect(STAMP_SOUND_NOTE_SPECS.cross[0]!.freq).toBe(220)
  })
})

import { describe, expect, it } from 'vitest'
import {
  normalizeClassDurationMinutes,
  snapDurationMinutes,
  durationSelectValue,
  isClassDurationPreset,
} from '@/lib/schedule/class-duration'

describe('class-duration', () => {
  it('normalizes and clamps', () => {
    expect(normalizeClassDurationMinutes(45)).toBe(45)
    expect(normalizeClassDurationMinutes(25.9)).toBe(25)
    expect(normalizeClassDurationMinutes(5)).toBe(15)
    expect(normalizeClassDurationMinutes(999)).toBe(180)
    expect(normalizeClassDurationMinutes('50')).toBe(50)
  })

  it('snaps resize to nearest preset', () => {
    expect(snapDurationMinutes(20)).toBe(25)
    expect(snapDurationMinutes(27)).toBe(25)
    expect(snapDurationMinutes(28)).toBe(30)
    expect(snapDurationMinutes(40)).toBe(45)
    expect(snapDurationMinutes(48)).toBe(50)
    expect(snapDurationMinutes(55)).toBe(60)
  })

  it('detects presets vs other', () => {
    expect(isClassDurationPreset(45)).toBe(true)
    expect(isClassDurationPreset(40)).toBe(false)
    expect(durationSelectValue(45)).toBe('45')
    expect(durationSelectValue(40)).toBe('other')
  })
})

import { describe, expect, it } from 'vitest'
import {
  SPREAD_CROSSFADE_CLEANUP_MS,
  SPREAD_CROSSFADE_MS,
  SPREAD_CROSSFADE_RAPID_MS,
} from '@/lib/books/spread-crossfade-config'

describe('spread-crossfade-config', () => {
  it('uses a short crossfade duration for page turns', () => {
    expect(SPREAD_CROSSFADE_MS).toBeGreaterThanOrEqual(70)
    expect(SPREAD_CROSSFADE_MS).toBeLessThanOrEqual(120)
  })

  it('skips crossfade when turns are faster than rapid threshold', () => {
    expect(SPREAD_CROSSFADE_RAPID_MS).toBeGreaterThan(SPREAD_CROSSFADE_MS)
    expect(SPREAD_CROSSFADE_CLEANUP_MS).toBeLessThan(50)
  })
})

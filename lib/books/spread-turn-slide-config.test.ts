import { describe, expect, it } from 'vitest'
import {
  SPREAD_TURN_SLIDE_DISTANCE,
  SPREAD_TURN_SLIDE_MS,
} from '@/lib/books/spread-turn-slide-config'

describe('spread-turn-slide-config', () => {
  it('uses a calm slide duration for page turns', () => {
    expect(SPREAD_TURN_SLIDE_MS).toBeGreaterThanOrEqual(200)
    expect(SPREAD_TURN_SLIDE_MS).toBeLessThanOrEqual(400)
  })

  it('slides a full spread width', () => {
    expect(SPREAD_TURN_SLIDE_DISTANCE).toBe(1)
  })
})

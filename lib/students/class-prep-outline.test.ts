import { describe, expect, it } from 'vitest'
import {
  buildDurationAwareFallbackBlocks,
  getPrepDurationStatus,
  normalizePrepBlocksToDuration,
  sumPrepBlockMinutes,
} from '@/lib/students/class-prep-outline'

describe('class prep outline duration', () => {
  it('normalizes AI blocks to class duration', () => {
    const blocks = normalizePrepBlocksToDuration(
      [
        {
          id: 'a',
          label: 'Warm-up',
          minutes: 6,
          objective: 'Review',
          activityType: 'review',
        },
        {
          id: 'b',
          label: 'Main',
          minutes: 14,
          objective: 'Practice',
          activityType: 'practice',
        },
        {
          id: 'c',
          label: 'Close',
          minutes: 5,
          objective: 'Wrap',
          activityType: 'reflection',
        },
      ],
      50,
    )
    expect(sumPrepBlockMinutes(blocks)).toBe(50)
  })

  it('scales down over-budget outlines', () => {
    const blocks = normalizePrepBlocksToDuration(
      [
        { id: 'a', label: 'A', minutes: 20, objective: '', activityType: 'practice' },
        { id: 'b', label: 'B', minutes: 20, objective: '', activityType: 'practice' },
        { id: 'c', label: 'C', minutes: 20, objective: '', activityType: 'practice' },
      ],
      30,
    )
    expect(sumPrepBlockMinutes(blocks)).toBe(30)
  })

  it('builds fallback blocks that match duration', () => {
    for (const duration of [25, 30, 45, 55, 60]) {
      const blocks = buildDurationAwareFallbackBlocks(duration)
      expect(blocks.length).toBeGreaterThan(0)
      expect(blocks.reduce((sum, block) => sum + block.minutes, 0)).toBe(duration)
    }
  })

  it('reports duration status with tolerance', () => {
    expect(getPrepDurationStatus(48, 50)).toBe('on-target')
    expect(getPrepDurationStatus(40, 50)).toBe('under')
    expect(getPrepDurationStatus(55, 50)).toBe('over')
  })
})

import { describe, expect, it } from 'vitest'
import {
  eraserLineTrailingForReplay,
  strokeToolSkipsCommittedReplayOnLivePaint,
} from '@/lib/books/annotation-live-paint'

describe('annotation-live-paint', () => {
  it('prefers active eraser-line draft when points are sufficient', () => {
    const draft = { tool: 'eraser-line' as const, points: [[0.1, 0.2], [0.2, 0.3]] as [number, number][] }
    const trailing = eraserLineTrailingForReplay(draft, null)
    expect(trailing).toBe(draft)
  })

  it('falls back to live eraser-line draft when local draft is not eraser-line', () => {
    const draft = { tool: 'pen' as const, points: [[0.1, 0.2], [0.2, 0.3]] as [number, number][] }
    const live = { tool: 'eraser-line' as const, points: [[0.3, 0.4], [0.5, 0.6]] as [number, number][] }
    const trailing = eraserLineTrailingForReplay(draft, live)
    expect(trailing).toBe(live)
  })

  it('skips committed replay for live non-eraser-line tools', () => {
    expect(strokeToolSkipsCommittedReplayOnLivePaint('pen')).toBe(true)
    expect(strokeToolSkipsCommittedReplayOnLivePaint('marker')).toBe(true)
    expect(strokeToolSkipsCommittedReplayOnLivePaint('eraser')).toBe(true)
    expect(strokeToolSkipsCommittedReplayOnLivePaint('eraser-line')).toBe(false)
    expect(strokeToolSkipsCommittedReplayOnLivePaint(undefined)).toBe(false)
  })
})

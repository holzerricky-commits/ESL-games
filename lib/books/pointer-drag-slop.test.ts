import { describe, expect, it } from 'vitest'
import { LABEL_DRAG_COMMIT_PX, normDeltaMeetsDragCommit } from '@/lib/books/pointer-drag-slop'

describe('normDeltaMeetsDragCommit', () => {
  it('ignores sub-pixel jitter on a large page', () => {
    expect(normDeltaMeetsDragCommit(0.001, 0, 1200, 900)).toBe(false)
  })

  it('commits a small visual nudge that used to snap back', () => {
    const dx = LABEL_DRAG_COMMIT_PX / 800
    expect(normDeltaMeetsDragCommit(dx, 0, 800, 600)).toBe(true)
  })

  it('does not treat a click with no movement as a drag', () => {
    expect(normDeltaMeetsDragCommit(0, 0, 800, 600)).toBe(false)
  })
})

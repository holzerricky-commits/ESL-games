import { describe, expect, it, beforeEach } from 'vitest'
import {
  BOARD_PASTE_REVEAL_MS,
  boardPasteRevealScaleAtElapsed,
  boardPasteRevealScaleAtProgress,
  clearFinishedPasteReveals,
  getActivePasteRevealIds,
  getPasteRevealScale,
  hasActivePasteReveals,
  registerPasteRevealIds,
  resetPasteRevealRegistry,
} from '@/lib/books/board-paste-reveal'

describe('board-paste-reveal', () => {
  beforeEach(() => {
    resetPasteRevealRegistry()
  })

  it('starts at scale 0 and ends at scale 1', () => {
    expect(boardPasteRevealScaleAtElapsed(0)).toBe(0)
    expect(boardPasteRevealScaleAtElapsed(BOARD_PASTE_REVEAL_MS)).toBe(1)
    expect(boardPasteRevealScaleAtProgress(1)).toBe(1)
  })

  it('overshoots at 70% progress', () => {
    expect(boardPasteRevealScaleAtProgress(0.7)).toBeCloseTo(1.06, 4)
  })

  it('registers ids and returns scale while active', () => {
    const t0 = 1000
    registerPasteRevealIds(['a', 'b'], t0)
    expect(getPasteRevealScale('a', t0)).toBe(0)
    expect(getPasteRevealScale('a', t0 + 200)).toBeGreaterThan(0)
    expect(getPasteRevealScale('a', t0 + BOARD_PASTE_REVEAL_MS)).toBeNull()
    expect(hasActivePasteReveals(t0 + 100)).toBe(true)
    expect(hasActivePasteReveals(t0 + BOARD_PASTE_REVEAL_MS)).toBe(false)
  })

  it('clears finished reveals', () => {
    const t0 = 5000
    registerPasteRevealIds(['x'], t0)
    expect(getActivePasteRevealIds(t0 + 100).has('x')).toBe(true)
    clearFinishedPasteReveals(t0 + BOARD_PASTE_REVEAL_MS)
    expect(getActivePasteRevealIds(t0 + BOARD_PASTE_REVEAL_MS).has('x')).toBe(false)
  })
})

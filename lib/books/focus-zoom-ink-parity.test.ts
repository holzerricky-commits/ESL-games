import { describe, expect, it } from 'vitest'
import { clientToSpreadNorm } from '@/lib/books/spread-canvas-coords'
import { clientPointToSpreadNorm, spreadNormPointToClient } from '@/lib/books/focus-zoom-transform'

/**
 * Phase 2 — ink/stroke pointer mapping uses post-transform getBoundingClientRect().
 * These tests document the contract both code paths must satisfy.
 */
describe('focus-zoom ink parity', () => {
  it('spread-canvas-coords matches focus-zoom helpers on the same rect', () => {
    const rect = { left: 50, top: 40, width: 1200, height: 800 }
    const clientX = 350
    const clientY = 440
    expect(clientToSpreadNorm(rect, clientX, clientY)).toEqual(
      clientPointToSpreadNorm(rect, clientX, clientY),
    )
  })

  it('normalized stroke point survives client round-trip (pen commit anchor)', () => {
    const rect = { left: 0, top: 0, width: 2000, height: 1000 }
    const samples: [number, number][] = [
      [0.12, 0.08],
      [0.5, 0.5],
      [0.91, 0.77],
    ]
    for (const [nx, ny] of samples) {
      const [cx, cy] = spreadNormPointToClient(rect, nx, ny)
      const [rx, ry] = clientPointToSpreadNorm(rect, cx, cy)
      expect(rx).toBeCloseTo(nx, 5)
      expect(ry).toBeCloseTo(ny, 5)
    }
  })
})

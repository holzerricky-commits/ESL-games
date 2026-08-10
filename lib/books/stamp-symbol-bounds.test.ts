import { describe, expect, it } from 'vitest'
import { getAnnotationBounds, orientedSelectionFrameForCommand } from '@/lib/books/annotation-select'
import type { StampAnnotationCommand, StampVariant } from '@/lib/books/annotation-command-types'
import { stampSymbolBoundsNorm } from '@/lib/books/stamp-symbol-bounds'

function stamp(variant: StampVariant): StampAnnotationCommand {
  return {
    kind: 'stamp',
    id: `stamp-${variant}`,
    variant,
    center: [0.5, 0.5],
    color: '#22c55e',
    scale: 1,
  }
}

describe('stamp-symbol-bounds', () => {
  const widthPx = 800
  const heightPx = 600

  it('fits check mark tighter than the old full-circle box', () => {
    const cmd = stamp('check')
    const tight = stampSymbolBoundsNorm(cmd, widthPx, heightPx)
    const select = getAnnotationBounds(cmd, widthPx, heightPx)!
    const oldCircleDiameter = 0.12

    expect(tight.w).toBeLessThan(oldCircleDiameter)
    expect(tight.h).toBeLessThan(oldCircleDiameter)
    expect(select.w).toBeLessThan(oldCircleDiameter)
    expect(select.h).toBeLessThan(oldCircleDiameter)
  })

  it('uses different norm width and height on non-square pages', () => {
    const cmd = stamp('star')
    const bounds = stampSymbolBoundsNorm(cmd, widthPx, heightPx)
    const rPx = Math.min(widthPx, heightPx) * 0.06
    const outerPx = rPx * 0.48 + Math.max(1.5, rPx * 0.14) / 2
    expect(bounds.w).toBeCloseTo((outerPx * 2) / widthPx, 5)
    expect(bounds.h).toBeCloseTo((outerPx * 2) / heightPx, 5)
    expect(bounds.w).not.toBeCloseTo(bounds.h, 2)
  })

  it('oriented selection frame matches getAnnotationBounds for stamps', () => {
    const cmd = stamp('heart')
    const bounds = getAnnotationBounds(cmd, widthPx, heightPx)
    const frame = orientedSelectionFrameForCommand(cmd, widthPx, heightPx)
    expect(frame?.rect).toEqual(bounds)
    expect(frame?.rotationDeg).toBe(0)
  })
})

import { describe, expect, it } from 'vitest'
import { resolveAdjacentAnchorPage } from '@/lib/books/reader-adjacent-turn-step'

describe('resolveAdjacentAnchorPage', () => {
  /** Full PDF page list (same as `getVisiblePdfPages`), not spread anchors only. */
  const spreadVisible = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

  it('steps by one spread in spread mode (two indices in visiblePages)', () => {
    expect(
      resolveAdjacentAnchorPage({
        anchorPage: 2,
        direction: 1,
        visiblePages: spreadVisible,
        isSinglePageMode: false,
      }),
    ).toBe(4)
  })

  it('returns null at end', () => {
    expect(
      resolveAdjacentAnchorPage({
        anchorPage: 10,
        direction: 1,
        visiblePages: spreadVisible,
        isSinglePageMode: false,
      }),
    ).toBeNull()
  })

  it('chains from latest anchor (simulates ref)', () => {
    let anchor = 1
    const a = resolveAdjacentAnchorPage({
      anchorPage: anchor,
      direction: 1,
      visiblePages: spreadVisible,
      isSinglePageMode: false,
    })
    expect(a).toBe(3)
    anchor = a!
    const b = resolveAdjacentAnchorPage({
      anchorPage: anchor,
      direction: 1,
      visiblePages: spreadVisible,
      isSinglePageMode: false,
    })
    expect(b).toBe(5)
  })

  it('steps by one page in single-page mode', () => {
    expect(
      resolveAdjacentAnchorPage({
        anchorPage: 4,
        direction: 1,
        visiblePages: spreadVisible,
        isSinglePageMode: true,
      }),
    ).toBe(5)
  })
})

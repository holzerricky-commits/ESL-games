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
      }),
    ).toBe(4)
  })

  it('returns null at end', () => {
    expect(
      resolveAdjacentAnchorPage({
        anchorPage: 10,
        direction: 1,
        visiblePages: spreadVisible,
      }),
    ).toBeNull()
  })

  it('chains from latest anchor (simulates ref)', () => {
    let anchor = 1
    const a = resolveAdjacentAnchorPage({
      anchorPage: anchor,
      direction: 1,
      visiblePages: spreadVisible,
    })
    expect(a).toBe(3)
    anchor = a!
    const b = resolveAdjacentAnchorPage({
      anchorPage: anchor,
      direction: 1,
      visiblePages: spreadVisible,
    })
    expect(b).toBe(5)
  })
})

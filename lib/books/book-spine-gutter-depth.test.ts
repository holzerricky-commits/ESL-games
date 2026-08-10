import { describe, expect, it } from 'vitest'
import {
  BOOK_SPINE_GUTTER_BOTTOM_CONTACT_BAND_PX,
  BOOK_SPINE_GUTTER_HEAD_TAIL_DIP_PX,
  BOOK_SPINE_GUTTER_SILHOUETTE_PATH_OBJECT_BOX,
  bookSpineGutterBottomConcaveEdgePathData,
  bookSpineGutterBottomContactClipPath,
  bookSpineGutterBottomContactPathData,
  bookSpineGutterSilhouetteClipPath,
  bookSpineGutterSilhouettePathData,
} from '@/lib/books/book-spine-gutter-depth'

describe('bookSpineGutterSilhouettePathData', () => {
  it('keeps vertical sides straight and dips head/tail at center', () => {
    const d = bookSpineGutterSilhouettePathData(40, 800)
    expect(d).toBe(
      `M 0 0 Q 20 ${BOOK_SPINE_GUTTER_HEAD_TAIL_DIP_PX} 40 0 L 40 800 Q 20 ${800 - BOOK_SPINE_GUTTER_HEAD_TAIL_DIP_PX} 0 800 Z`,
    )
  })

  it('clamps dip on very short strips', () => {
    const d = bookSpineGutterSilhouettePathData(8, 8)
    expect(d).toBe('M 0 0 Q 4 4 8 0 L 8 8 Q 4 4 0 8 Z')
  })
})

describe('bookSpineGutterSilhouetteClipPath', () => {
  it('wraps path data for CSS clip-path', () => {
    const clip = bookSpineGutterSilhouetteClipPath(40, 800)
    expect(clip).toMatch(/^path\('/)
    expect(clip).toContain('M 0 0 Q 20 6 40 0')
    expect(clip).toContain('L 40 800 Q 20 794 0 800 Z')
  })

  it('returns none for non-positive dimensions', () => {
    expect(bookSpineGutterSilhouetteClipPath(0, 800)).toBe('none')
    expect(bookSpineGutterSilhouetteClipPath(40, 0)).toBe('none')
  })
})

describe('bookSpineGutterBottomConcaveEdgePathData', () => {
  it('traces only the concave bottom edge for bent desk shadows', () => {
    const bottomDipY = 800 - BOOK_SPINE_GUTTER_HEAD_TAIL_DIP_PX
    expect(bookSpineGutterBottomConcaveEdgePathData(40, 800)).toBe(
      `M 0 800 Q 20 ${bottomDipY} 40 800`,
    )
  })
})

describe('bookSpineGutterBottomContactPathData', () => {
  it('traces the concave bottom edge within a thin band', () => {
    const d = bookSpineGutterBottomContactPathData(40, 800)
    const bandTop = 800 - BOOK_SPINE_GUTTER_BOTTOM_CONTACT_BAND_PX
    const bottomDipY = 800 - BOOK_SPINE_GUTTER_HEAD_TAIL_DIP_PX
    expect(d).toBe(
      `M 0 ${bandTop} L 0 800 Q 20 ${bottomDipY} 40 800 L 40 ${bandTop} Z`,
    )
  })
})

describe('bookSpineGutterBottomContactClipPath', () => {
  it('wraps bottom contact path data for CSS clip-path', () => {
    const clip = bookSpineGutterBottomContactClipPath(40, 800)
    expect(clip).toMatch(/^path\('/)
    expect(clip).toContain('Q 20 794 40 800')
  })
})

describe('BOOK_SPINE_GUTTER_SILHOUETTE_PATH_OBJECT_BOX', () => {
  it('matches the normalized head/tail dip profile', () => {
    expect(BOOK_SPINE_GUTTER_SILHOUETTE_PATH_OBJECT_BOX).toBe(
      'M 0,0 Q 0.5,0.015 1,0 L 1,1 Q 0.5,0.985 0,1 Z',
    )
  })
})

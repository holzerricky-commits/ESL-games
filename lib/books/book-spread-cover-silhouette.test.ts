import { describe, expect, it } from 'vitest'
import { hardcoverShellClipPath } from '@/lib/books/book-spread-cover-silhouette'
import { READER_PAGE_BULGE_SPINE_DIP_PX } from '@/lib/books/reader-page-bulge-clip'

describe('hardcoverShellClipPath', () => {
  it('curves head and tail caps at the spine on two-page spreads', () => {
    const clip = hardcoverShellClipPath({
      widthPx: 1000,
      heightPx: 800,
      spineCenterPx: 500,
      bottomCornerRadiusPx: 4,
      twoPage: true,
    })
    const spineDip = READER_PAGE_BULGE_SPINE_DIP_PX
    expect(clip).toContain(`500 ${spineDip}`)
    expect(clip).toContain(`500 ${800 - spineDip}`)
    expect(clip).toContain('625 0')
    expect(clip).toContain('M 0 4')
  })

  it('uses a rounded rectangle for single-page spreads', () => {
    const clip = hardcoverShellClipPath({
      widthPx: 400,
      heightPx: 560,
      spineCenterPx: 200,
      bottomCornerRadiusPx: 6,
      twoPage: false,
    })
    expect(clip).toContain('Q 400 560')
    expect(clip).not.toContain('500 12')
  })
})

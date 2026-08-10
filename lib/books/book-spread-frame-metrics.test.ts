import { describe, expect, it } from 'vitest'
import {
  BOOK_SPREAD_HARDCOVER_SHELL_RADIUS_PX,
  BOOK_SPREAD_SPINE_STRIP_WIDTH_RATIO,
  bookSpreadCoverSpineBandPx,
  bookSpreadForeEdgeStackBleedPx,
  bookSpreadFrameBookBodyHeightPx,
  bookSpreadFrameBookBodyWidthPx,
  bookSpreadHardcoverLipInsetPx,
  bookSpreadFrameShellHorizontalPaddingPx,
  bookSpreadFrameShellPaddingStyle,
  bookSpreadFrameHorizontalChromePx,
  bookSpreadFrameBookBodyCenterInOuterPx,
  bookSpreadFrameOpticalCenterOffsetYPx,
  bookSpreadFramePageContentCenterYPx,
  bookSpreadFrameReaderVerticalAnchorYPx,
  bookSpreadFrameVerticalChromePx,
  bookSpreadHardcoverShellRadiusPx,
  bookSpreadHorizontalPageWindowInsetPx,
  bookSpreadSpineCenterInCoverPx,
  bookSpreadSpineCenterInPageStackPx,
  bookSpreadSpineStripLayout,
  computeBookSpreadFrameLayoutFitBox,
  computeBookSpreadFrameMetrics,
  computeBookSpreadFrameOuterBox,
} from '@/lib/books/book-spread-frame-metrics'

describe('bookSpreadHardcoverShellRadiusPx', () => {
  it('returns a fixed uniform shell radius', () => {
    expect(bookSpreadHardcoverShellRadiusPx()).toBe(BOOK_SPREAD_HARDCOVER_SHELL_RADIUS_PX)
  })
})

describe('computeBookSpreadFrameMetrics', () => {
  it('scales insets with spread size', () => {
    const small = computeBookSpreadFrameMetrics(400, 560)
    const large = computeBookSpreadFrameMetrics(1200, 1680)
    expect(large.coverInsetPx).toBeGreaterThanOrEqual(small.coverInsetPx)
    expect(large.gutterShadowWidthPx).toBeGreaterThan(small.gutterShadowWidthPx)
  })

  it('derives cover and page-stack insets from spread size', () => {
    const metrics = computeBookSpreadFrameMetrics(900, 1200)
    expect(metrics.coverInsetPx).toBeGreaterThanOrEqual(4)
    expect(metrics.coverInsetTopPx).toBeLessThanOrEqual(metrics.coverInsetPx)
    expect(metrics.coverInsetBottomPx).toBe(metrics.coverInsetTopPx)
    expect(metrics.pageStackBottomInsetPx).toBeLessThanOrEqual(metrics.pageStackInsetPx)
  })
})

describe('bookSpreadFrameShellPaddingStyle', () => {
  it('uses cover lip vertically and lip + stack bleed horizontally', () => {
    const metrics = computeBookSpreadFrameMetrics(900, 1200)
    const contentWidthPx = 900
    const shell = bookSpreadFrameShellPaddingStyle(metrics)
    const bodyWidth = bookSpreadFrameBookBodyWidthPx(contentWidthPx, metrics)
    const lipPx = bookSpreadHardcoverLipInsetPx(metrics)
    const stackBleedPx = bookSpreadForeEdgeStackBleedPx()

    expect(shell.boxSizing).toBe('border-box')
    expect(shell.paddingTop).toBe(metrics.coverInsetTopPx)
    expect(shell.paddingBottom).toBe(metrics.coverInsetBottomPx)
    expect(shell.paddingTop).toBeLessThanOrEqual(lipPx)
    expect(shell.paddingLeft).toBe(lipPx + stackBleedPx)
    expect(shell.paddingRight).toBe(lipPx + stackBleedPx)
    expect(bookSpreadFrameShellHorizontalPaddingPx(metrics)).toBe(lipPx)
    expect(bodyWidth - shell.paddingLeft - shell.paddingRight).toBe(contentWidthPx)
    expect(
      bookSpreadFrameBookBodyHeightPx(1200, metrics) - shell.paddingTop - shell.paddingBottom,
    ).toBe(1200)
    expect(bookSpreadHorizontalPageWindowInsetPx(metrics)).toBe(lipPx + stackBleedPx)
  })
})

describe('computeBookSpreadFrameOuterBox', () => {
  it('is taller and wider than flat page content', () => {
    const outer = computeBookSpreadFrameOuterBox(900, 1200)
    expect(outer.widthPx).toBeGreaterThan(900)
    expect(outer.heightPx).toBeGreaterThan(1200)
  })

  it('allocates symmetric vertical chrome from cover lips', () => {
    const chrome = bookSpreadFrameVerticalChromePx(900, 1200)
    expect(chrome.topPx).toBeGreaterThan(0)
    expect(chrome.bottomPx).toBe(chrome.topPx)
    expect(chrome.totalPx).toBe(
      computeBookSpreadFrameOuterBox(900, 1200).heightPx - 1200,
    )
  })

  it('includes horizontal chrome for cover lips', () => {
    expect(bookSpreadFrameHorizontalChromePx(900, 1200)).toBeGreaterThan(0)
  })

  it('outer box height matches vertical chrome helper', () => {
    const contentH = 1200
    const outer = computeBookSpreadFrameOuterBox(900, contentH)
    const chrome = bookSpreadFrameVerticalChromePx(900, contentH)
    expect(outer.heightPx).toBe(contentH + chrome.totalPx)
  })
})

describe('computeBookSpreadFrameLayoutFitBox', () => {
  it('matches the painted outer box', () => {
    const outer = computeBookSpreadFrameOuterBox(900, 1200)
    const layout = computeBookSpreadFrameLayoutFitBox(900, 1200)
    expect(layout).toEqual({ widthPx: outer.widthPx, heightPx: outer.heightPx })
  })
})

describe('bookSpreadFrameBookBodyCenterInOuterPx', () => {
  it('sits at the outer box midpoint', () => {
    const outer = computeBookSpreadFrameOuterBox(900, 1200)
    const { xPx, yPx } = bookSpreadFrameBookBodyCenterInOuterPx(900, 1200)
    expect(xPx).toBe(outer.widthPx / 2)
    expect(yPx).toBe(outer.heightPx / 2)
  })
})

describe('bookSpreadFramePageContentCenterYPx', () => {
  it('sits below the frame outer top and above the outer bottom', () => {
    const outer = computeBookSpreadFrameOuterBox(900, 1200)
    const centerY = bookSpreadFramePageContentCenterYPx(900, 1200)
    expect(centerY).toBeGreaterThan(0)
    expect(centerY).toBeLessThan(outer.heightPx)
  })
})

describe('bookSpreadFrameReaderVerticalAnchorYPx', () => {
  it('matches page-content center', () => {
    const pageCenterY = bookSpreadFramePageContentCenterYPx(900, 1200)
    const anchorY = bookSpreadFrameReaderVerticalAnchorYPx(900, 1200)
    expect(anchorY).toBe(pageCenterY)
  })
})

describe('bookSpreadFrameOpticalCenterOffsetYPx', () => {
  it('matches half the outer box minus page-content center', () => {
    const outer = computeBookSpreadFrameOuterBox(900, 1200)
    const pageCenterY = bookSpreadFramePageContentCenterYPx(900, 1200)
    const offset = bookSpreadFrameOpticalCenterOffsetYPx(900, 1200)
    expect(offset).toBe(Math.round(outer.heightPx / 2 - pageCenterY))
    expect(offset).toBe(0)
  })
})

describe('book spread spine alignment', () => {
  it('narrows the spine cloth strip by the Phase 1 ratio', () => {
    const { gutterShadowWidthPx } = computeBookSpreadFrameMetrics(900, 1200)
    const contentWidthPx = 900
    const contentHeightPx = 1200
    const metrics = computeBookSpreadFrameMetrics(contentWidthPx, contentHeightPx)
    const bookBodyWidthPx = bookSpreadFrameBookBodyWidthPx(contentWidthPx, metrics)
    const wideBandPx = Math.round(
      Math.max(gutterShadowWidthPx * 2.25, bookBodyWidthPx * 0.12, gutterShadowWidthPx + 16),
    )
    const legacyBandPx = Math.max(4, Math.round((wideBandPx / 3) * 1.75 * 0.8))
    const coverBand = bookSpreadCoverSpineBandPx(gutterShadowWidthPx, bookBodyWidthPx)
    expect(coverBand).toBe(
      Math.max(4, Math.round(legacyBandPx * BOOK_SPREAD_SPINE_STRIP_WIDTH_RATIO)),
    )
    expect(BOOK_SPREAD_SPINE_STRIP_WIDTH_RATIO).toBe(0.88)
  })

  it('aligns cover and page-stack spine centers on one vertical line', () => {
    const { coverInsetPx, pageStackInsetPx } = computeBookSpreadFrameMetrics(900, 1200)
    const contentWidthPx = 900
    const stackBleedPx = bookSpreadForeEdgeStackBleedPx()
    const coverCenter = bookSpreadSpineCenterInCoverPx(contentWidthPx, coverInsetPx, stackBleedPx)
    const pageCenter = bookSpreadSpineCenterInPageStackPx(contentWidthPx, pageStackInsetPx)
    expect(coverCenter).toBe(coverInsetPx + stackBleedPx + contentWidthPx / 2)
    expect(pageCenter).toBe(pageStackInsetPx + contentWidthPx / 2)
    expect(coverCenter - pageCenter).toBe(coverInsetPx - pageStackInsetPx + stackBleedPx)
  })
})

describe('bookSpreadSpineStripLayout', () => {
  it('spans the full hardcover shell height by default', () => {
    const metrics = computeBookSpreadFrameMetrics(900, 1200)
    const bookBodyHeightPx = bookSpreadFrameBookBodyHeightPx(1200, metrics)
    const layout = bookSpreadSpineStripLayout(bookBodyHeightPx, 500, 48)

    expect(layout.spineTopPx).toBe(0)
    expect(layout.spineHeightPx).toBe(bookBodyHeightPx)
    expect(layout.spineLeftPx).toBe(500 - 24)
  })
})

import { describe, expect, it } from 'vitest'
import {
  READER_PAGE_BULGE_CURVE,
  READER_PAGE_BULGE_FORE_EDGE_DIP_PX,
  READER_PAGE_BULGE_PEAK_PERCENT,
  READER_PAGE_BULGE_SPINE_DIP_PX,
  readerPageBulgeClipPath,
  readerPageBulgeClipPathWithForeEdgeBleed,
  readerSpreadBulgeClipPath,
} from '@/lib/books/reader-page-bulge-clip'

describe('READER_PAGE_BULGE_CURVE', () => {
  it('is fully tucked at the gutter and flat at the 25% peak', () => {
    expect(READER_PAGE_BULGE_SPINE_DIP_PX).toBe(14)
    expect(READER_PAGE_BULGE_FORE_EDGE_DIP_PX).toBe(4)
    expect(READER_PAGE_BULGE_CURVE[0]).toEqual([0, READER_PAGE_BULGE_SPINE_DIP_PX])

    const peak = READER_PAGE_BULGE_CURVE.find(([p]) => p === READER_PAGE_BULGE_PEAK_PERCENT)
    expect(peak).toEqual([READER_PAGE_BULGE_PEAK_PERCENT, 0])
  })

  it('keeps the mid-page profile easy while deepening only near the gutter', () => {
    const at10 = READER_PAGE_BULGE_CURVE.find(([p]) => p === 10)
    const at15 = READER_PAGE_BULGE_CURVE.find(([p]) => p === 15)
    expect(at10?.[1]).toBeLessThanOrEqual(3)
    expect(at15?.[1]).toBeLessThanOrEqual(1)
  })

  it('tucks more mildly at the fore-edge than at the gutter', () => {
    expect(READER_PAGE_BULGE_CURVE[READER_PAGE_BULGE_CURVE.length - 1]).toEqual([
      100,
      READER_PAGE_BULGE_FORE_EDGE_DIP_PX,
    ])
    expect(READER_PAGE_BULGE_FORE_EDGE_DIP_PX).toBeLessThan(READER_PAGE_BULGE_SPINE_DIP_PX)
  })
})

describe('readerPageBulgeClipPath', () => {
  it('right page: strong gutter tuck, milder fore-edge tuck', () => {
    const clip = readerPageBulgeClipPath('right', 800)
    const spineDip = READER_PAGE_BULGE_SPINE_DIP_PX
    const foreDip = READER_PAGE_BULGE_FORE_EDGE_DIP_PX
    expect(clip).toMatch(/^polygon\(/)
    expect(clip).toContain(`0% ${spineDip}px`)
    expect(clip).toContain('25% 0px')
    expect(clip).toContain(`100% ${foreDip}px`)
    expect(clip).toContain('25% 800px')
    expect(clip).toContain(`0% ${800 - spineDip}px`)
    expect(clip).toContain(`100% ${800 - foreDip}px`)
    expect(clip).not.toContain('100% 100%')
    expect(clip).not.toContain('100% 800px')
  })

  it('left page mirrors gutter vs fore-edge tucks', () => {
    const clip = readerPageBulgeClipPath('left', 800)
    const spineDip = READER_PAGE_BULGE_SPINE_DIP_PX
    const foreDip = READER_PAGE_BULGE_FORE_EDGE_DIP_PX
    expect(clip).toContain(`100% ${spineDip}px`)
    expect(clip).toContain('75% 0px')
    expect(clip).toContain(`0% ${foreDip}px`)
    expect(clip).toContain(`100% ${800 - spineDip}px`)
    expect(clip).toContain(`0% ${800 - foreDip}px`)
    expect(clip).not.toContain('0% 100%')
  })
})

describe('readerPageBulgeClipPathWithForeEdgeBleed', () => {
  const pageWidth = 400
  const height = 800
  const bleed = 33

  it('left page: outer fan edge at x=0 with fore-edge tuck, page face arch at bleed offset', () => {
    const clip = readerPageBulgeClipPathWithForeEdgeBleed('left', pageWidth, height, bleed)
    const spineDip = READER_PAGE_BULGE_SPINE_DIP_PX
    expect(clip).toMatch(/^polygon\(/)
    expect(clip).toContain('0px 4px')
    expect(clip).toContain('0px 796px')
    expect(clip).toContain(`${bleed}px 4px`)
    expect(clip).toContain(`${bleed + pageWidth}px ${spineDip}px`)
    expect(clip).toContain(`${bleed + pageWidth * 0.75}px 0px`)
  })

  it('right page: outer fan edge beyond page width with mirrored arch', () => {
    const clip = readerPageBulgeClipPathWithForeEdgeBleed('right', pageWidth, height, bleed)
    const spineDip = READER_PAGE_BULGE_SPINE_DIP_PX
    expect(clip).toContain(`0px ${spineDip}px`)
    expect(clip).toContain(`${pageWidth}px 4px`)
    expect(clip).toContain(`${pageWidth + bleed}px 4px`)
    expect(clip).toContain(`${pageWidth + bleed}px 796px`)
    expect(clip).toContain(`${pageWidth * 0.25}px 0px`)
  })
})

describe('readerSpreadBulgeClipPath', () => {
  it('peaks at 25% from the binding center with asymmetric outer edges', () => {
    const clip = readerSpreadBulgeClipPath(1000, 800)
    const spineDip = READER_PAGE_BULGE_SPINE_DIP_PX
    const foreDip = READER_PAGE_BULGE_FORE_EDGE_DIP_PX
    expect(clip).toContain(`500px ${spineDip}px`)
    expect(clip).toContain(`500px ${800 - spineDip}px`)
    expect(clip).toContain('625px 0px')
    expect(clip).toContain('375px 0px')
    expect(clip).toContain(`1000px ${foreDip}px`)
    expect(clip).toContain(`1000px ${800 - foreDip}px`)
    expect(clip).toContain(`0px ${foreDip}px`)
    expect(clip).toContain(`0px ${800 - foreDip}px`)
    expect(clip).not.toContain('1000px 800px')
  })

  it('offsets clip geometry for padded page-stack coordinates', () => {
    const clip = readerSpreadBulgeClipPath(900, 1200, { offsetXPx: 12, spineCenterPx: 450 })
    const spineDip = READER_PAGE_BULGE_SPINE_DIP_PX
    expect(clip).toContain(`462px ${spineDip}px`)
    expect(clip).toContain('574.5px 0px')
  })
})

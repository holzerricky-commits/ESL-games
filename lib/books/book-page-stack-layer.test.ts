import { describe, expect, it } from 'vitest'
import {
  bookForeEdgeStackHeadTailAnchorStyle,
  bookForeEdgeStackHeadTailOutwardOffsetPx,
  bookForeEdgeStackHeadTailWidthPx,
  bookForeEdgeStackOutwardOffsetPx,
  bookForeEdgeStackStripAnchorStyle,
  bookForeEdgeStackStripColors,
  bookForeEdgeStackTotalFanDepthPx,
  bookForeEdgeStackVerticalStripStyle,
  FORE_EDGE_HEAD_TAIL_WIDTH_RATIO,
  FORE_EDGE_STACK_SHEET_COUNT,
  FORE_EDGE_STEP_PX,
  FORE_EDGE_STRIP_WIDTH_PX,
} from '@/lib/books/book-page-stack-layer'

describe('bookForeEdgeStackOutwardOffsetPx', () => {
  it('steps back sheets further out than front sheets', () => {
    expect(bookForeEdgeStackOutwardOffsetPx(0)).toBeGreaterThan(
      bookForeEdgeStackOutwardOffsetPx(FORE_EDGE_STACK_SHEET_COUNT - 1),
    )
    expect(bookForeEdgeStackOutwardOffsetPx(FORE_EDGE_STACK_SHEET_COUNT - 1)).toBe(0)
  })

  it('total fan depth matches sheet count and step', () => {
    expect(bookForeEdgeStackTotalFanDepthPx()).toBe(
      (FORE_EDGE_STACK_SHEET_COUNT - 1) * FORE_EDGE_STEP_PX,
    )
    expect(bookForeEdgeStackOutwardOffsetPx(0)).toBe(bookForeEdgeStackTotalFanDepthPx())
  })
})

describe('bookForeEdgeStackStripAnchorStyle', () => {
  it('anchors strips outward on each side', () => {
    expect(bookForeEdgeStackStripAnchorStyle('right', 0)).toEqual({
      right: -bookForeEdgeStackOutwardOffsetPx(0),
    })
    expect(bookForeEdgeStackStripAnchorStyle('left', 0)).toEqual({
      left: -bookForeEdgeStackOutwardOffsetPx(0),
    })
    expect(bookForeEdgeStackStripAnchorStyle('right', FORE_EDGE_STACK_SHEET_COUNT - 1).right).toBe(0)
    expect(bookForeEdgeStackStripAnchorStyle('left', FORE_EDGE_STACK_SHEET_COUNT - 1).left).toBe(0)
  })
})

describe('fore-edge stack constants', () => {
  it('exposes scaled strip width and color ramp', () => {
    expect(FORE_EDGE_STRIP_WIDTH_PX).toBeGreaterThanOrEqual(4)
    expect(FORE_EDGE_STEP_PX).toBeGreaterThanOrEqual(3)
    expect(bookForeEdgeStackStripColors()).toHaveLength(FORE_EDGE_STACK_SHEET_COUNT)
  })
})

describe('bookForeEdgeStackHeadTailOutwardOffsetPx', () => {
  it('matches vertical strip outward ramp', () => {
    expect(bookForeEdgeStackHeadTailOutwardOffsetPx(0)).toBe(
      bookForeEdgeStackOutwardOffsetPx(0),
    )
  })
})

describe('bookForeEdgeStackHeadTailAnchorStyle', () => {
  it('anchors top/bottom strips at the outer wrapper edge', () => {
    expect(bookForeEdgeStackHeadTailAnchorStyle('left', 'top', 0)).toEqual({
      top: -bookForeEdgeStackHeadTailOutwardOffsetPx(0),
      left: 0,
    })
    expect(bookForeEdgeStackHeadTailAnchorStyle('right', 'bottom', 0)).toEqual({
      bottom: -bookForeEdgeStackHeadTailOutwardOffsetPx(0),
      right: 0,
    })
    expect(bookForeEdgeStackHeadTailAnchorStyle('left', 'top', FORE_EDGE_STACK_SHEET_COUNT - 1).top).toBe(0)
  })
})

describe('bookForeEdgeStackHeadTailWidthPx', () => {
  it('uses the fore-edge width ratio', () => {
    expect(bookForeEdgeStackHeadTailWidthPx(400)).toBe(
      Math.max(FORE_EDGE_STRIP_WIDTH_PX, Math.round(400 * FORE_EDGE_HEAD_TAIL_WIDTH_RATIO)),
    )
  })
})

describe('bookForeEdgeStackVerticalStripStyle', () => {
  it('offsets vertical strips by bleed inside the expanded wrapper', () => {
    const bleed = 33
    expect(bookForeEdgeStackVerticalStripStyle('left', FORE_EDGE_STACK_SHEET_COUNT - 1, bleed, 800)).toEqual({
      top: 0,
      height: 800,
      left: bleed,
    })
    expect(bookForeEdgeStackVerticalStripStyle('right', 0, bleed, 800)).toEqual({
      top: 0,
      height: 800,
      right: bleed - bookForeEdgeStackOutwardOffsetPx(0),
    })
  })
})

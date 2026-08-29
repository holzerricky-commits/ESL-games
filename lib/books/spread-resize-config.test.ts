import { describe, expect, it } from 'vitest'
import { readerPrefetchWidthBucket } from '@/lib/books/reader-page-prefetch-queue'
import {
  SPREAD_RESIZE_COMMIT_IDLE_MS,
  SPREAD_RESIZE_SCALE_EPSILON,
  SPREAD_WORKSPACE_FIT_MOTION_MS,
  pageAreaSizeAfterDeskLeftShift,
  shouldCommitSpreadRenderWidth,
  shouldIgnoreSpreadTargetWidthCorrection,
  spreadRenderLayoutBaseKey,
  spreadResizeScaleIsActive,
} from '@/lib/books/spread-resize-config'

describe('spread-resize-config', () => {
  it('uses a small epsilon for scale-vs-1 comparisons', () => {
    expect(SPREAD_RESIZE_SCALE_EPSILON).toBeGreaterThan(0)
    expect(SPREAD_RESIZE_SCALE_EPSILON).toBeLessThan(0.05)
  })

  it('waits until the workspace fit move can finish before rebuilding', () => {
    expect(SPREAD_WORKSPACE_FIT_MOTION_MS).toBe(240)
    expect(SPREAD_RESIZE_COMMIT_IDLE_MS).toBeGreaterThan(SPREAD_WORKSPACE_FIT_MOTION_MS)
    expect(SPREAD_RESIZE_COMMIT_IDLE_MS).toBeLessThan(400)
  })
})

describe('pageAreaSizeAfterDeskLeftShift', () => {
  it('shrinks the reading area when a side list takes space', () => {
    expect(pageAreaSizeAfterDeskLeftShift({ w: 1200, h: 800 }, 44, 364)).toEqual({
      w: 880,
      h: 800,
    })
  })

  it('grows the reading area when the list closes', () => {
    expect(pageAreaSizeAfterDeskLeftShift({ w: 880, h: 800 }, 364, 44)).toEqual({
      w: 1200,
      h: 800,
    })
  })
})

describe('shouldIgnoreSpreadTargetWidthCorrection', () => {
  it('keeps the predicted size when the live measure is only a little off', () => {
    expect(shouldIgnoreSpreadTargetWidthCorrection(400, 400)).toBe(true)
    expect(shouldIgnoreSpreadTargetWidthCorrection(400, 406)).toBe(true)
    expect(shouldIgnoreSpreadTargetWidthCorrection(400, 407)).toBe(true)
  })

  it('applies a real window resize', () => {
    expect(shouldIgnoreSpreadTargetWidthCorrection(400, 480)).toBe(false)
    expect(shouldIgnoreSpreadTargetWidthCorrection(0, 400)).toBe(false)
  })
})

describe('spreadResizeScaleIsActive', () => {
  it('ignores tiny scale noise around 1', () => {
    expect(spreadResizeScaleIsActive(1)).toBe(false)
    expect(spreadResizeScaleIsActive(1.01)).toBe(false)
    expect(spreadResizeScaleIsActive(0.8)).toBe(true)
    expect(spreadResizeScaleIsActive(1.2)).toBe(true)
  })
})

describe('shouldCommitSpreadRenderWidth', () => {
  it('rebuilds when there is no current width', () => {
    expect(shouldCommitSpreadRenderWidth(0, 400)).toBe(true)
  })

  it('does not rebuild when the book shrinks', () => {
    expect(shouldCommitSpreadRenderWidth(480, 360)).toBe(false)
    expect(shouldCommitSpreadRenderWidth(480, 480)).toBe(false)
  })

  it('does not rebuild for tiny growth in the same size bucket', () => {
    const committed = 400
    const tiny = committed + 4
    expect(readerPrefetchWidthBucket(tiny)).toBe(readerPrefetchWidthBucket(committed))
    expect(shouldCommitSpreadRenderWidth(committed, tiny)).toBe(false)
  })

  it('rebuilds once when the book grows into a larger size bucket', () => {
    expect(shouldCommitSpreadRenderWidth(400, 520)).toBe(true)
  })
})

describe('spreadRenderLayoutBaseKey', () => {
  it('changes when hardcover or page shape changes', () => {
    const open = spreadRenderLayoutBaseKey('b', 'u', true, 0.7)
    expect(spreadRenderLayoutBaseKey('b', 'u', false, 0.7)).not.toBe(open)
    expect(spreadRenderLayoutBaseKey('b', 'u', true, 0.5)).not.toBe(open)
    expect(spreadRenderLayoutBaseKey('b', 'u', true, 0.7)).toBe(open)
  })
})

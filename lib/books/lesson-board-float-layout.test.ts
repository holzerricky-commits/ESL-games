import { describe, expect, it } from 'vitest'
import {
  clampLessonBoardFloatRect,
  defaultLessonBoardFloatRect,
  lessonBoardFloatDisplayMetrics,
  lessonBoardFloatPanelSizePx,
  lessonBoardFloatScaleFromResizeDelta,
  LESSON_BOARD_FLOAT_MAX_SCALE,
  LESSON_BOARD_FLOAT_MIN_SCALE,
} from './lesson-board-float-layout'

describe('lesson-board-float-layout', () => {
  it('clamps scale to min/max', () => {
    expect(lessonBoardFloatPanelSizePx(400, 600, 0.1).widthPx).toBe(
      Math.round(400 * LESSON_BOARD_FLOAT_MIN_SCALE),
    )
    expect(lessonBoardFloatPanelSizePx(400, 600, 2).widthPx).toBe(
      Math.round(400 * LESSON_BOARD_FLOAT_MAX_SCALE),
    )
  })

  it('keeps float rect inside bounds', () => {
    const rect = clampLessonBoardFloatRect(
      { leftPx: 900, topPx: 900, scale: 1 },
      300,
      400,
      500,
      500,
    )
    expect(rect.leftPx).toBe(200)
    expect(rect.topPx).toBe(100)
    expect(rect.scale).toBe(1)
  })

  it('defaults float rect to slot origin', () => {
    expect(defaultLessonBoardFloatRect(24, 12)).toEqual({
      leftPx: 24,
      topPx: 12,
      scale: 1,
    })
  })

  it('resizes proportionally from corner drag', () => {
    const next = lessonBoardFloatScaleFromResizeDelta(1, 400, 600, 40, 0)
    expect(next).toBeCloseTo(1.1, 5)
  })

  it('builds native float display metrics with fixed header', () => {
    const metrics = lessonBoardFloatDisplayMetrics(400, 500, 2400, 0.6, 36)
    expect(metrics.panelWidthPx).toBe(240)
    expect(metrics.canvasViewportHeightPx).toBe(278)
    expect(metrics.panelHeightPx).toBe(314)
    expect(metrics.displayContentHeightPx).toBe(1440)
    expect(metrics.displayScale).toBeCloseTo(0.6, 5)
  })
})

import { describe, expect, it } from 'vitest'
import {
  buildWhiteboardViewportInkConfig,
  lessonBoardCanvasViewportHeightPx,
  lessonBoardRunwayViewportHeightPx,
  lessonBoardWideDefaultContentHeightPx,
  lessonBoardWidePanelAnchorPx,
  lessonBoardWidePanelHeightPx,
  lessonBoardWideSpreadWidthPx,
  resolveLessonBoardPaintHeightPx,
} from '@/lib/books/lesson-board-ink-layout'
import { WHITEBOARD_HEADER_HEIGHT_PX } from '@/components/students/fullscreen-book-overlay/constants'

describe('lesson-board-ink-layout', () => {
  it('lessonBoardRunwayViewportHeightPx uses slot panel for standard pages', () => {
    const slotPanelHeightPx = 776
    expect(
      lessonBoardRunwayViewportHeightPx(
        'standard',
        slotPanelHeightPx,
        WHITEBOARD_HEADER_HEIGHT_PX,
      ),
    ).toBe(lessonBoardCanvasViewportHeightPx(slotPanelHeightPx, WHITEBOARD_HEADER_HEIGHT_PX))
  })

  it('lessonBoardRunwayViewportHeightPx uses compact wide panel height', () => {
    const widePanelHeightPx = 400
    expect(
      lessonBoardRunwayViewportHeightPx(
        'wide',
        776,
        WHITEBOARD_HEADER_HEIGHT_PX,
        widePanelHeightPx,
      ),
    ).toBe(lessonBoardCanvasViewportHeightPx(widePanelHeightPx, WHITEBOARD_HEADER_HEIGHT_PX))
  })

  it('lessonBoardWideSpreadWidthPx applies slot inset on both sides', () => {
    expect(lessonBoardWideSpreadWidthPx(1000, 12)).toBe(976)
  })

  it('lessonBoardWidePanelAnchorPx keeps minimum inset margin', () => {
    const anchor = lessonBoardWidePanelAnchorPx(1000, 800, 976, 400, 12)
    expect(anchor.leftPx).toBe(12)
    expect(anchor.topPx).toBe(200)
  })

  it('lessonBoardWideDefaultContentHeightPx is 16:9 from inset spread width', () => {
    expect(lessonBoardWideDefaultContentHeightPx(640, 12)).toBe(Math.round(616 / (16 / 9)))
  })

  it('lessonBoardWidePanelHeightPx includes header', () => {
    expect(lessonBoardWidePanelHeightPx(360, WHITEBOARD_HEADER_HEIGHT_PX)).toBe(
      360 + WHITEBOARD_HEADER_HEIGHT_PX,
    )
  })

  it('resolveLessonBoardPaintHeightPx prefers measured height', () => {
    expect(resolveLessonBoardPaintHeightPx(2400, 2388)).toBe(2388)
    expect(resolveLessonBoardPaintHeightPx(2400, null)).toBe(2400)
  })

  it('buildWhiteboardViewportInkConfig clamps dimensions', () => {
    expect(buildWhiteboardViewportInkConfig(2400, 740, 100)).toEqual({
      contentHeightPx: 2400,
      viewportHeightPx: 740,
      scrollTopPx: 100,
    })
  })
})

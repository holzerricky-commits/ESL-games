import { describe, expect, it } from 'vitest'
import {
  BOOK_SPREAD_SESSION_LAYER_ELEVATED_Z,
  BOOK_SPREAD_SESSION_LAYER_Z,
  DOM_ABOVE_INK_SESSION_Z_BOOST,
  LESSON_BOARD_PANEL_Z,
  bookSpreadSessionLayerStackZ,
  domSliceZBoostForCommandKind,
  sliceStackZ,
} from '@/components/students/book-page-annotation-layer/constants'

describe('annotation layer z-order helpers', () => {
  it('only boosts text and sticky DOM above session ink', () => {
    expect(domSliceZBoostForCommandKind('text', true)).toBe(DOM_ABOVE_INK_SESSION_Z_BOOST)
    expect(domSliceZBoostForCommandKind('sticky', true)).toBe(DOM_ABOVE_INK_SESSION_Z_BOOST)
    expect(domSliceZBoostForCommandKind('image', true)).toBe(0)
    expect(domSliceZBoostForCommandKind('flashcard', true)).toBe(0)
    expect(domSliceZBoostForCommandKind('image', false)).toBe(0)
  })

  it('keeps later ink slices above earlier pasted images', () => {
    const imageIndex = 3
    const stampIndex = 4
    const imageZ = sliceStackZ(imageIndex) + domSliceZBoostForCommandKind('image', true)
    const stampZ = sliceStackZ(stampIndex)
    expect(stampZ).toBeGreaterThan(imageZ)
  })

  it('keeps spread session ink below the lesson board when the board is open', () => {
    const withSelectionLift = bookSpreadSessionLayerStackZ({
      elevateForSelectionChrome: true,
      lessonBoardObscures: false,
    })
    const boardOpen = bookSpreadSessionLayerStackZ({
      elevateForSelectionChrome: true,
      lessonBoardObscures: true,
    })
    expect(withSelectionLift).toBe(BOOK_SPREAD_SESSION_LAYER_ELEVATED_Z)
    expect(withSelectionLift).toBeGreaterThan(LESSON_BOARD_PANEL_Z)
    expect(boardOpen).toBe(BOOK_SPREAD_SESSION_LAYER_Z)
    expect(boardOpen).toBeLessThan(LESSON_BOARD_PANEL_Z)
  })
})

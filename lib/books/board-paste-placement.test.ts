import { describe, expect, it } from 'vitest'
import { fitImageNormBox } from '@/lib/books/clipboard-image'
import { textPasteNormPoint } from '@/lib/books/clipboard-text'
import {
  boardPasteAnchorFromElementRect,
  pasteOffsetForAnchor,
  setBoardPasteAnchorNorm,
} from '@/lib/books/board-paste-placement'

describe('board paste placement', () => {
  it('fitImageNormBox centers on the click anchor', () => {
    const box = fitImageNormBox(800, 600, 400, 2000, 300, 100, {
      anchorNorm: { x: 0.25, y: 0.4 },
    })
    expect(box.x + box.w / 2).toBeCloseTo(0.25, 4)
    expect(box.y + box.h / 2).toBeCloseTo(0.4, 4)
  })

  it('textPasteNormPoint uses the click anchor when provided', () => {
    const point = textPasteNormPoint(2000, 400, 800, { x: 0.2, y: 0.35 })
    expect(point).toEqual({ x: 0.2, y: 0.35 })
  })

  it('pasteOffsetForAnchor moves the selection center to the anchor', () => {
    const offset = pasteOffsetForAnchor(
      [{ kind: 'rect', id: 'r1', x: 0.1, y: 0.1, w: 0.2, h: 0.2, strokeColor: '#000' }],
      { x: 0.5, y: 0.5 },
      400,
      400,
    )
    expect(offset[0]).toBeCloseTo(0.3)
    expect(offset[1]).toBeCloseTo(0.3)
  })

  it('boardPasteAnchorFromElementRect maps pointer position into board space', () => {
    const anchor = boardPasteAnchorFromElementRect(150, 250, {
      left: 100,
      top: 200,
      width: 400,
      height: 800,
      right: 500,
      bottom: 1000,
      x: 100,
      y: 200,
      toJSON: () => ({}),
    })
    expect(anchor).toEqual({ x: 0.125, y: 0.0625 })
  })

  it('setBoardPasteAnchorNorm stores the latest click anchor', () => {
    setBoardPasteAnchorNorm({ x: 0.33, y: 0.66 })
    expect(pasteOffsetForAnchor([], { x: 0.33, y: 0.66 }, 400, 400)).toEqual([0.02, 0.02])
    setBoardPasteAnchorNorm(null)
  })
})

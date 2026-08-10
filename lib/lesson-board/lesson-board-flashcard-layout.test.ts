import { describe, expect, it } from 'vitest'
import { fitFlashcardNormBox } from '@/lib/lesson-board/lesson-board-flashcard-layout'

describe('lesson-board-flashcard-layout', () => {
  it('fitFlashcardNormBox keeps card smaller than full board width', () => {
    const card = fitFlashcardNormBox(800, 600, 400, 400, 300, 0)
    expect(card.w).toBeLessThan(0.4)
    expect(card.h).toBeGreaterThan(0.05)
    expect(card.y).toBeGreaterThanOrEqual(0)
    expect(card.x + card.w).toBeLessThanOrEqual(1.01)
  })

  it('fitFlashcardNormBox footer makes the card taller than the image area alone', () => {
    const card = fitFlashcardNormBox(400, 300, 500, 500, 400, 0)
    const cardHeightPx = card.h * 500
    const imageOnlyHeightPx = card.w * 500 * (300 / 400)
    expect(cardHeightPx).toBeGreaterThan(imageOnlyHeightPx)
  })
})

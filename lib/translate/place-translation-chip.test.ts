import { describe, expect, it } from 'vitest'
import {
  isTranslationChipText,
  restoreTranslationChipFill,
  TRANSLATION_CHIP_CURSOR_NUDGE_X_PX,
  TRANSLATION_CHIP_FILL,
  TRANSLATION_CHIP_FONT_ID,
  TRANSLATION_CHIP_TEXT,
  translationChipFontSizeNorm,
  translationChipHeightPx,
  translationChipPlacementNorm,
} from './place-translation-chip'

describe('place-translation-chip', () => {
  it('maps ~24px onto spread height as fontSizeNorm', () => {
    expect(translationChipFontSizeNorm(800)).toBeCloseTo(24 / 800, 5)
    expect(translationChipFontSizeNorm(0)).toBeCloseTo(24 / 600, 5)
  })

  it('detects chip annotations by filled + ui-sans + charcoal fill', () => {
    expect(
      isTranslationChipText({
        visualStyle: 'filled',
        fontId: TRANSLATION_CHIP_FONT_ID,
        fillColor: TRANSLATION_CHIP_FILL,
      }),
    ).toBe(true)
    expect(
      isTranslationChipText({
        visualStyle: 'filled',
        fontId: 'sweetkiss-light',
        fillColor: TRANSLATION_CHIP_FILL,
      }),
    ).toBe(false)
  })

  it('restores charcoal when a chip was remapped to white on a prior load', () => {
    expect(
      restoreTranslationChipFill({
        visualStyle: 'filled',
        fontId: TRANSLATION_CHIP_FONT_ID,
        color: TRANSLATION_CHIP_TEXT,
        fillColor: '#ffffff',
      }),
    ).toBe(TRANSLATION_CHIP_FILL)
    expect(
      restoreTranslationChipFill({
        visualStyle: 'filled',
        fontId: TRANSLATION_CHIP_FONT_ID,
        color: TRANSLATION_CHIP_TEXT,
        fillColor: TRANSLATION_CHIP_FILL,
      }),
    ).toBe(TRANSLATION_CHIP_FILL)
    expect(
      restoreTranslationChipFill({
        visualStyle: 'filled',
        fontId: TRANSLATION_CHIP_FONT_ID,
        color: '#1e293b',
        fillColor: '#ffffff',
      }),
    ).toBeUndefined()
  })

  it('places chip with cursor nudge and vertical center — no caret inset', () => {
    const chipH = translationChipHeightPx()
    const placed = translationChipPlacementNorm({
      clientX: 100,
      clientY: 200,
      spreadLeftPx: 0,
      spreadTopPx: 0,
      spreadWidthPx: 1000,
      spreadHeightPx: 800,
    })
    expect(placed.x).toBeCloseTo((100 + TRANSLATION_CHIP_CURSOR_NUDGE_X_PX) / 1000, 5)
    expect(placed.y).toBeCloseTo((200 - chipH / 2) / 800, 5)
    expect(placed.yAnchor).toBe('top')
  })
})

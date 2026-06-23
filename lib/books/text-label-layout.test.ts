import { describe, expect, it } from 'vitest'
import {
  FILLED_TEXT_MEASURE_PAD_PX,
  FILLED_TEXT_PAD_X_PX,
  PLAIN_TEXT_MEASURE_PAD_PX,
  TEXT_LABEL_LINE_HEIGHT_RATIO,
  TEXT_LABEL_PAD_X_PX,
  TEXT_LABEL_PAD_Y_PX,
  TEXT_LABEL_PLACEHOLDER_COLOR,
  TEXT_LABEL_LIGHT_INK_CARET_COLOR,
  textLabelBlockHeightNorm,
  textLabelFieldPaddingCSS,
  textLabelLineHeightPx,
  textLabelPlaceholderColor,
  textLabelPlaceholderFieldCSS,
  textLabelPlaceholderMirrorStyle,
  textLabelEditableFieldChromeCSS,
  caretColorForInk,
  filledTextEmptyTrayColor,
  writableStickyBodyMirrorStyle,
  writableStickyBodyFontSizePx,
  FILLED_TEXT_EMPTY_TRAY_ALPHA,
  textLabelVerticalPadNorm,
} from './text-label-layout'

describe('text-label-layout', () => {
  it('exports pad totals derived from per-side insets', () => {
    expect(PLAIN_TEXT_MEASURE_PAD_PX).toBe(TEXT_LABEL_PAD_X_PX * 2)
    expect(FILLED_TEXT_MEASURE_PAD_PX).toBe(FILLED_TEXT_PAD_X_PX * 2)
  })

  it('vertical pad norm scales with overlay height', () => {
    expect(textLabelVerticalPadNorm(600)).toBeCloseTo((2 * TEXT_LABEL_PAD_Y_PX) / 600, 5)
  })

  it('block height omits vertical pad when heightPx is unknown', () => {
    expect(textLabelBlockHeightNorm(0.04, 2)).toBeCloseTo(0.04 * TEXT_LABEL_LINE_HEIGHT_RATIO * 2, 5)
  })

  it('block height includes vertical pad when heightPx is known', () => {
    const heightPx = 500
    expect(textLabelBlockHeightNorm(0.04, 1, heightPx)).toBeCloseTo(
      0.04 * TEXT_LABEL_LINE_HEIGHT_RATIO + textLabelVerticalPadNorm(heightPx),
      5,
    )
  })

  it('field padding CSS matches per-side tokens', () => {
    expect(textLabelFieldPaddingCSS('plain')).toEqual({
      paddingTop: '4px',
      paddingBottom: '4px',
      paddingLeft: '3px',
      paddingRight: '3px',
    })
    expect(textLabelFieldPaddingCSS('filled')).toEqual({
      paddingTop: '4px',
      paddingBottom: '4px',
      paddingLeft: '6px',
      paddingRight: '6px',
    })
  })

  it('line height px uses shared ratio', () => {
    expect(textLabelLineHeightPx(20)).toBe(26)
  })

  it('placeholder color is neutral and independent of pen ink', () => {
    expect(TEXT_LABEL_PLACEHOLDER_COLOR).toBe('rgba(71, 85, 105, 0.62)')
    expect(textLabelPlaceholderColor()).toBe(TEXT_LABEL_PLACEHOLDER_COLOR)
    expect(textLabelPlaceholderFieldCSS()).toEqual({
      color: TEXT_LABEL_PLACEHOLDER_COLOR,
      '--annotation-placeholder-color': TEXT_LABEL_PLACEHOLDER_COLOR,
    })
  })

  it('caret color is dark for light inks and matches ink otherwise', () => {
    expect(caretColorForInk('#ffffff')).toBe(TEXT_LABEL_LIGHT_INK_CARET_COLOR)
    expect(caretColorForInk('#facc15')).toBe(TEXT_LABEL_LIGHT_INK_CARET_COLOR)
    expect(caretColorForInk('#1e293b')).toBe('#1e293b')
    expect(caretColorForInk('#3b82f6')).toBe('#3b82f6')
    expect(caretColorForInk('#ef4444')).toBe('#ef4444')
  })

  it('filled empty tray uses a faint tint of the fill swatch', () => {
    expect(filledTextEmptyTrayColor('#bfdbfe')).toBe(
      `rgba(191, 219, 254, ${FILLED_TEXT_EMPTY_TRAY_ALPHA})`,
    )
    expect(filledTextEmptyTrayColor('#ffffff')).toBe(
      `rgba(255, 255, 255, ${FILLED_TEXT_EMPTY_TRAY_ALPHA})`,
    )
    expect(filledTextEmptyTrayColor('invalid')).toBe(
      `rgba(226, 232, 240, ${FILLED_TEXT_EMPTY_TRAY_ALPHA})`,
    )
  })

  it('placeholder mirror style merges base layout with neutral placeholder color', () => {
    const base = { fontSize: 16, lineHeight: '21px' }
    expect(textLabelPlaceholderMirrorStyle(base)).toEqual({
      ...base,
      color: TEXT_LABEL_PLACEHOLDER_COLOR,
      '--annotation-placeholder-color': TEXT_LABEL_PLACEHOLDER_COLOR,
    })
  })

  it('editable field chrome bundles placeholder var and caret color', () => {
    expect(textLabelEditableFieldChromeCSS('#ffffff')).toEqual({
      '--annotation-placeholder-color': TEXT_LABEL_PLACEHOLDER_COLOR,
      caretColor: TEXT_LABEL_LIGHT_INK_CARET_COLOR,
    })
    expect(textLabelEditableFieldChromeCSS('#1e293b', { hideCaret: true })).toEqual({
      '--annotation-placeholder-color': TEXT_LABEL_PLACEHOLDER_COLOR,
      caretColor: 'transparent',
    })
  })

  it('writable sticky body uses shared line height and plain padding', () => {
    const style = writableStickyBodyMirrorStyle('Inter', 16, '#1c1917', 'note', 40)
    expect(style.fontSize).toBe(16)
    expect(style.lineHeight).toBe(`${textLabelLineHeightPx(16)}px`)
    expect(style.paddingTop).toBe('4px')
    expect(style.paddingLeft).toBe('3px')
    expect(writableStickyBodyFontSizePx(16, 'caption')).toBe(15)
  })
})

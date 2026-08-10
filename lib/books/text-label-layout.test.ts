import { describe, expect, it } from 'vitest'
import { TEXT_LABEL_PLACEMENT_MIN_WIDTH_NORM } from './text-label-measure'
import {
  FILLED_EDIT_CHROME_INSET_PX,
  FILLED_TEXT_MEASURE_PAD_PX,
  FILLED_TEXT_PAD_X_PX,
  FILLED_TEXT_PAD_Y_PX,
  PLAIN_TEXT_MEASURE_PAD_PX,
  TEXT_LABEL_EMPTY_FIELD_MIN_WIDTH_PX,
  TEXT_LABEL_LINE_HEIGHT_RATIO,
  TEXT_LABEL_PAD_X_PX,
  TEXT_LABEL_PAD_Y_PX,
  TEXT_LABEL_PLACEHOLDER_COLOR,
  TEXT_LABEL_LIGHT_INK_CARET_COLOR,
  textLabelBlockHeightNorm,
  textLabelCaretInsetPx,
  textLabelCenterGrowLeft,
  textLabelEmptyAlignBoxWidthNorm,
  textLabelFieldPaddingCSS,
  textLabelLineHeightPx,
  textLabelPlacementFromClick,
  textLabelPlaceholderColor,
  textLabelPlaceholderFieldCSS,
  textLabelPlaceholderMirrorStyle,
  textLabelEditableFieldChromeCSS,
  caretColorForInk,
  filledTextEmptyTrayColor,
  writableStickyBodyMirrorStyle,
  writableStickyBodyFontSizePx,
  FILLED_TEXT_EMPTY_TRAY_ALPHA,
  FILLED_TEXT_ROW_SLACK_PX,
  textLabelVerticalPadNorm,
  filledPillRowMinPx,
} from './text-label-layout'

const PAGE_W = 1000
const PAGE_H = 800

function caretNormFromPlacement(
  placement: { x: number; y: number },
  align: 'left' | 'center' | 'right',
  variant: 'plain' | 'filled' = 'plain',
  widthPx = PAGE_W,
): { x: number; y: number } {
  const alignW = textLabelEmptyAlignBoxWidthNorm(widthPx, variant)
  const inset = textLabelCaretInsetPx(variant)
  let caretX: number
  if (align === 'center') {
    caretX = placement.x + alignW / 2
  } else if (align === 'right') {
    caretX = placement.x + alignW - inset.x / widthPx
  } else {
    caretX = placement.x + inset.x / widthPx
  }
  return {
    x: caretX,
    y: placement.y + inset.y / PAGE_H,
  }
}

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
      paddingTop: '2px',
      paddingBottom: '2px',
      paddingLeft: '2px',
      paddingRight: '2px',
    })
  })

  it('filled vertical pad is 2px per side', () => {
    expect(FILLED_TEXT_PAD_Y_PX).toBe(2)
    expect(FILLED_TEXT_PAD_X_PX).toBe(2)
  })

  it('filledPillRowMinPx adds row slack for pill backgrounds', () => {
    expect(filledPillRowMinPx(20)).toBe(textLabelLineHeightPx(20) + FILLED_TEXT_ROW_SLACK_PX)
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
    expect(style.textAlign).toBe('start')
    expect(style.minHeight).toBe(40)
    expect(writableStickyBodyFontSizePx(16, 'caption')).toBe(15)
  })

  it('caption stickers center text', () => {
    const caption = writableStickyBodyMirrorStyle('Inter', 16, '#f8fafc', 'caption', 32)
    expect(caption.textAlign).toBe('center')
    expect(caption.minHeight).toBe(32)
  })

  it('speech and thinking bubbles center text without extra field padding', () => {
    const speech = writableStickyBodyMirrorStyle('Inter', 16, '#1c1917', 'speech', 44)
    const thought = writableStickyBodyMirrorStyle('Inter', 16, '#1c1917', 'thought', 48)
    expect(speech.textAlign).toBe('center')
    expect(thought.textAlign).toBe('center')
    expect(speech.padding).toBe(0)
    expect(thought.minHeight).toBeUndefined()
    expect(writableStickyBodyFontSizePx(16, 'speech')).toBe(15)
    expect(writableStickyBodyFontSizePx(16, 'thought')).toBe(15)
  })

  it('caret inset matches field padding and filled chrome', () => {
    expect(textLabelCaretInsetPx('plain')).toEqual({
      x: TEXT_LABEL_PAD_X_PX,
      y: TEXT_LABEL_PAD_Y_PX,
    })
    expect(textLabelCaretInsetPx('filled')).toEqual({
      x: FILLED_EDIT_CHROME_INSET_PX + FILLED_TEXT_PAD_X_PX,
      y: FILLED_EDIT_CHROME_INSET_PX + FILLED_TEXT_PAD_Y_PX,
    })
  })

  it('plain left click top-anchors so first-line mid sits on click', () => {
    const clickX = 0.5
    const clickY = 0.5
    const fontSizeNorm = 0.04
    const minH = textLabelBlockHeightNorm(fontSizeNorm, 1, PAGE_H, 'plain')
    const placement = textLabelPlacementFromClick({
      clickX,
      clickY,
      align: 'left',
      widthPx: PAGE_W,
      heightPx: PAGE_H,
      variant: 'plain',
      fontSizeNorm,
    })
    expect(placement.yAnchor).toBe('top')
    expect(placement.x).toBeCloseTo(clickX - TEXT_LABEL_PAD_X_PX / PAGE_W, 5)
    expect(placement.y).toBeCloseTo(clickY - minH / 2, 5)
    const caret = caretNormFromPlacement(placement, 'left', 'plain')
    expect(caret.x).toBeCloseTo(clickX, 5)
  })

  it('center click uses tight empty box width so caret matches click (not 6% placement box)', () => {
    const clickX = 0.5
    const alignW = textLabelEmptyAlignBoxWidthNorm(PAGE_W, 'plain')
    expect(alignW).toBeCloseTo(TEXT_LABEL_EMPTY_FIELD_MIN_WIDTH_PX / PAGE_W, 5)
    const placement = textLabelPlacementFromClick({
      clickX,
      clickY: 0.5,
      align: 'center',
      widthPx: PAGE_W,
      heightPx: PAGE_H,
      variant: 'plain',
      fontSizeNorm: 0.04,
      placementWidthNorm: TEXT_LABEL_PLACEMENT_MIN_WIDTH_NORM,
    })
    expect(placement.x).toBeCloseTo(clickX - alignW / 2, 5)
    expect(caretNormFromPlacement(placement, 'center').x).toBeCloseTo(clickX, 5)
  })

  it('center and right clicks keep horizontal caret on click', () => {
    const clickX = 0.55
    const clickY = 0.4
    const center = textLabelPlacementFromClick({
      clickX,
      clickY,
      align: 'center',
      widthPx: PAGE_W,
      heightPx: PAGE_H,
      variant: 'plain',
      fontSizeNorm: 0.04,
    })
    expect(caretNormFromPlacement(center, 'center').x).toBeCloseTo(clickX, 5)

    const right = textLabelPlacementFromClick({
      clickX,
      clickY,
      align: 'right',
      widthPx: PAGE_W,
      heightPx: PAGE_H,
      variant: 'plain',
      fontSizeNorm: 0.04,
    })
    expect(caretNormFromPlacement(right, 'right').x).toBeCloseTo(clickX, 5)
  })

  it('center-grow preserves horizontal center while width increases', () => {
    const storedLeft = 0.47
    const prevNorm = TEXT_LABEL_EMPTY_FIELD_MIN_WIDTH_PX / PAGE_W
    const nextNorm = 100 / PAGE_W
    const centerBefore = storedLeft + prevNorm / 2
    const nextLeft = textLabelCenterGrowLeft(storedLeft, prevNorm, nextNorm)
    expect(nextLeft + nextNorm / 2).toBeCloseTo(centerBefore, 5)
    expect(nextLeft).toBeCloseTo(0.424, 3)
  })

  it('filled variant top-anchors vertically and offsets horizontal caret inset', () => {
    const clickX = 0.3
    const clickY = 0.25
    const fontSizeNorm = 0.04
    const minH = textLabelBlockHeightNorm(fontSizeNorm, 1, PAGE_H, 'filled')
    const placement = textLabelPlacementFromClick({
      clickX,
      clickY,
      align: 'left',
      widthPx: PAGE_W,
      heightPx: PAGE_H,
      variant: 'filled',
      fontSizeNorm,
    })
    const inset = textLabelCaretInsetPx('filled')
    expect(placement.yAnchor).toBe('top')
    expect(placement.x).toBeCloseTo(clickX - inset.x / PAGE_W, 5)
    expect(placement.y).toBeCloseTo(clickY - minH / 2, 5)
  })

  it('clamps top edge when click is near the page top', () => {
    const fontSizeNorm = 0.04
    const placement = textLabelPlacementFromClick({
      clickX: 0.2,
      clickY: 0.001,
      align: 'left',
      widthPx: PAGE_W,
      heightPx: PAGE_H,
      variant: 'plain',
      fontSizeNorm,
    })
    expect(placement.yAnchor).toBe('top')
    expect(placement.y).toBeCloseTo(0, 5)
  })

  it('Enter does not move the stored top edge (grows downward only)', () => {
    const fontSizeNorm = 0.04
    const clickY = 0.5
    const placement = textLabelPlacementFromClick({
      clickX: 0.4,
      clickY,
      align: 'left',
      widthPx: PAGE_W,
      heightPx: PAGE_H,
      variant: 'plain',
      fontSizeNorm,
    })
    expect(placement.yAnchor).toBe('top')
    const oneLineH = textLabelBlockHeightNorm(fontSizeNorm, 1, PAGE_H, 'plain')
    const twoLineH = textLabelBlockHeightNorm(fontSizeNorm, 2, PAGE_H, 'plain')
    // Top-anchored: first-line mid stays on click; second line only increases height downward.
    expect(placement.y + oneLineH / 2).toBeCloseTo(clickY, 5)
    expect(placement.y + twoLineH).toBeGreaterThan(placement.y + oneLineH)
    expect(placement.y).toBeLessThan(clickY)
  })
})

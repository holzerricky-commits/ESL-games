import { describe, expect, it } from 'vitest'
import type { TextAnnotationCommand } from '@/lib/books/annotation-command-types'
import {
  measurePlainTextLineWidthPx,
  measureTextLabelBounds,
  textCommandHeuristicBBox,
  TEXT_LABEL_PLACEMENT_MIN_WIDTH_NORM,
} from './text-label-measure'
import {
  TEXT_LABEL_LINE_HEIGHT_RATIO,
  textLabelLineHeightPx,
  textLabelVerticalPadNorm,
} from './text-label-layout'
import { textLabelStackHeightPx } from './text-label-field-layout'

const widthPx = 800
const heightPx = 600

function textCmd(overrides: Partial<TextAnnotationCommand> = {}): TextAnnotationCommand {
  return {
    kind: 'text',
    id: 't1',
    x: 0.1,
    y: 0.1,
    text: 'hello',
    color: '#000',
    fontSizeNorm: 0.04,
    ...overrides,
  }
}

/**
 * @vitest-environment jsdom
 */
describe('text-label-measure', () => {
  it('tight bounds hug short text tighter than the legacy heuristic', () => {
    const cmd = textCmd({ text: 'Hi' })
    const measured = measureTextLabelBounds(cmd, widthPx, heightPx, { mode: 'tight' })
    const legacy = textCommandHeuristicBBox(cmd)
    expect(measured.w).toBeLessThan(legacy.w)
  })

  it('placement mode keeps a minimum box for empty labels', () => {
    const cmd = textCmd({ text: '' })
    const box = measureTextLabelBounds(cmd, widthPx, heightPx, { mode: 'placement' })
    expect(box.w).toBe(TEXT_LABEL_PLACEMENT_MIN_WIDTH_NORM)
  })

  it('width grows with longer draft text', () => {
    const cmd = textCmd()
    const short = measureTextLabelBounds(cmd, widthPx, heightPx, {
      mode: 'tight',
      textOverride: 'ab',
    })
    const long = measureTextLabelBounds(cmd, widthPx, heightPx, {
      mode: 'tight',
      textOverride: 'hello world',
    })
    expect(long.w).toBeGreaterThan(short.w)
  })

  it('multiline labels grow in height', () => {
    const cmd = textCmd({ text: 'line one\nline two' })
    const single = measureTextLabelBounds({ ...cmd, text: 'line one' }, widthPx, heightPx)
    const multi = measureTextLabelBounds(cmd, widthPx, heightPx)
    expect(multi.h).toBeGreaterThan(single.h)
  })

  it('width uses the widest line only', () => {
    const cmd = textCmd({ text: 'a\nhello world' })
    const box = measureTextLabelBounds(cmd, widthPx, heightPx)
    const wideLineOnly = measureTextLabelBounds({ ...cmd, text: 'hello world' }, widthPx, heightPx)
    expect(box.w).toBeCloseTo(wideLineOnly.w, 5)
  })

  it('center anchor shifts top upward', () => {
    const cmd = textCmd({ y: 0.5, yAnchor: 'center', text: 'Hi' })
    const box = measureTextLabelBounds(cmd, widthPx, heightPx)
    expect(box.y).toBeLessThan(0.5)
    expect(box.y + box.h / 2).toBeCloseTo(0.5, 5)
  })

  it('center textAlign keeps bbox left at stored x', () => {
    const anchorX = 0.2
    const left = measureTextLabelBounds(
      textCmd({ x: anchorX, textAlign: 'left', text: 'Hello' }),
      widthPx,
      heightPx,
    )
    const center = measureTextLabelBounds(
      textCmd({ x: anchorX, textAlign: 'center', text: 'Hello' }),
      widthPx,
      heightPx,
    )
    const right = measureTextLabelBounds(
      textCmd({ x: anchorX, textAlign: 'right', text: 'Hello' }),
      widthPx,
      heightPx,
    )
    expect(left.w).toBeCloseTo(center.w, 5)
    expect(center.x).toBeCloseTo(anchorX, 5)
    expect(right.x).toBeCloseTo(anchorX, 5)
    expect(left.x).toBeCloseTo(anchorX, 5)
  })

  it('heuristic bbox uses stored x as left edge', () => {
    const cmd = textCmd({ x: 0.4, textAlign: 'center', text: 'Hello' })
    const box = textCommandHeuristicBBox(cmd)
    expect(box.x).toBeCloseTo(0.4, 5)
  })

  it('line width scales with character count in Node fallback', () => {
    const fontSizePx = 24
    const one = measurePlainTextLineWidthPx('a', undefined, fontSizePx)
    const five = measurePlainTextLineWidthPx('hello', undefined, fontSizePx)
    expect(five).toBeGreaterThan(one)
    expect(five / one).toBeCloseTo(5, 1)
  })

  it('single-line height uses shared line ratio and symmetric vertical pad', () => {
    const cmd = textCmd({ text: 'Hi' })
    const box = measureTextLabelBounds(cmd, widthPx, heightPx)
    const fontSizeNorm = cmd.fontSizeNorm
    const fontSizePx = Math.round(fontSizeNorm * heightPx)
    const lineRowMinPx = textLabelLineHeightPx(fontSizePx)
    const expected = textLabelStackHeightPx(1, lineRowMinPx, true, 'plain') / heightPx
    expect(box.h).toBeCloseTo(expected, 5)
    const lineBlockNorm = lineRowMinPx / heightPx
    expect(box.h).toBeGreaterThan(lineBlockNorm)
    expect(box.h - lineBlockNorm).toBeCloseTo(textLabelVerticalPadNorm(heightPx), 5)
  })

  it('multiline height adds one line block per line plus vertical pad once', () => {
    const cmd = textCmd({ text: 'a\nb\nc' })
    const box = measureTextLabelBounds(cmd, widthPx, heightPx)
    const fontSizePx = Math.round(cmd.fontSizeNorm * heightPx)
    const lineRowMinPx = textLabelLineHeightPx(fontSizePx)
    const expected = textLabelStackHeightPx(3, lineRowMinPx, true, 'plain') / heightPx
    expect(box.h).toBeCloseTo(expected, 5)
    expect(expected).toBeGreaterThan(
      cmd.fontSizeNorm * TEXT_LABEL_LINE_HEIGHT_RATIO * 3,
    )
  })
})

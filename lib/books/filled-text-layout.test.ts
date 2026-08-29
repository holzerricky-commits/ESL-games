import { describe, expect, it } from 'vitest'
import { annotationTextFontFamily } from './annotation-text-fonts'
import {
  computeFilledExplicitLineSegments,
  computeFilledWordWrapSegments,
  createFilledTextLayoutProbe,
  createTextLabelLayoutProbe,
  filledInnerMaxPx,
  filledMaxWidthPx,
  filledPillStackHeightPx,
  FILLED_LINE_GAP_PX,
  layoutTextLabelField,
  measureFilledSegmentWidths,
  measureInkLineWidthPx,
  measureRawLineWidth,
  resolveFilledTextFieldLayout,
  resolveTextLabelFieldLayout,
  textLabelNeedsPageMaxWidth,
} from './filled-text-layout'
import { textLabelInnerMaxPx, textLabelPageMaxWidthPx } from './text-label-field-layout'
import {
  FILLED_EDIT_CHROME_INSET_PX,
  FILLED_TEXT_MEASURE_PAD_PX,
  FILLED_TEXT_PAD_Y_PX,
  filledPillRowMinPx,
} from './text-label-layout'

const overlayWidthPx = 800
const anchorXNorm = 0.1
const fontSizePx = 24
const fontFamily = annotationTextFontFamily(undefined)

describe('filled-text-layout', () => {
  it('filledMaxWidthPx respects anchor and page width', () => {
    expect(filledMaxWidthPx(0, 800)).toBe(796)
    expect(filledMaxWidthPx(0.5, 800)).toBe(396)
  })

  it('filledInnerMaxPx subtracts filled measure padding', () => {
    expect(filledInnerMaxPx(anchorXNorm, overlayWidthPx)).toBeLessThan(
      filledMaxWidthPx(anchorXNorm, overlayWidthPx),
    )
  })

  it('filledPillStackHeightPx matches container pad + rowMinPx rows + inter-row gap', () => {
    const rowMinPx = 21
    expect(filledPillStackHeightPx(1, rowMinPx, true)).toBe(
      rowMinPx + FILLED_TEXT_PAD_Y_PX * 2 + FILLED_LINE_GAP_PX,
    )
    expect(filledPillStackHeightPx(2, rowMinPx, true)).toBe(
      rowMinPx * 2 + FILLED_TEXT_PAD_Y_PX * 2 + 2 * FILLED_LINE_GAP_PX,
    )
    expect(filledPillStackHeightPx(1, rowMinPx, false)).toBe(
      rowMinPx + FILLED_TEXT_PAD_Y_PX * 2,
    )
  })

  it('filledPillRowMinPx includes row slack for descenders', () => {
    expect(filledPillRowMinPx(fontSizePx)).toBeGreaterThan(fontSizePx)
  })

  it('computeFilledExplicitLineSegments splits on newlines only', () => {
    expect(computeFilledExplicitLineSegments('hello\nworld')).toEqual(['hello', 'world'])
    expect(computeFilledExplicitLineSegments('hello\n')).toEqual(['hello', ''])
  })
})

/**
 * @vitest-environment jsdom
 */
describe('filled-text-layout (dom)', () => {
  it('pill widths include field pad and never exceed fieldWidthPx', () => {
    const layout = resolveFilledTextFieldLayout(
      'skupo',
      fontFamily,
      fontSizePx,
      anchorXNorm,
      overlayWidthPx,
    )
    const probe = createFilledTextLayoutProbe(fontFamily, fontSizePx)
    document.body.appendChild(probe)
    const cs = getComputedStyle(probe)
    const widths = measureFilledSegmentWidths(layout.segments, cs, layout.fieldWidthPx)
    const ink = measureInkLineWidthPx(layout.segments[0] ?? 'skupo', cs)
    document.body.removeChild(probe)

    const maxW = Math.max(...widths, 0)
    expect(maxW).toBeLessThanOrEqual(layout.fieldWidthPx + 1)
    expect(widths[0]).toBeGreaterThanOrEqual(ink + FILLED_TEXT_MEASURE_PAD_PX - 1)
    for (const w of widths) {
      expect(w).toBeLessThanOrEqual(layout.fieldWidthPx + 1)
    }
  })

  it('explicit newline produces two pill segments', () => {
    const layout = resolveFilledTextFieldLayout(
      'hello\nworld',
      fontFamily,
      fontSizePx,
      anchorXNorm,
      overlayWidthPx,
      { growOnly: true },
    )
    expect(layout.segments.length).toBe(2)
    expect(layout.segments[0]).toBe('hello')
    expect(layout.segments[1]).toBe('world')
  })

  it('growOnly and full layout agree on width for short single-line text', () => {
    const grow = resolveFilledTextFieldLayout(
      'skupo',
      fontFamily,
      fontSizePx,
      anchorXNorm,
      overlayWidthPx,
      { growOnly: true },
    )
    const full = resolveFilledTextFieldLayout(
      'skupo',
      fontFamily,
      fontSizePx,
      anchorXNorm,
      overlayWidthPx,
    )
    expect(grow.fieldWidthPx).toBe(full.fieldWidthPx)
    expect(grow.segments).toEqual(['skupo'])
  })

  it('latchedMaxWidth expands field to page max width', () => {
    const innerMax = filledInnerMaxPx(anchorXNorm, overlayWidthPx)
    const long = 'W'.repeat(Math.ceil(innerMax / 8) + 20)
    const layout = resolveFilledTextFieldLayout(
      long,
      fontFamily,
      fontSizePx,
      anchorXNorm,
      overlayWidthPx,
      { latchedMaxWidth: true },
    )
    expect(layout.fieldWidthPx).toBe(filledMaxWidthPx(anchorXNorm, overlayWidthPx))
    expect(layout.segments.length).toBeGreaterThanOrEqual(1)
  })

  it('plain text latches at page max width and wraps long lines', () => {
    const innerMax = textLabelInnerMaxPx(anchorXNorm, overlayWidthPx, undefined, 'plain')
    const long = 'W'.repeat(Math.ceil(innerMax / 8) + 20)
    const layout = resolveTextLabelFieldLayout(
      long,
      fontFamily,
      fontSizePx,
      anchorXNorm,
      overlayWidthPx,
      { variant: 'plain', latchedMaxWidth: true },
    )
    expect(layout.fieldWidthPx).toBe(textLabelPageMaxWidthPx(anchorXNorm, overlayWidthPx))
    expect(layout.segments.length).toBeGreaterThanOrEqual(1)
    expect(layout.widths).toEqual([])
  })

  it('plain and filled probes measure ink width in jsdom', () => {
    for (const variant of ['plain', 'filled'] as const) {
      const probe = createTextLabelLayoutProbe(fontFamily, fontSizePx, variant)
      document.body.appendChild(probe)
      const cs = getComputedStyle(probe)
      const raw = measureRawLineWidth('hello world', cs)
      document.body.removeChild(probe)
      expect(raw).toBeGreaterThan(20)
    }
  })

  it('editing latch wraps long line at page max width', () => {
    const probe = createFilledTextLayoutProbe(fontFamily, fontSizePx)
    document.body.appendChild(probe)
    const cs = getComputedStyle(probe)
    const innerMax = filledInnerMaxPx(anchorXNorm, overlayWidthPx)
    const long = 'word '.repeat(Math.ceil(innerMax / 16) + 8)
    const layout = layoutTextLabelField(probe, long, cs, anchorXNorm, overlayWidthPx, {
      variant: 'filled',
      growOnly: true,
      latchedMaxWidth: true,
    })
    const lastSeg = layout.segments[layout.segments.length - 1] ?? ''
    const lastInk = measureInkLineWidthPx(lastSeg, cs)
    document.body.removeChild(probe)
    expect(layout.latchedWhileEditing).toBe(true)
    expect(layout.fieldWidthPx).toBe(filledMaxWidthPx(anchorXNorm, overlayWidthPx))
    expect(layout.widths.length).toBe(layout.segments.length)
    expect(Math.max(...layout.widths)).toBeLessThanOrEqual(layout.fieldWidthPx)
    expect(layout.widths.at(-1)).toBe(
      Math.min(Math.max(lastInk + FILLED_TEXT_MEASURE_PAD_PX, 1), layout.fieldWidthPx),
    )
  })

  it('editing latch auto-detects when ink exceeds inner max', () => {
    const probe = createFilledTextLayoutProbe(fontFamily, fontSizePx)
    document.body.appendChild(probe)
    const cs = getComputedStyle(probe)
    const innerMax = filledInnerMaxPx(anchorXNorm, overlayWidthPx)
    const long = 'W'.repeat(Math.ceil(innerMax / 8) + 24)
    const layout = layoutTextLabelField(probe, long, cs, anchorXNorm, overlayWidthPx, {
      variant: 'filled',
      growOnly: true,
    })
    document.body.removeChild(probe)
    expect(layout.latchedWhileEditing).toBe(true)
    expect(layout.fieldWidthPx).toBe(filledMaxWidthPx(anchorXNorm, overlayWidthPx))
  })

  it('editing without latch keeps multi-word sentence on one row', () => {
    const probe = createFilledTextLayoutProbe(fontFamily, fontSizePx)
    document.body.appendChild(probe)
    const cs = getComputedStyle(probe)
    const layout = layoutTextLabelField(probe, 'Hello world again', cs, anchorXNorm, overlayWidthPx, {
      variant: 'filled',
      growOnly: true,
    })
    document.body.removeChild(probe)
    expect(layout.segments).toEqual(['Hello world again'])
    expect(layout.latchedWhileEditing).toBe(false)
  })

  it('growOnly typing caps field width at page max', () => {
    const probe = createFilledTextLayoutProbe(fontFamily, fontSizePx)
    document.body.appendChild(probe)
    const cs = getComputedStyle(probe)
    const pageMax = filledMaxWidthPx(anchorXNorm, overlayWidthPx)
    const long = 'Look at this long sentence that would wrap at page width'
    const layout = layoutTextLabelField(probe, long, cs, anchorXNorm, overlayWidthPx, {
      variant: 'filled',
      growOnly: true,
    })
    const wrapped = layoutTextLabelField(probe, 'line one\nline two', cs, anchorXNorm, overlayWidthPx, {
      variant: 'filled',
      growOnly: true,
    })
    document.body.removeChild(probe)
    expect(layout.fieldWidthPx).toBeLessThanOrEqual(pageMax)
    expect(wrapped.segments).toEqual(['line one', 'line two'])
  })

  it('growOnly latched wrap prefers word boundaries over mid-word splits', () => {
    const probe = createFilledTextLayoutProbe(fontFamily, fontSizePx)
    document.body.appendChild(probe)
    const cs = getComputedStyle(probe)
    const narrowFieldPx = 140
    const segments = computeFilledWordWrapSegments(
      'hello beautiful world',
      cs,
      narrowFieldPx,
    )
    document.body.removeChild(probe)
    expect(segments.length).toBeGreaterThan(1)
    expect(segments[0]).toBe('hello')
    expect(segments[1]).toMatch(/^beautiful/)
  })

  it('measureInkLineWidthPx counts trailing space width', () => {
    const probe = createFilledTextLayoutProbe(fontFamily, fontSizePx)
    document.body.appendChild(probe)
    const cs = getComputedStyle(probe)
    const noSpace = measureInkLineWidthPx('hello', cs)
    const withSpace = measureInkLineWidthPx('hello ', cs)
    document.body.removeChild(probe)
    expect(withSpace).toBeGreaterThan(noSpace)
  })

  it('growOnly multi-line pills hug each row ink, not full field width', () => {
    const probe = createFilledTextLayoutProbe(fontFamily, fontSizePx)
    document.body.appendChild(probe)
    const cs = getComputedStyle(probe)
    const layout = layoutTextLabelField(probe, 'hello\nworld', cs, anchorXNorm, overlayWidthPx, {
      variant: 'filled',
      growOnly: true,
    })
    document.body.removeChild(probe)
    expect(layout.segments).toEqual(['hello', 'world'])
    expect(layout.widths[0]).toBeLessThan(layout.fieldWidthPx)
    expect(layout.widths[1]).toBeLessThan(layout.fieldWidthPx)
  })

  it('committed single-line filled text stays one pill row (no phantom soft-wrap)', () => {
    const text = 'Hello world again today'
    const editing = resolveFilledTextFieldLayout(
      text,
      fontFamily,
      fontSizePx,
      anchorXNorm,
      overlayWidthPx,
      { growOnly: true },
    )
    const committed = resolveFilledTextFieldLayout(
      text,
      fontFamily,
      fontSizePx,
      anchorXNorm,
      overlayWidthPx,
    )
    expect(editing.segments).toEqual([text])
    expect(committed.segments).toEqual([text])
    expect(committed.widths.length).toBe(1)
    expect(committed.fieldWidthPx).toBe(editing.fieldWidthPx)
  })

  it('committed two explicit lines stay two pill rows', () => {
    const grow = resolveFilledTextFieldLayout(
      'hello\nworld',
      fontFamily,
      fontSizePx,
      anchorXNorm,
      overlayWidthPx,
      { growOnly: true },
    )
    const committed = resolveFilledTextFieldLayout(
      'hello\nworld',
      fontFamily,
      fontSizePx,
      anchorXNorm,
      overlayWidthPx,
    )
    expect(committed.segments.length).toBe(2)
    expect(committed.segments).toEqual(['hello', 'world'])
    expect(committed.fieldWidthPx).toBe(grow.fieldWidthPx)
  })

  it('empty explicit row while editing gets minimal pill width', () => {
    const probe = createFilledTextLayoutProbe(fontFamily, fontSizePx)
    document.body.appendChild(probe)
    const cs = getComputedStyle(probe)
    const layout = layoutTextLabelField(probe, 'hello\n', cs, anchorXNorm, overlayWidthPx, {
      variant: 'filled',
      growOnly: true,
    })
    const widths = measureFilledSegmentWidths(layout.segments, cs, layout.fieldWidthPx)
    document.body.removeChild(probe)
    expect(layout.segments).toEqual(['hello', ''])
    expect(widths[1]).toBe(1)
  })
})

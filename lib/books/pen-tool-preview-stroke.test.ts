import { describe, expect, it } from 'vitest'
import { getPenSwatch } from '@/lib/books/annotation-palettes'
import { buildPenToolPreviewStrokeCommand, PEN_TOOL_PREVIEW_POINTS } from '@/lib/books/pen-tool-preview-stroke'
import { penProfileWidthScaleMultiplier } from '@/lib/books/pen-stroke-profile'
import { thicknessStepToWidthScale } from '@/lib/books/shape-stroke-width-steps'

describe('buildPenToolPreviewStrokeCommand', () => {
  it('uses a stable preview path', () => {
    const cmd = buildPenToolPreviewStrokeCommand({
      penStrokeProfile: 'pen',
      penThicknessStep: 3,
      penLineDashStyle: 'solid',
      penSwatch: getPenSwatch('solid-black'),
      penColorSource: 'swatch',
      penCustomHex: '#ff0000',
    })
    expect(cmd.points).toEqual([...PEN_TOOL_PREVIEW_POINTS])
    expect(cmd.tool).toBe('pen')
  })

  it('resolves solid pen + black swatch', () => {
    const cmd = buildPenToolPreviewStrokeCommand({
      penStrokeProfile: 'pen',
      penThicknessStep: 3,
      penLineDashStyle: 'solid',
      penSwatch: getPenSwatch('solid-black'),
      penColorSource: 'swatch',
      penCustomHex: '#ff0000',
    })
    expect(cmd.color).toBe('#1e293b')
    expect(cmd.penInkStyle).toBe('solid')
    expect(cmd.widthScale).toBeCloseTo(thicknessStepToWidthScale(3) * penProfileWidthScaleMultiplier('pen'))
  })

  it('applies brush width multiplier on thick step', () => {
    const cmd = buildPenToolPreviewStrokeCommand({
      penStrokeProfile: 'brush',
      penThicknessStep: 6,
      penLineDashStyle: 'solid',
      penSwatch: getPenSwatch('solid-blue'),
      penColorSource: 'swatch',
      penCustomHex: '#000000',
    })
    expect(cmd.penStrokeProfile).toBe('brush')
    expect(cmd.widthScale).toBeCloseTo(
      thicknessStepToWidthScale(6) * penProfileWidthScaleMultiplier('brush'),
    )
  })

  it('uses effect ink for effects profile + rainbow swatch', () => {
    const cmd = buildPenToolPreviewStrokeCommand({
      penStrokeProfile: 'effects',
      penThicknessStep: 3,
      penLineDashStyle: 'solid',
      penSwatch: getPenSwatch('fx-rainbow'),
      penColorSource: 'swatch',
      penCustomHex: '#000000',
    })
    expect(cmd.penInkStyle).toBe('rainbow')
  })

  it('uses custom hex and dashed line when set', () => {
    const cmd = buildPenToolPreviewStrokeCommand({
      penStrokeProfile: 'pen',
      penThicknessStep: 2,
      penLineDashStyle: 'dashed',
      penSwatch: getPenSwatch('solid-black'),
      penColorSource: 'custom',
      penCustomHex: '#aabbcc',
    })
    expect(cmd.color).toBe('#aabbcc')
    expect(cmd.penInkStyle).toBe('solid')
    expect(cmd.lineDashStyle).toBe('dashed')
  })
})

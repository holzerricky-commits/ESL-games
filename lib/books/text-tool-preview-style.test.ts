import { describe, expect, it } from 'vitest'
import { textFontSizeNormToPx } from '@/lib/books/text-font-size-pixel'
import { textThicknessStepToFontSizeNorm } from '@/lib/books/text-font-size-steps'
import {
  buildTextToolPreviewFontSizePx,
  buildTextToolPreviewMirrorStyle,
  buildTextToolPreviewTypography,
  TEXT_TOOL_PREVIEW_SAMPLE,
  TEXT_TOOL_PREVIEW_REFERENCE_HEIGHT_PX,
} from '@/lib/books/text-tool-preview-style'

describe('buildTextToolPreviewTypography', () => {
  it('uses sample text for plain and filled', () => {
    const plain = buildTextToolPreviewTypography({
      textFontId: 'sweetkiss-light',
      textVisualStyle: 'plain',
      textAlign: 'left',
      textThicknessStep: 3,
      textColor: '#ef4444',
      textFillColor: '#facc15',
    })
    const filled = buildTextToolPreviewTypography({
      textFontId: 'sweetkiss-light',
      textVisualStyle: 'filled',
      textAlign: 'left',
      textThicknessStep: 3,
      textColor: '#ef4444',
      textFillColor: '#facc15',
    })
    expect(plain.sampleText).toBe(TEXT_TOOL_PREVIEW_SAMPLE)
    expect(filled.sampleText).toBe(TEXT_TOOL_PREVIEW_SAMPLE)
    expect(plain.sampleText).not.toContain('\n')
  })

  it('uses stroke color and font family', () => {
    const typo = buildTextToolPreviewTypography({
      textFontId: 'sweetkiss-light',
      textVisualStyle: 'plain',
      textAlign: 'left',
      textThicknessStep: 3,
      textColor: '#ef4444',
      textFillColor: '#facc15',
    })
    expect(typo.variant).toBe('plain')
    expect(typo.color).toBe('#ef4444')
    expect(typo.fontFamily).toContain('SweetKiss')
  })

  it('uses fill color for filled variant', () => {
    const typo = buildTextToolPreviewTypography({
      textFontId: 'happy-friday',
      textVisualStyle: 'filled',
      textAlign: 'center',
      textThicknessStep: 4,
      textColor: '#1e293b',
      textFillColor: '#facc15',
    })
    expect(typo.variant).toBe('filled')
    expect(typo.fillColor).toBe('#facc15')
    expect(typo.textAlign).toBe('center')
  })

  it('scales font size with thickness step', () => {
    const small = buildTextToolPreviewFontSizePx(0)
    const large = buildTextToolPreviewFontSizePx(7)
    expect(large).toBeGreaterThan(small)
  })

  it('uses live page height when provided', () => {
    const pageH = 900
    const step = 4 as const
    expect(buildTextToolPreviewFontSizePx(step, pageH)).toBe(
      textFontSizeNormToPx(textThicknessStepToFontSizeNorm(step), pageH),
    )
    expect(buildTextToolPreviewFontSizePx(step, pageH)).toBeGreaterThan(
      buildTextToolPreviewFontSizePx(step, TEXT_TOOL_PREVIEW_REFERENCE_HEIGHT_PX),
    )
  })

  it('mirror style carries font and alignment', () => {
    const typo = buildTextToolPreviewTypography({
      textFontId: 'minako-regular',
      textVisualStyle: 'plain',
      textAlign: 'right',
      textThicknessStep: 3,
      textColor: '#3b82f6',
      textFillColor: '#ffffff',
    })
    const mirror = buildTextToolPreviewMirrorStyle(typo)
    expect(mirror.fontSize).toBe(typo.fontSizePx)
    expect(mirror.textAlign).toBe('right')
    expect(mirror.color).toBe('#3b82f6')
  })

  it('applies bold weight for picker fonts', () => {
    const typo = buildTextToolPreviewTypography({
      textFontId: 'lexend',
      textFontWeight: 'bold',
      textVisualStyle: 'plain',
      textAlign: 'left',
      textThicknessStep: 3,
      textColor: '#1e293b',
      textFillColor: '#ffffff',
    })
    expect(typo.fontWeight).toBe(700)
    expect(buildTextToolPreviewMirrorStyle(typo).fontWeight).toBe(700)
  })
})

import { describe, expect, it } from 'vitest'
import { STAMP_DRAW_RADIUS_FACTOR } from '@/lib/books/stamp-symbol-bounds'
import {
  buildStampPreviewDrawParams,
  buildStampPreviewRadiusPx,
  resolveStampPreviewMinDimensionPx,
} from '@/lib/books/stamp-tool-preview-style'
import { TEXT_TOOL_PREVIEW_REFERENCE_HEIGHT_PX } from '@/lib/books/text-tool-preview-style'

describe('resolveStampPreviewMinDimensionPx', () => {
  it('falls back to text preview reference height', () => {
    expect(resolveStampPreviewMinDimensionPx()).toBe(TEXT_TOOL_PREVIEW_REFERENCE_HEIGHT_PX)
    expect(resolveStampPreviewMinDimensionPx(0)).toBe(TEXT_TOOL_PREVIEW_REFERENCE_HEIGHT_PX)
  })

  it('uses measured page height when positive', () => {
    expect(resolveStampPreviewMinDimensionPx(480)).toBe(480)
  })
})

describe('buildStampPreviewRadiusPx', () => {
  it('matches on-book stamp radius formula', () => {
    const pageH = 600
    const scale = 1.2
    expect(buildStampPreviewRadiusPx(scale, pageH)).toBe(
      scale * pageH * STAMP_DRAW_RADIUS_FACTOR,
    )
  })
})

describe('buildStampPreviewDrawParams', () => {
  it('passes question color for question variant', () => {
    const params = buildStampPreviewDrawParams({
      stampVariant: 'question',
      stampQuestionColor: '#ff00aa',
      stampScale: 1,
      pageHeightPx: 600,
    })
    expect(params.variant).toBe('question')
    expect(params.color).toBe('#ff00aa')
    expect(params.radiusPx).toBe(600 * STAMP_DRAW_RADIUS_FACTOR)
  })

  it('uses fixed check color for check variant', () => {
    const params = buildStampPreviewDrawParams({
      stampVariant: 'check',
      stampQuestionColor: '#ff00aa',
      stampScale: 1,
    })
    expect(params.color).not.toBe('#ff00aa')
    expect(params.radiusPx).toBe(
      TEXT_TOOL_PREVIEW_REFERENCE_HEIGHT_PX * STAMP_DRAW_RADIUS_FACTOR,
    )
  })
})

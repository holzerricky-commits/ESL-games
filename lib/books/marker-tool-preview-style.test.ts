import { describe, expect, it } from 'vitest'
import {
  buildMarkerToolPreviewBarHeightPx,
  MARKER_TOOL_PREVIEW_LINE_BASE_PX,
} from '@/lib/books/marker-tool-preview-style'
import { ANNOTATION_STROKE_WIDTH_STEPS } from '@/lib/books/annotation-storage'

describe('buildMarkerToolPreviewBarHeightPx', () => {
  it('scales with marker thickness step', () => {
    const small = buildMarkerToolPreviewBarHeightPx(0)
    const large = buildMarkerToolPreviewBarHeightPx(6)
    expect(large).toBeGreaterThan(small)
    expect(small).toBe(MARKER_TOOL_PREVIEW_LINE_BASE_PX * ANNOTATION_STROKE_WIDTH_STEPS[0])
  })
})

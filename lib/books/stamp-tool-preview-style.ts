import type { StampVariant } from '@/lib/books/annotation-command-types'
import { stampColorForVariant } from '@/lib/books/annotation-palettes'
import { STAMP_DRAW_RADIUS_FACTOR } from '@/lib/books/stamp-symbol-bounds'
import { TEXT_TOOL_PREVIEW_REFERENCE_HEIGHT_PX } from '@/lib/books/text-tool-preview-style'

export type StampToolPreviewDrawParams = {
  variant: StampVariant
  color: string
  radiusPx: number
}

export type StampToolPreviewStyleInput = {
  stampVariant: StampVariant
  stampQuestionColor: string
  stampScale: number
  /** Page/spread canvas height — same reference used for on-book stamp sizing. */
  pageHeightPx?: number
}

export function resolveStampPreviewMinDimensionPx(pageHeightPx?: number): number {
  return pageHeightPx != null && pageHeightPx > 0
    ? pageHeightPx
    : TEXT_TOOL_PREVIEW_REFERENCE_HEIGHT_PX
}

export function buildStampPreviewRadiusPx(stampScale: number, pageHeightPx?: number): number {
  const minDim = resolveStampPreviewMinDimensionPx(pageHeightPx)
  return stampScale * minDim * STAMP_DRAW_RADIUS_FACTOR
}

export function buildStampPreviewDrawParams(
  input: StampToolPreviewStyleInput,
): StampToolPreviewDrawParams {
  return {
    variant: input.stampVariant,
    color: stampColorForVariant(input.stampVariant, input.stampQuestionColor),
    radiusPx: buildStampPreviewRadiusPx(input.stampScale, input.pageHeightPx),
  }
}

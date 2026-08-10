/**
 * Shared field layout for plain and filled text labels — page max width, latch, and soft-wrap.
 * Implementation lives in filled-text-layout.ts; this module is the public unified API.
 */

import {
  FILLED_TEXT_MEASURE_PAD_PX,
  PLAIN_TEXT_MEASURE_PAD_PX,
  textLabelPadYPx,
  type TextLabelFieldVariant,
} from '@/lib/books/text-label-layout'
import { plainTextMaxWidthPx } from '@/lib/books/text-label-measure'

export type {
  TextLabelFieldLayout,
  TextLabelFieldLayoutOpts,
  FilledTextFieldLayout,
  FilledTextFieldLayoutOpts,
} from '@/lib/books/filled-text-layout'

export {
  computeFilledExplicitLineSegments,
  computeFilledVisualLineSegments,
  createTextLabelLayoutProbe,
  layoutTextLabelField,
  resolveTextLabelFieldLayout,
  textLabelNeedsPageMaxWidth,
  filledTextNeedsMaxWidth,
  measureRawLineWidth,
} from '@/lib/books/filled-text-layout'

/** Remaining horizontal space on the page from anchor — both variants share this cap. */
export function textLabelPageMaxWidthPx(
  anchorXNorm: number,
  overlayWidthPx: number,
  maxWidthNorm?: number,
): number {
  return plainTextMaxWidthPx(anchorXNorm, maxWidthNorm, overlayWidthPx)
}

/** Ink width available before latch/wrap (field outer width minus horizontal padding). */
export function textLabelInnerMaxPx(
  anchorXNorm: number,
  overlayWidthPx: number,
  maxWidthNorm: number | undefined,
  variant: TextLabelFieldVariant,
): number {
  const pad = variant === 'filled' ? FILLED_TEXT_MEASURE_PAD_PX : PLAIN_TEXT_MEASURE_PAD_PX
  return textLabelPageMaxWidthPx(anchorXNorm, overlayWidthPx, maxWidthNorm) - pad
}

/** Vertical stack inside the field — symmetric pad + row blocks (+ optional inter-row gap). */
export function textLabelStackHeightPx(
  segmentCount: number,
  rowMinPx: number,
  hasContent: boolean,
  variant: TextLabelFieldVariant,
  lineGapPx = 0,
): number {
  const padY = textLabelPadYPx(variant)
  if (segmentCount <= 0) return rowMinPx + padY * 2
  if (!hasContent) return rowMinPx + padY * 2
  const n = segmentCount
  return padY * 2 + n * rowMinPx + (n - 1) * lineGapPx
}

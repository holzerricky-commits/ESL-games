import type { WritableStickerVariant } from '@/lib/books/annotation-command-types'
import type { AnnotationStrokeThicknessStep } from '@/lib/books/annotation-storage'
import { textThicknessStepToFontSizeNorm } from '@/lib/books/text-font-size-steps'
import { textLabelFontSizePx } from '@/lib/books/text-label-measure'
import {
  DEFAULT_WRITABLE_STICKER_SIZE,
  defaultWritableStickerFill,
} from '@/lib/books/writable-sticker-visuals'
import {
  resolveTextToolPreviewPageHeightPx,
  TEXT_TOOL_PREVIEW_SAMPLE,
} from '@/lib/books/text-tool-preview-style'

export const WRITABLE_STICKER_PREVIEW_WIDTH_PX = 220

export type WritableStickerPreviewLayout = {
  widthPx: number
  heightPx: number
  sampleText: string
}

export function buildWritableStickerPreviewFill(
  variant: WritableStickerVariant,
  stickyFillColor: string,
): string {
  return defaultWritableStickerFill(variant, stickyFillColor)
}

export function buildWritableStickerPreviewFontSizePx(
  stickyThicknessStep: AnnotationStrokeThicknessStep,
  pageHeightPx?: number,
): number {
  const fontSizeNorm = textThicknessStepToFontSizeNorm(stickyThicknessStep)
  return textLabelFontSizePx(fontSizeNorm, resolveTextToolPreviewPageHeightPx(pageHeightPx))
}

export function buildWritableStickerPreviewLayout(
  variant: WritableStickerVariant,
): WritableStickerPreviewLayout {
  const { wNorm, hNorm } = DEFAULT_WRITABLE_STICKER_SIZE[variant]
  const widthPx = WRITABLE_STICKER_PREVIEW_WIDTH_PX
  const heightPx = Math.max(48, Math.round(widthPx * (hNorm / wNorm)))
  return {
    widthPx,
    heightPx,
    sampleText: TEXT_TOOL_PREVIEW_SAMPLE,
  }
}

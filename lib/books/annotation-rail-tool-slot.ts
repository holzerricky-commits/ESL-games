import { isBookOverlayShapeMode } from '@/lib/books/book-overlay-keyboard-shortcuts'
import { isQuickStickerInteraction, type StickerKind } from '@/lib/books/sticker-tool'
import type { BookAnnotationInteractionMode } from '@/lib/books/annotation-storage'

export type AnnotationRailToolSlot =
  | 'pen'
  | 'eyedropper'
  | 'marker'
  | 'shapes'
  | 'stickers'
  | 'text'
  | 'callout'
  | 'eraser'
  | 'focus'
  | 'select'

export function resolveAnnotationRailToolSlot(
  mode: BookAnnotationInteractionMode,
  options?: { stickerKind?: StickerKind; focusZoomDrawActive?: boolean },
): AnnotationRailToolSlot {
  if (options?.focusZoomDrawActive) return 'focus'
  if (mode === 'pen') return 'pen'
  if (mode === 'eyedropper') return 'eyedropper'
  if (mode === 'marker') return 'marker'
  if (isBookOverlayShapeMode(mode)) return 'shapes'
  if (mode === 'sticky' || mode === 'stamp' || isQuickStickerInteraction(mode, options?.stickerKind ?? 'quick')) {
    return 'stickers'
  }
  if (mode === 'text') return 'text'
  if (mode === 'callout') return 'callout'
  if (mode === 'eraser' || mode === 'eraser-line') return 'eraser'
  if (mode === 'select') return 'select'
  return 'select'
}

export function annotationRailSlotDataAttribute(slot: AnnotationRailToolSlot): {
  'data-annotation-rail-slot': AnnotationRailToolSlot
} {
  return { 'data-annotation-rail-slot': slot }
}

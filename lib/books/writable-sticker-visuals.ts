import type { WritableStickerVariant } from '@/lib/books/annotation-command-types'
import {
  ANNOTATION_NEUTRAL_BLACK,
  ANNOTATION_NEUTRAL_WHITE,
  DEFAULT_STICKY_FILL_COLOR,
  stickyNoteChrome,
} from '@/lib/books/annotation-palettes'

export const WRITABLE_STICKER_HEADER_PX = 24

/** Dark outline for comic speech/thought bubbles. */
export const BUBBLE_STICKER_STROKE_COLOR = ANNOTATION_NEUTRAL_BLACK

/** Left overflow room for thought-bubble side dot chain (visual only; not stored in w/h). */
export const THOUGHT_TAIL_SIDE_RESERVE_PX = 18

type VariantLayoutConfig = {
  wNorm: number
  hNorm: number
  minBodyPx: number
  tailReservePx: number
  defaultFill: string
}

const VARIANT_LAYOUT: Record<WritableStickerVariant, VariantLayoutConfig> = {
  note: { wNorm: 0.22, hNorm: 0.11, minBodyPx: 40, tailReservePx: 0, defaultFill: DEFAULT_STICKY_FILL_COLOR },
  caption: { wNorm: 0.32, hNorm: 0.065, minBodyPx: 32, tailReservePx: 0, defaultFill: ANNOTATION_NEUTRAL_BLACK },
  speech: { wNorm: 0.24, hNorm: 0.1, minBodyPx: 44, tailReservePx: 0, defaultFill: ANNOTATION_NEUTRAL_WHITE },
  thought: { wNorm: 0.26, hNorm: 0.12, minBodyPx: 48, tailReservePx: 0, defaultFill: ANNOTATION_NEUTRAL_WHITE },
}

/** Default normalized width / height when placing a new writable sticker. */
export const DEFAULT_WRITABLE_STICKER_SIZE: Record<
  WritableStickerVariant,
  { wNorm: number; hNorm: number }
> = {
  note: { wNorm: VARIANT_LAYOUT.note.wNorm, hNorm: VARIANT_LAYOUT.note.hNorm },
  caption: { wNorm: VARIANT_LAYOUT.caption.wNorm, hNorm: VARIANT_LAYOUT.caption.hNorm },
  speech: { wNorm: VARIANT_LAYOUT.speech.wNorm, hNorm: VARIANT_LAYOUT.speech.hNorm },
  thought: { wNorm: VARIANT_LAYOUT.thought.wNorm, hNorm: VARIANT_LAYOUT.thought.hNorm },
}

/** First-use fill when placing — note uses toolbar sticky color; caption/bubbles have defaults. */
export function defaultWritableStickerFill(
  variant: WritableStickerVariant,
  stickyToolbarFill: string,
): string {
  if (variant === 'note') return stickyToolbarFill || DEFAULT_STICKY_FILL_COLOR
  return VARIANT_LAYOUT[variant].defaultFill
}

export function defaultWritableStickerSize(variant: WritableStickerVariant): {
  wNorm: number
  hNorm: number
} {
  return DEFAULT_WRITABLE_STICKER_SIZE[variant]
}

export type WritableStickerChrome = {
  backgroundColor: string
  headerColor: string
  borderColor: string
  textColor: string
  borderWidthPx: number
  borderStyle: 'solid' | 'dashed'
  shadowClass: string
  tailReservePx: number
  strokeColor: string
}

export function writableStickerChrome(
  variant: WritableStickerVariant,
  fillHex: string,
): WritableStickerChrome {
  const base = stickyNoteChrome(fillHex)
  const layout = VARIANT_LAYOUT[variant]

  if (variant === 'note') {
    return {
      ...base,
      borderWidthPx: 1,
      borderStyle: 'solid',
      shadowClass:
        'shadow-[0_1px_2px_rgba(15,23,42,0.06),0_6px_16px_rgba(15,23,42,0.08)]',
      tailReservePx: 0,
      strokeColor: base.borderColor,
    }
  }

  if (variant === 'caption') {
    return {
      backgroundColor: fillHex,
      headerColor: fillHex,
      borderColor: 'transparent',
      textColor: base.textColor,
      borderWidthPx: 0,
      borderStyle: 'solid',
      shadowClass: 'shadow-[0_2px_10px_rgba(15,23,42,0.22)]',
      tailReservePx: 0,
      strokeColor: 'transparent',
    }
  }

  return {
    backgroundColor: fillHex,
    headerColor: fillHex,
    borderColor: BUBBLE_STICKER_STROKE_COLOR,
    textColor: base.textColor,
    borderWidthPx: 0,
    borderStyle: 'solid',
    shadowClass: 'shadow-[0_1px_3px_rgba(15,23,42,0.12)]',
    tailReservePx: layout.tailReservePx,
    strokeColor: BUBBLE_STICKER_STROKE_COLOR,
  }
}

export function writableStickerLayoutMetrics(
  variant: WritableStickerVariant,
  hNorm: number,
  heightPx: number,
): {
  headerPx: number
  tailReservePx: number
  shellMinPx: number
  bodyMinPx: number
} {
  const layout = VARIANT_LAYOUT[variant]
  const headerPx = variant === 'note' ? WRITABLE_STICKER_HEADER_PX : 0
  const tailReservePx = layout.tailReservePx
  const minBody = layout.minBodyPx
  const coreShellPx = Math.max(minBody + headerPx, hNorm * heightPx)
  const shellMinPx = coreShellPx + tailReservePx
  const bodyMinPx = Math.max(24, coreShellPx - headerPx)
  return { headerPx, tailReservePx, shellMinPx, bodyMinPx }
}

import type { WritableStickerVariant } from '@/lib/books/annotation-command-types'
import { DEFAULT_STICKY_FILL_COLOR, stickyNoteChrome } from '@/lib/books/annotation-palettes'

export const WRITABLE_STICKER_HEADER_PX = 24
export const WRITABLE_STICKER_SPEECH_TAIL_PX = 16
export const WRITABLE_STICKER_THOUGHT_TAIL_PX = 22

/** Default normalized width / height when placing a new writable sticker. */
export const DEFAULT_WRITABLE_STICKER_SIZE: Record<
  WritableStickerVariant,
  { wNorm: number; hNorm: number }
> = {
  note: { wNorm: 0.22, hNorm: 0.11 },
  speech: { wNorm: 0.28, hNorm: 0.1 },
  thought: { wNorm: 0.26, hNorm: 0.095 },
  caption: { wNorm: 0.32, hNorm: 0.065 },
}

/** First-use fill when placing — note uses toolbar sticky color; bubbles have their own defaults. */
export function defaultWritableStickerFill(
  variant: WritableStickerVariant,
  stickyToolbarFill: string,
): string {
  if (variant === 'note') return stickyToolbarFill || DEFAULT_STICKY_FILL_COLOR
  if (variant === 'speech' || variant === 'thought') return '#ffffff'
  return '#1e293b'
}

export function defaultWritableStickerSize(variant: WritableStickerVariant): {
  wNorm: number
  hNorm: number
} {
  return DEFAULT_WRITABLE_STICKER_SIZE[variant]
}

function fillLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
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
}

export function writableStickerChrome(
  variant: WritableStickerVariant,
  fillHex: string,
): WritableStickerChrome {
  const base = stickyNoteChrome(fillHex)
  const lum = fillLuminance(fillHex)
  const inkBorder = lum > 0.72 ? 'rgba(30, 41, 59, 0.78)' : 'rgba(255, 255, 255, 0.42)'

  if (variant === 'note') {
    return {
      ...base,
      borderWidthPx: 1,
      borderStyle: 'solid',
      shadowClass:
        'shadow-[0_1px_2px_rgba(15,23,42,0.06),0_6px_16px_rgba(15,23,42,0.08)]',
      tailReservePx: 0,
    }
  }

  if (variant === 'speech') {
    return {
      backgroundColor: fillHex,
      headerColor: fillHex,
      borderColor: inkBorder,
      textColor: base.textColor,
      borderWidthPx: 2,
      borderStyle: 'solid',
      shadowClass: 'shadow-[0_2px_8px_rgba(15,23,42,0.12),0_1px_2px_rgba(15,23,42,0.06)]',
      tailReservePx: WRITABLE_STICKER_SPEECH_TAIL_PX,
    }
  }

  if (variant === 'thought') {
    return {
      backgroundColor: fillHex,
      headerColor: fillHex,
      borderColor: inkBorder,
      textColor: base.textColor,
      borderWidthPx: 2,
      borderStyle: 'dashed',
      shadowClass: 'shadow-[0_2px_6px_rgba(15,23,42,0.08)]',
      tailReservePx: WRITABLE_STICKER_THOUGHT_TAIL_PX,
    }
  }

  return {
    backgroundColor: fillHex,
    headerColor: fillHex,
    borderColor: 'transparent',
    textColor: base.textColor,
    borderWidthPx: 0,
    borderStyle: 'solid',
    shadowClass: 'shadow-[0_2px_10px_rgba(15,23,42,0.22)]',
    tailReservePx: 0,
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
  const chrome = writableStickerChrome(variant, '#ffffff')
  const headerPx = variant === 'note' ? WRITABLE_STICKER_HEADER_PX : 0
  const tailReservePx = chrome.tailReservePx
  const minBody = variant === 'caption' ? 32 : 40
  const coreShellPx = Math.max(minBody + headerPx, hNorm * heightPx)
  const shellMinPx = coreShellPx + tailReservePx
  const bodyMinPx = Math.max(24, coreShellPx - headerPx)
  return { headerPx, tailReservePx, shellMinPx, bodyMinPx }
}

import type { BookAnnotationInteractionMode } from '@/lib/books/annotation-storage'
import type { StampVariant, WritableStickerVariant } from '@/lib/books/annotation-command-types'

/** Quick tap stickers (canvas symbols) vs writable cards (DOM text). */
export type StickerKind = 'quick' | 'writable'

export const STICKER_QUICK_VARIANTS = [
  'check',
  'cross',
  'question',
  'star',
  'heart',
] as const satisfies readonly StampVariant[]

export const WRITABLE_STICKER_VARIANTS = ['note', 'caption', 'speech', 'thought'] as const

export const STICKER_QUICK_LABEL: Record<StampVariant, string> = {
  check: 'Check',
  cross: 'Cross',
  question: 'Question',
  star: 'Star',
  heart: 'Heart',
}

export const WRITABLE_STICKER_LABEL: Record<WritableStickerVariant, string> = {
  note: 'Note',
  caption: 'Caption',
  speech: 'Speech',
  thought: 'Thinking',
}

export function isStickerQuickVariant(v: unknown): v is StampVariant {
  return typeof v === 'string' && (STICKER_QUICK_VARIANTS as readonly string[]).includes(v)
}

export function isWritableStickerVariant(v: unknown): v is WritableStickerVariant {
  return typeof v === 'string' && (WRITABLE_STICKER_VARIANTS as readonly string[]).includes(v)
}

export function normalizeWritableStickerVariant(v: unknown): WritableStickerVariant {
  if (v === 'caption') return 'caption'
  if (v === 'speech') return 'speech'
  if (v === 'thought') return 'thought'
  if (v === 'note') return 'note'
  return 'note'
}

/** Caption and comic bubbles center text horizontally and vertically. */
export function isCenteredWritableStickerVariant(variant: WritableStickerVariant): boolean {
  return variant === 'caption' || variant === 'speech' || variant === 'thought'
}

/** Map legacy toolbar modes to the unified sticker tool. */
export function normalizeInteractionMode(mode: BookAnnotationInteractionMode): BookAnnotationInteractionMode {
  if (mode === 'stamp' || mode === 'sticky') return 'sticker'
  return mode
}

export function resolveStickerKindFromLegacyMode(
  mode: BookAnnotationInteractionMode,
  storedKind: StickerKind | undefined,
): StickerKind {
  if (storedKind === 'quick' || storedKind === 'writable') return storedKind
  if (mode === 'stamp') return 'quick'
  if (mode === 'sticky') return 'writable'
  return 'quick'
}

export function isQuickStickerInteraction(
  mode: BookAnnotationInteractionMode,
  stickerKind: StickerKind,
): boolean {
  const m = normalizeInteractionMode(mode)
  if (m === 'stamp') return true
  if (m === 'sticky') return false
  return m === 'sticker' && stickerKind === 'quick'
}

/** Tap-to-place canvas tools (quick stickers, callouts, eyedropper) on ink session layers. */
export function isSessionTapCanvasToolInteraction(
  mode: BookAnnotationInteractionMode,
  stickerKind: StickerKind,
): boolean {
  return (
    mode === 'stamp' ||
    mode === 'callout' ||
    mode === 'eyedropper' ||
    isQuickStickerInteraction(mode, stickerKind)
  )
}

export function isWritableStickerInteraction(
  mode: BookAnnotationInteractionMode,
  stickerKind: StickerKind,
): boolean {
  const m = normalizeInteractionMode(mode)
  if (m === 'sticky') return true
  if (m === 'stamp') return false
  return m === 'sticker' && stickerKind === 'writable'
}

export function stickyWritableVariant(
  cmd: { writableVariant?: WritableStickerVariant | 'speech' | 'thought' },
): WritableStickerVariant {
  return normalizeWritableStickerVariant(cmd.writableVariant)
}

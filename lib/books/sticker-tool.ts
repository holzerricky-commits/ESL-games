import type { BookAnnotationInteractionMode } from '@/lib/books/annotation-storage'
import type { StampVariant, WritableStickerVariant } from '@/lib/books/annotation-command-types'

/**
 * Sticker tool kinds. `'writable'` is retired (legacy prefs / types only);
 * new stickers are always quick tap symbols. Existing sticky annotations still render.
 */
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
  _mode: BookAnnotationInteractionMode,
  _storedKind: StickerKind | undefined,
): StickerKind {
  return 'quick'
}

export function isQuickStickerInteraction(
  mode: BookAnnotationInteractionMode,
  _stickerKind: StickerKind,
): boolean {
  const m = normalizeInteractionMode(mode)
  if (m === 'stamp') return true
  if (m === 'sticky') return false
  return m === 'sticker'
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

/** Writable sticker creation is retired; always false. Legacy stickies still render/edit via select. */
export function isWritableStickerInteraction(
  _mode: BookAnnotationInteractionMode,
  _stickerKind: StickerKind,
): boolean {
  return false
}

export function stickyWritableVariant(
  cmd: { writableVariant?: WritableStickerVariant | 'speech' | 'thought' },
): WritableStickerVariant {
  return normalizeWritableStickerVariant(cmd.writableVariant)
}

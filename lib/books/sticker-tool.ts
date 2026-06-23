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
  'thumbsUp',
  'repeat',
  'yourTurn',
  'newWord',
] as const satisfies readonly StampVariant[]

export const WRITABLE_STICKER_VARIANTS = ['note', 'speech', 'thought', 'caption'] as const

export const STICKER_QUICK_LABEL: Record<StampVariant, string> = {
  check: 'Check',
  cross: 'Cross',
  question: 'Question',
  star: 'Star',
  heart: 'Heart',
  thumbsUp: 'Thumbs up',
  repeat: 'Repeat',
  yourTurn: 'Your turn',
  newWord: 'New word',
}

export const WRITABLE_STICKER_LABEL: Record<WritableStickerVariant, string> = {
  note: 'Note',
  speech: 'Speech',
  thought: 'Thought',
  caption: 'Caption',
}

export function isStickerQuickVariant(v: unknown): v is StampVariant {
  return typeof v === 'string' && (STICKER_QUICK_VARIANTS as readonly string[]).includes(v)
}

export function isWritableStickerVariant(v: unknown): v is WritableStickerVariant {
  return typeof v === 'string' && (WRITABLE_STICKER_VARIANTS as readonly string[]).includes(v)
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
  cmd: { writableVariant?: WritableStickerVariant },
): WritableStickerVariant {
  return cmd.writableVariant ?? 'note'
}

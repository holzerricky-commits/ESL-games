import { wordTileIndex } from '@/lib/lesson-vault/word-tile'

/** Shared look for vault cards (side panel and Review). */
export const VAULT_CARD_FRONT =
  'border-white/10 bg-gradient-to-br from-[#36363d] to-[#26262b] shadow-[0_8px_22px_rgba(0,0,0,0.38)] ring-1 ring-inset ring-white/[0.05]'

export const VAULT_CARD_BACK =
  'border-sky-400/25 bg-gradient-to-br from-sky-500/[0.16] via-[#2a2d38] to-indigo-500/[0.12] shadow-[0_8px_22px_rgba(0,0,0,0.38)]'

export const VAULT_PART_PILL =
  'rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/75 backdrop-blur-sm'

/** Warm paper look for word flashcards (both faces). */
export const VAULT_PAPER_CARD = 'bg-[#F6F2E9] text-[#292B27]'

/** Soft shapes behind cutout pictures; full class strings so Tailwind sees every colour. */
const PAPER_BLOBS = ['bg-[#E9D9C2]', 'bg-[#E8DFAF]', 'bg-[#D9E2E1]', 'bg-[#D8E3D8]', 'bg-[#E7DFD3]'] as const

export function paperBlob(word: string): string {
  return PAPER_BLOBS[wordTileIndex(word, PAPER_BLOBS.length)]!
}

export const VAULT_CARD_HOVER =
  'transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(0,0,0,0.45)] motion-reduce:transition-none motion-reduce:hover:translate-y-0'

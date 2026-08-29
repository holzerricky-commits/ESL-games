'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** On-page listening / board / check / exercise badges. */
export const BOOK_PAGE_LINK_CHIP_SIZE_PX = 24

/** Shared drawing for Lucide marks inside page pins. */
export const BOOK_PAGE_LINK_GLYPH_CLASS = 'h-3.5 w-3.5'
export const BOOK_PAGE_LINK_GLYPH_STROKE = 2
export const BOOK_PAGE_LINK_GLYPH_FILL_OPACITY = 0.2

export type BookPageLinkChipTone =
  | 'audio'
  | 'board'
  | 'check'
  | 'check-correct'
  | 'check-incorrect'
  | 'check-skip'
  | 'exercise'

/** Same shine on every color: light top → saturated bottom. */
const TONE_CLASS: Record<BookPageLinkChipTone, string> = {
  audio:
    'border-white/30 bg-gradient-to-b from-[#64D2FF] to-[#007AFF] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_1px_5px_rgba(0,122,255,0.38)]',
  board:
    'border-white/30 bg-gradient-to-b from-[#7DF0D4] to-[#00C7BE] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_1px_5px_rgba(0,199,190,0.36)]',
  check:
    'border-white/30 bg-gradient-to-b from-[#FFD426] to-[#FF9F0A] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_1px_5px_rgba(255,159,10,0.38)]',
  'check-correct':
    'border-white/30 bg-gradient-to-b from-[#7BE8A0] to-[#34C759] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_1px_5px_rgba(52,199,89,0.36)]',
  'check-incorrect':
    'border-white/30 bg-gradient-to-b from-[#FF8A90] to-[#FF453A] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_1px_5px_rgba(255,69,58,0.36)]',
  'check-skip':
    'border-white/25 bg-gradient-to-b from-[#D1D1D6] to-[#8E8E93] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_1px_5px_rgba(142,142,147,0.32)]',
  exercise:
    'border-white/30 bg-gradient-to-b from-[#E0B0FF] to-[#AF52DE] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_1px_5px_rgba(175,82,222,0.38)]',
}

type BookPageLinkChipProps = {
  tone?: BookPageLinkChipTone
  /** Glow while audio is playing. */
  live?: boolean
  interactive?: boolean
  children: ReactNode
  className?: string
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>

/**
 * Shared on-page badge for listening, board, checks, and exercises.
 * Round disc + white mark.
 */
export function BookPageLinkChip({
  tone = 'audio',
  live = false,
  interactive = true,
  children,
  className,
  type = 'button',
  ...rest
}: BookPageLinkChipProps) {
  return (
    <button
      type={type}
      className={cn(
        'flex h-6 w-6 items-center justify-center rounded-full border transition-[transform,box-shadow,filter] duration-150 ease-out',
        TONE_CLASS[tone],
        interactive
          ? 'pointer-events-auto hover:scale-110 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-1 focus-visible:ring-offset-black/20'
          : 'pointer-events-none',
        live && 'scale-110 brightness-110',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

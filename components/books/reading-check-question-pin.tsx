'use client'

import type { ButtonHTMLAttributes, CSSProperties } from 'react'
import { Check, CircleHelp, X } from 'lucide-react'
import {
  BookPageLinkChip,
  BOOK_PAGE_LINK_GLYPH_FILL_OPACITY,
  BOOK_PAGE_LINK_GLYPH_STROKE,
  type BookPageLinkChipTone,
} from '@/components/students/fullscreen-book-overlay/sections/BookPageLinkChip'
import { cn } from '@/lib/utils'

/** Story checks sit larger than listening / board / exercise dots (24px). */
export const READING_CHECK_PIN_SIZE_PX = 32
const CHECK_PIN_GLYPH_CLASS = 'h-5 w-5'

export type ReadingCheckQuestionPinTone = 'default' | 'correct' | 'incorrect' | 'skip'

type ReadingCheckQuestionPinProps = {
  tone?: ReadingCheckQuestionPinTone
  label?: string
  className?: string
  style?: CSSProperties
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>

function chipTone(tone: ReadingCheckQuestionPinTone): BookPageLinkChipTone {
  if (tone === 'correct') return 'check-correct'
  if (tone === 'incorrect') return 'check-incorrect'
  if (tone === 'skip') return 'check-skip'
  return 'check'
}

/**
 * Question check pin — same family as listening / board / exercise pins, but larger.
 * Orange "?" for kids; tick / X / skip after you mark an answer.
 */
export function ReadingCheckQuestionPin({
  tone = 'default',
  label,
  className,
  style,
  type = 'button',
  ...rest
}: ReadingCheckQuestionPinProps) {
  return (
    <BookPageLinkChip
      type={type}
      tone={chipTone(tone)}
      title={label}
      aria-label={label ? `Question: ${label}` : 'Reading check question'}
      className={cn('h-8 w-8', className)}
      style={style}
      {...rest}
    >
      {tone === 'correct' ? (
        <Check
          className={CHECK_PIN_GLYPH_CLASS}
          strokeWidth={BOOK_PAGE_LINK_GLYPH_STROKE}
          fill="currentColor"
          fillOpacity={BOOK_PAGE_LINK_GLYPH_FILL_OPACITY}
          aria-hidden
        />
      ) : tone === 'incorrect' ? (
        <X
          className={CHECK_PIN_GLYPH_CLASS}
          strokeWidth={BOOK_PAGE_LINK_GLYPH_STROKE}
          fill="currentColor"
          fillOpacity={BOOK_PAGE_LINK_GLYPH_FILL_OPACITY}
          aria-hidden
        />
      ) : tone === 'skip' ? (
        <CircleHelp
          className={CHECK_PIN_GLYPH_CLASS}
          strokeWidth={BOOK_PAGE_LINK_GLYPH_STROKE}
          fill="currentColor"
          fillOpacity={BOOK_PAGE_LINK_GLYPH_FILL_OPACITY}
          aria-hidden
        />
      ) : (
        <span className="text-base font-semibold leading-none tracking-tight" aria-hidden>
          ?
        </span>
      )}
    </BookPageLinkChip>
  )
}

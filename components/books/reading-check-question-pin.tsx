'use client'

import type { ButtonHTMLAttributes, CSSProperties } from 'react'
import { cn } from '@/lib/utils'

export type ReadingCheckQuestionPinTone = 'default' | 'correct' | 'incorrect' | 'skip'

type ReadingCheckQuestionPinProps = {
  tone?: ReadingCheckQuestionPinTone
  label?: string
  className?: string
  style?: CSSProperties
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>

/**
 * Question check pin — must not look like a board-link cream/gray dot.
 * Uses a clear "?" so students read it as a question.
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
    <button
      type={type}
      title={label}
      aria-label={label ? `Question: ${label}` : 'Reading check question'}
      className={cn(
        'relative flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-white text-lg font-black leading-none text-white shadow-[0_12px_28px_rgba(15,23,42,0.32)] transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70',
        tone === 'correct' && 'bg-emerald-600',
        tone === 'incorrect' && 'bg-rose-600',
        tone === 'skip' && 'bg-slate-500',
        tone === 'default' && 'bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500',
        className,
      )}
      style={style}
      {...rest}
    >
      {tone === 'default' ? (
        <span className="absolute inset-0 animate-pulse rounded-2xl bg-white/10" aria-hidden />
      ) : null}
      <span className="relative drop-shadow-sm">?</span>
    </button>
  )
}

'use client'

import type { CSSProperties, ReactNode } from 'react'
import type { GrammarIssue } from '@/lib/lesson-coach/types'
import { getSharedScreenHighlightIssues } from '@/lib/lesson-coach/issue-reveal'
import { cn } from '@/lib/utils'

export type CoachDictationChromeVariant = 'overlay' | 'paper' | 'coach'

type CoachDictationSentenceChromeProps = {
  variant: CoachDictationChromeVariant
  text: string
  issues: GrammarIssue[]
  /** Mirror highlight on the real input (textarea / contenteditable). */
  mirrorHighlight?: boolean
  mirrorClassName?: string
  mirrorStyle?: CSSProperties
  children: ReactNode
  className?: string
}

function markClass(status: GrammarIssue['status'], variant: CoachDictationChromeVariant): string {
  if (status === 'applied') {
    if (variant === 'coach') return 'rounded-sm bg-emerald-500/35 px-0.5 text-emerald-50'
    return variant === 'paper'
      ? 'rounded-sm bg-emerald-400/35 px-0.5 text-inherit'
      : 'rounded-sm bg-emerald-400/40 px-0.5 text-inherit'
  }
  if (variant === 'coach') return 'rounded-sm bg-amber-500/35 px-0.5 text-amber-50'
  return variant === 'paper'
    ? 'rounded-sm bg-amber-400/45 px-0.5 text-inherit'
    : 'rounded-sm bg-amber-400/40 px-0.5 text-inherit'
}

function HighlightedMirror({
  text,
  highlights,
  variant,
  className,
  style,
}: {
  text: string
  highlights: GrammarIssue[]
  variant: CoachDictationChromeVariant
  className?: string
  style?: CSSProperties
}) {
  if (highlights.length === 0) return null

  const sorted = [...highlights].sort((a, b) => a.start - b.start)
  const parts: ReactNode[] = []
  let cursor = 0

  for (const issue of sorted) {
    const start = Math.max(0, Math.min(issue.start, text.length))
    const end = Math.max(start, Math.min(issue.end, text.length))
    if (start > cursor) parts.push(text.slice(cursor, start))
    parts.push(
      <mark key={issue.id} className={markClass(issue.status, variant)}>
        {text.slice(start, end) || '·'}
      </mark>,
    )
    cursor = end
  }
  if (cursor < text.length) parts.push(text.slice(cursor))

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 z-[2] box-border overflow-hidden whitespace-pre-wrap break-words',
        className,
      )}
      style={style}
      aria-hidden
    >
      {parts}
    </div>
  )
}

/** Inline highlight mirror on the real field (amber = mistake, green = fixed). */
export function CoachDictationSentenceChrome({
  variant,
  text,
  issues,
  mirrorHighlight = false,
  mirrorClassName,
  mirrorStyle,
  children,
  className,
}: CoachDictationSentenceChromeProps) {
  const highlights = getSharedScreenHighlightIssues(issues)
  const useMirror = mirrorHighlight && highlights.length > 0 && text.trim().length > 0

  if (variant === 'coach') {
    const trimmed = text.trim()
    if (!trimmed) return <>{children}</>

    const sorted = [...highlights].sort((a, b) => a.start - b.start)
    const parts: ReactNode[] = []
    let cursor = 0
    for (const issue of sorted) {
      const start = Math.max(0, Math.min(issue.start, trimmed.length))
      const end = Math.max(start, Math.min(issue.end, trimmed.length))
      if (start > cursor) parts.push(trimmed.slice(cursor, start))
      parts.push(
        <mark key={issue.id} className={markClass(issue.status, 'coach')}>
          {trimmed.slice(start, end) || '·'}
        </mark>,
      )
      cursor = end
    }
    if (cursor < trimmed.length) parts.push(trimmed.slice(cursor))

    return (
      <div className={cn('flex flex-col gap-1', className)}>
        <div className="text-base leading-relaxed text-zinc-100 whitespace-pre-wrap">{parts}</div>
        {children}
      </div>
    )
  }

  if (!useMirror) {
    return <div className={className}>{children}</div>
  }

  return (
    <div className={cn('relative', className)}>
      <HighlightedMirror
        text={text}
        highlights={highlights}
        variant={variant}
        className={mirrorClassName}
        style={mirrorStyle}
      />
      <div className="relative z-[1] [&_textarea]:text-transparent [&_textarea]:caret-white [&_[contenteditable=true]]:text-transparent [&_[contenteditable=true]]:caret-[#2f2f2f]">
        {children}
      </div>
    </div>
  )
}

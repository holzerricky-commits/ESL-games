'use client'

import type { CSSProperties, ReactNode } from 'react'
import type { SpellMarkerSpan } from '@/lib/writing-assist/spell-markers'
import { cn } from '@/lib/utils'

export function WritingAssistSpellMirror({
  text,
  spans,
  className,
  style,
}: {
  text: string
  spans: SpellMarkerSpan[]
  className?: string
  style?: CSSProperties
}) {
  if (spans.length === 0 || !text) return null

  const sorted = [...spans].sort((a, b) => a.start - b.start)
  const parts: ReactNode[] = []
  let cursor = 0

  for (const span of sorted) {
    const start = Math.max(0, Math.min(span.start, text.length))
    const end = Math.max(start, Math.min(span.end, text.length))
    if (start > cursor) parts.push(text.slice(cursor, start))
    parts.push(
      <mark
        key={`${start}-${end}`}
        className={cn(
          'bg-transparent text-transparent underline-offset-[2px]',
          span.kind === 'capitalization'
            ? 'decoration-amber-500/90 decoration-wavy'
            : 'decoration-red-500/85 decoration-wavy',
        )}
      >
        {text.slice(start, end) || '·'}
      </mark>,
    )
    cursor = end
  }
  if (cursor < text.length) parts.push(text.slice(cursor))

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 z-[2] box-border overflow-hidden whitespace-pre-wrap break-words text-transparent',
        className,
      )}
      style={style}
      aria-hidden
    >
      {parts}
    </div>
  )
}

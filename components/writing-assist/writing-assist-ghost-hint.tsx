'use client'

import type { GhostSuggestion } from '@/lib/writing-assist/ghost-complete'

/** Visible Tab completion hint below the active typing field. */
export function WritingAssistGhostHintBar({
  ghost,
  partial = '',
}: {
  ghost: GhostSuggestion | null
  partial?: string
}) {
  if (!ghost?.suffix) return null

  const preview = partial
    ? `${partial}${ghost.suffix}`
    : ghost.word

  return (
    <div
      className="pointer-events-none absolute -bottom-8 left-0 z-[40] flex max-w-[min(100%,20rem)] items-center gap-1.5 rounded-md border border-amber-300/70 bg-amber-950/95 px-2 py-1 shadow-md backdrop-blur-sm"
      aria-hidden
    >
      <kbd className="shrink-0 rounded border border-amber-200/40 bg-amber-800 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-amber-50">
        Tab
      </kbd>
      <span className="truncate text-xs font-semibold text-amber-50">{preview}</span>
    </div>
  )
}

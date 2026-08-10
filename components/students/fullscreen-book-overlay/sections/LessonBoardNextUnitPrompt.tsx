'use client'

import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface LessonBoardNextUnitPromptProps {
  nextUnitTitle: string
  onOpen: () => void
  onDismiss: () => void
  className?: string
}

/**
 * Soft near-end handoff: offer the next existing unit's board without creating units.
 */
export function LessonBoardNextUnitPrompt({
  nextUnitTitle,
  onOpen,
  onDismiss,
  className,
}: LessonBoardNextUnitPromptProps) {
  const title = nextUnitTitle.trim() || 'next unit'
  return (
    <div
      className={cn(
        'pointer-events-auto flex max-w-[min(100%,20rem)] items-center gap-1.5 rounded-full',
        'border border-[#E5E7EB] bg-white/95 px-2 py-1',
        'shadow-[0_1px_2px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.08)]',
        className,
      )}
      role="status"
    >
      <p className="min-w-0 flex-1 truncate pl-1 text-[11px] font-medium text-[#374151]">
        Open {title} board?
      </p>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'shrink-0 rounded-full bg-[#2563EB] px-2.5 py-1 text-[11px] font-medium text-white',
          'transition-colors hover:bg-[#1D4ED8] active:bg-[#1E40AF]',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#93C5FD]',
        )}
      >
        Open
      </button>
      <button
        type="button"
        onClick={onDismiss}
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
          'text-[#6B7280] transition-colors hover:bg-black/[0.05] hover:text-[#374151]',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#D1D5DB]',
        )}
        aria-label="Dismiss"
        title="Not now"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  )
}

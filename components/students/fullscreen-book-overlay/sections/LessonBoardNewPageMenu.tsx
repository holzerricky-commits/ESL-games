'use client'

import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

const MENU_BTN =
  'pointer-events-auto flex h-7 w-7 items-center justify-center rounded-md bg-transparent transition-colors duration-150 ease-out hover:bg-black/[0.05] active:bg-black/[0.08] focus-visible:outline-none focus-visible:bg-black/[0.04] focus-visible:ring-1 focus-visible:ring-[#D1D5DB]'

type LessonBoardNewPageMenuProps = {
  onCreatePage: () => void
  triggerClassName?: string
  /** Compact rail footer button instead of header icon. */
  variant?: 'icon' | 'footer'
}

export function LessonBoardNewPageMenu({
  onCreatePage,
  triggerClassName,
  variant = 'icon',
}: LessonBoardNewPageMenuProps) {
  if (variant === 'footer') {
    return (
      <button
        type="button"
        onClick={onCreatePage}
        className={cn(
          'flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-[#5c4030]/25 bg-white/50 text-[11px] font-semibold text-[#3d2918] hover:bg-white/80',
          triggerClassName,
        )}
      >
        <Plus size={14} aria-hidden />
        New page
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onCreatePage}
      className={cn(MENU_BTN, triggerClassName)}
      aria-label="New notebook page"
      title="New page"
    >
      <Plus className="h-3.5 w-3.5 shrink-0 stroke-[2.25] text-[#374151]" aria-hidden />
    </button>
  )
}

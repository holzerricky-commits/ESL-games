'use client'

import { Plus, RectangleHorizontal, RectangleVertical } from 'lucide-react'
import type { LessonBoardPageOrientation } from '@/lib/books/lesson-board-types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const MENU_BTN =
  'pointer-events-auto flex h-7 w-7 items-center justify-center rounded-md bg-transparent transition-colors duration-150 ease-out hover:bg-black/[0.05] active:bg-black/[0.08] focus-visible:outline-none focus-visible:bg-black/[0.04] focus-visible:ring-1 focus-visible:ring-[#D1D5DB]'

type LessonBoardNewPageMenuProps = {
  onCreatePage: (orientation: LessonBoardPageOrientation) => void
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-[#5c4030]/25 bg-white/50 text-[11px] font-semibold text-[#3d2918] hover:bg-white/80',
              triggerClassName,
            )}
          >
            <Plus size={14} aria-hidden />
            New page
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="center" className="min-w-[10rem]">
          <DropdownMenuItem onSelect={() => onCreatePage('standard')}>
            <RectangleVertical className="size-4" aria-hidden />
            Standard page
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onCreatePage('wide')}>
            <RectangleHorizontal className="size-4" aria-hidden />
            Wide page
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(MENU_BTN, triggerClassName)}
          aria-label="New board page"
          title="New page"
        >
          <Plus className="h-3.5 w-3.5 shrink-0 stroke-[2.25] text-[#374151]" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="start" className="min-w-[10rem]">
        <DropdownMenuItem onSelect={() => onCreatePage('standard')}>
          <RectangleVertical className="size-4" aria-hidden />
          Standard page
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onCreatePage('wide')}>
          <RectangleHorizontal className="size-4" aria-hidden />
          Wide page
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

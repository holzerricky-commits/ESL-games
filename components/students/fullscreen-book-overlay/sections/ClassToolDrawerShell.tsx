'use client'

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  BOOK_AUDIO_PLAYLIST_RAIL_WIDTH_PX,
  BOOK_WORKSPACE_LEFT_BAR_WIDTH,
  BOOK_WORKSPACE_RAIL_MOTION_TW,
} from '@/components/students/fullscreen-book-overlay/constants'
import { cn } from '@/lib/utils'

/** Tools that open in the shared class drawer (Translate, Pictures; more later). */
export type ClassToolId = 'translate' | 'pictures'

type ClassToolDrawerShellProps = {
  open: boolean
  onClose: () => void
  title: string
  icon: LucideIcon
  ariaLabel: string
  children: ReactNode
  /** Optional sticky block under the title (e.g. Translate search). */
  headerExtra?: ReactNode
}

/**
 * Full-height left drawer beside the icon strip — same chrome/motion/width as Listening.
 * Swappable body for class tools that push the book instead of floating over it.
 */
export function ClassToolDrawerShell({
  open,
  onClose,
  title,
  icon: Icon,
  ariaLabel,
  children,
  headerExtra,
}: ClassToolDrawerShellProps) {
  return (
    <div
      className={cn(
        'absolute inset-y-0 z-50 flex min-h-0 flex-col overflow-hidden border-r border-white/10 bg-[#2a2a2e] text-[#a1a1aa] shadow-[4px_0_16px_rgba(0,0,0,0.35)] transition-transform',
        BOOK_WORKSPACE_RAIL_MOTION_TW,
        open ? 'translate-x-0' : '-translate-x-full pointer-events-none',
      )}
      style={{
        left: BOOK_WORKSPACE_LEFT_BAR_WIDTH,
        width: `min(${BOOK_AUDIO_PLAYLIST_RAIL_WIDTH_PX}px, calc(100vw - ${BOOK_WORKSPACE_LEFT_BAR_WIDTH} - 12px))`,
      }}
      data-class-tool-drawer=""
      role="dialog"
      aria-label={ariaLabel}
      aria-hidden={!open}
    >
      <header className="flex shrink-0 flex-col gap-3 px-4 pt-3 pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Icon className="h-3.5 w-3.5 shrink-0 text-white/50" aria-hidden />
            <p className="min-w-0 truncate text-[12px] font-medium tracking-wide text-white/55">
              {title}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 cursor-pointer rounded-md text-[#71717a] hover:bg-white/5 hover:text-[#f4f4f5]"
            onClick={onClose}
            aria-label={`Close ${title}`}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        {headerExtra ? (
          <div className="border-b border-white/[0.08] pb-3">{headerExtra}</div>
        ) : null}
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  )
}

'use client'

import type { ReactNode } from 'react'
import {
  BOOK_CLASS_CHROME_THEME_VARS,
  BOOK_WORKSPACE_LEFT_BAR_WIDTH,
  BOOK_WORKSPACE_RAIL_MOTION_TW,
} from '@/components/students/fullscreen-book-overlay/constants'
import { cn } from '@/lib/utils'

export interface DeskToolRailProps {
  open: boolean
  widthPx: number
  header?: ReactNode
  footer?: ReactNode
  children: ReactNode
  /** Body scroll; pass `overflow-hidden` when the job manages its own scroll. */
  bodyClassName?: string
}

/**
 * Full tool panel beside the left strip (prep desk jobs). Scopes the class chrome
 * palette onto app tokens so token-styled prep components match the reader.
 */
export function DeskToolRail({
  open,
  widthPx,
  header = null,
  footer = null,
  children,
  bodyClassName = 'overflow-y-auto overscroll-contain',
}: DeskToolRailProps) {
  return (
    <div
      className={cn(
        'dark absolute inset-y-0 z-50 flex min-h-0 flex-col overflow-hidden border-r border-white/10 bg-[var(--surface-2)] text-foreground shadow-[4px_0_16px_rgba(0,0,0,0.35)] transition-transform',
        BOOK_WORKSPACE_RAIL_MOTION_TW,
        open ? 'translate-x-0' : '-translate-x-full pointer-events-none',
      )}
      style={{
        ...BOOK_CLASS_CHROME_THEME_VARS,
        left: BOOK_WORKSPACE_LEFT_BAR_WIDTH,
        width: `min(${widthPx}px, calc(100vw - ${BOOK_WORKSPACE_LEFT_BAR_WIDTH} - 12px))`,
      }}
      aria-hidden={!open}
    >
      {header ? (
        <div className="shrink-0 border-b border-[var(--border)]">{header}</div>
      ) : null}
      <div className={cn('min-h-0 flex-1 px-3 py-3', bodyClassName)}>{children}</div>
      {footer ? (
        <div className="shrink-0 border-t border-[var(--border)]">{footer}</div>
      ) : null}
    </div>
  )
}

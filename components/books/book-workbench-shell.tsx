'use client'

import { useEffect, type ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const BOOK_WORKBENCH_LEFT_WIDTH_PX = 300

export interface BookWorkbenchShellProps {
  open: boolean
  onClose: () => void
  ariaLabel: string
  /** Disable Back / Escape while a save or extract runs. */
  busy?: boolean
  className?: string

  /**
   * Preferred API — job controls + book panes.
   * When both `left` and `book` are set, the shell draws the shared two-column frame.
   */
  title?: string
  subtitle?: string | null
  headerLeading?: ReactNode
  left?: ReactNode
  leftFooter?: ReactNode
  book?: ReactNode
  leftWidthPx?: number
  leftPaneClassName?: string

  /**
   * Legacy body: caller already built left+right columns (Edit outline during migration).
   * Prefer `left` + `book` for new jobs.
   */
  children?: ReactNode
}

/**
 * Shared full-screen desk: left job controls + right book.
 * See `docs/BOOK_WORKBENCH_SHELL.md`.
 */
export function BookWorkbenchShell({
  open,
  onClose,
  ariaLabel,
  busy = false,
  className,
  title = 'Book',
  subtitle = null,
  headerLeading = null,
  left,
  leftFooter = null,
  book,
  leftWidthPx = BOOK_WORKBENCH_LEFT_WIDTH_PX,
  leftPaneClassName = 'overflow-y-auto overscroll-contain',
  children,
}: BookWorkbenchShellProps) {
  const useSlots = left != null && book != null

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape' || busy) return
      e.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onClose])

  if (!open) return null

  return (
    <div
      className={cn(
        'fixed inset-0 z-[80] flex bg-[var(--surface-1,#0f1115)] text-foreground',
        className,
      )}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      {useSlots ? (
        <>
          <div
            className="flex h-full shrink-0 flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--surface-2)]"
            style={{ width: leftWidthPx }}
          >
            <div className="flex min-h-0 min-w-0 shrink-0 items-start gap-2 border-b border-[var(--border)] px-3 py-3">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-0.5 h-8 w-8 shrink-0"
                disabled={busy}
                onClick={onClose}
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              {headerLeading}
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[15px] font-semibold tracking-tight">{title}</h2>
                {subtitle ? (
                  <p className="mt-0.5 truncate text-[12px] text-muted-foreground" title={subtitle}>
                    {subtitle}
                  </p>
                ) : null}
              </div>
            </div>

            <div className={cn('min-h-0 flex-1 px-3 py-3', leftPaneClassName)}>{left}</div>

            {leftFooter ? (
              <div className="shrink-0 border-t border-[var(--border)]">{leftFooter}</div>
            ) : null}
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--surface-1,#0f1115)] p-2">
            {book}
          </div>
        </>
      ) : (
        children
      )}
    </div>
  )
}

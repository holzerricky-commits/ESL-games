'use client'

import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ScanNoticeKind = 'success' | 'error' | 'info'

export type ScanNotice = {
  kind: ScanNoticeKind
  message: string
}

export interface DismissibleScanNoticeProps {
  notice: ScanNotice
  onDismiss: () => void
  className?: string
}

/**
 * Stays until the user clicks it (or the X). Use for scan outcomes that are easy to miss as toasts.
 */
export function DismissibleScanNotice({ notice, onDismiss, className }: DismissibleScanNoticeProps) {
  return (
    <button
      type="button"
      onClick={onDismiss}
      className={cn(
        'flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left text-xs leading-snug transition-opacity hover:opacity-90',
        notice.kind === 'error' &&
          'border-red-300/80 bg-red-50 text-red-950 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100',
        notice.kind === 'success' &&
          'border-emerald-300/80 bg-emerald-50 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100',
        notice.kind === 'info' &&
          'border-[var(--checks-border)] bg-[var(--checks-warn-soft)] text-[var(--checks-ink)]',
        className,
      )}
      aria-live="polite"
    >
      <span className="min-w-0 flex-1">{notice.message}</span>
      <span className="mt-0.5 shrink-0 text-[10px] font-medium uppercase tracking-wide opacity-70">
        <X className="size-3.5" aria-hidden />
        <span className="sr-only">Dismiss</span>
      </span>
    </button>
  )
}

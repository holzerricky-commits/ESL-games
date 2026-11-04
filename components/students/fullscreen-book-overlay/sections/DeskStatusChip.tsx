'use client'

import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type DeskStepStatus = 'todo' | 'running' | 'done' | 'attention'

const TONE_TW: Record<DeskStepStatus, string> = {
  todo: 'bg-[var(--surface-4)] text-muted-foreground',
  running: 'bg-[var(--surface-4)] text-foreground',
  done: 'bg-[color-mix(in_srgb,var(--brand-green)_18%,transparent)] text-[var(--brand-green)]',
  attention: 'bg-[color-mix(in_srgb,var(--brand-yellow)_18%,transparent)] text-[var(--brand-yellow)]',
}

export interface DeskStatusChipProps {
  status: DeskStepStatus
  label: string
  className?: string
}

/** One status pill for every desk step and detail view. */
export function DeskStatusChip({ status, label, className }: DeskStatusChipProps) {
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-medium leading-none',
        TONE_TW[status],
        className,
      )}
    >
      {status === 'running' ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : null}
      {label}
    </span>
  )
}

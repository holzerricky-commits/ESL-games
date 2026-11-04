'use client'

import type { ReactNode } from 'react'
import { Check, ChevronRight, type LucideIcon } from 'lucide-react'
import {
  DeskStatusChip,
  type DeskStepStatus,
} from '@/components/students/fullscreen-book-overlay/sections/DeskStatusChip'
import { cn } from '@/lib/utils'

export interface DeskStepListProps {
  label: string
  doneCount: number
  totalCount: number
  children: ReactNode
}

/** Overview checklist for a desk rail: progress summary + step rows. */
export function DeskStepList({ label, doneCount, totalCount, children }: DeskStepListProps) {
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0
  return (
    <div className="space-y-3">
      <div className="space-y-1.5 px-1">
        <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <span>{label}</span>
          <span className="tabular-nums">
            {doneCount} of {totalCount} done
          </span>
        </div>
        <div
          className="h-1 overflow-hidden rounded-full bg-[var(--surface-4)]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={totalCount}
          aria-valuenow={doneCount}
          aria-label={label}
        >
          <div
            className="h-full rounded-full bg-[var(--brand-green)] transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <ol className="space-y-0.5">{children}</ol>
    </div>
  )
}

export interface DeskStepRowProps {
  icon: LucideIcon
  title: string
  summary?: string | null
  status: DeskStepStatus
  statusLabel: string
  onClick: () => void
  disabled?: boolean
  /** 0–100 while a job runs; shows a thin bar under the summary. */
  progressPercent?: number | null
}

export function DeskStepRow({
  icon: Icon,
  title,
  summary,
  status,
  statusLabel,
  onClick,
  disabled = false,
  progressPercent = null,
}: DeskStepRowProps) {
  const done = status === 'done'
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition',
          'hover:bg-[var(--surface-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
          'disabled:pointer-events-none disabled:opacity-50',
        )}
      >
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-3)] transition group-hover:bg-[var(--surface-4)]',
            done ? 'text-[var(--brand-green)]' : 'text-muted-foreground',
          )}
          aria-hidden
        >
          {done ? <Check className="h-4 w-4 stroke-[2.5]" /> : <Icon className="h-4 w-4" strokeWidth={1.75} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-foreground">{title}</span>
          {summary ? (
            <span className="block truncate text-[11px] text-muted-foreground">{summary}</span>
          ) : null}
          {progressPercent != null ? (
            <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-[var(--surface-4)]" aria-hidden>
              <span
                className="block h-full rounded-full bg-foreground/70 transition-[width] duration-300"
                style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
              />
            </span>
          ) : null}
        </span>
        <DeskStatusChip status={status} label={statusLabel} />
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>
    </li>
  )
}

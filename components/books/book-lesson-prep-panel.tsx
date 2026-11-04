'use client'

import { Loader2, Sparkles, Square, X } from 'lucide-react'
import {
  DeskStatusChip,
  type DeskStepStatus,
} from '@/components/students/fullscreen-book-overlay/sections/DeskStatusChip'
import { Button } from '@/components/ui/button'
import type { LessonPrepSnapshot, LessonPrepStep } from '@/lib/books/lesson-prep-manager'
import { cn } from '@/lib/utils'

function chipStatus(step: LessonPrepStep): DeskStepStatus {
  if (step.state === 'pending') return 'todo'
  if (step.state === 'running') return 'running'
  if (step.state === 'done') return 'done'
  return 'attention'
}

function StepCell({ label, step }: { label: string; step: LessonPrepStep }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <DeskStatusChip status={chipStatus(step)} label={step.note} className="max-w-full truncate" />
    </div>
  )
}

export function BookLessonPrepButton({
  running,
  disabled,
  onStart,
  onStop,
}: {
  running: boolean
  disabled: boolean
  onStart: () => void
  onStop: () => void
}) {
  if (running) {
    return (
      <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5" onClick={onStop}>
        <Square className="h-3.5 w-3.5" aria-hidden />
        Stop prep
      </Button>
    )
  }
  return (
    <Button
      type="button"
      size="sm"
      className="h-8 gap-1.5"
      disabled={disabled}
      title={disabled ? 'Loading the book pages\u2026' : 'Pages, selectable text, story text, and checks'}
      onClick={onStart}
    >
      <Sparkles className="h-3.5 w-3.5" aria-hidden />
      Prep this lesson
    </Button>
  )
}

/** Progress and per-story results for a "Prep this lesson" run. Hidden until a run starts. */
export function BookLessonPrepPanel({
  snapshot,
  onDismiss,
  className,
}: {
  snapshot: LessonPrepSnapshot | null
  onDismiss: () => void
  className?: string
}) {
  if (!snapshot || (!snapshot.running && !snapshot.finished)) return null

  return (
    <div className={cn('space-y-3 rounded-2xl bg-[var(--surface-2)] px-4 py-3.5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {snapshot.running ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
          ) : (
            <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          )}
          <p className="text-[14px] font-semibold tracking-tight text-foreground">Lesson prep</p>
          {snapshot.message ? (
            <p className="truncate text-[13px] text-muted-foreground">{snapshot.message}</p>
          ) : null}
        </div>
        {!snapshot.running ? (
          <button
            type="button"
            className="chrome-icon-btn -mr-1 -mt-0.5 h-7 w-7 shrink-0"
            aria-label="Hide lesson prep results"
            onClick={onDismiss}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
        <p className="text-[13px] font-medium text-foreground">Selectable pages (whole lesson)</p>
        <DeskStatusChip status={chipStatus(snapshot.selectable)} label={snapshot.selectable.note} />
      </div>

      {snapshot.parts.length > 0 ? (
        <ul className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
          {snapshot.parts.map((part) => (
            <li key={part.storyId} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,1fr))] sm:items-center sm:gap-4">
              <p className="truncate text-[13px] font-medium text-foreground">{part.title}</p>
              <StepCell label="Pages" step={part.pages} />
              <StepCell label="Text" step={part.text} />
              <StepCell label="Checks" step={part.checks} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

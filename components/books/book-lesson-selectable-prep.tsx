'use client'

import { useMemo } from 'react'
import { MousePointer2, RefreshCw } from 'lucide-react'
import { DismissibleScanNotice } from '@/components/books/dismissible-scan-notice'
import { SelectableJobStatus } from '@/components/books/selectable-job-status'
import {
  DeskStatusChip,
  type DeskStepStatus,
} from '@/components/students/fullscreen-book-overlay/sections/DeskStatusChip'
import { Button } from '@/components/ui/button'
import { lessonSelectableJobKey } from '@/lib/books/searchable-pdf-manager'
import { useSearchablePdfJob } from '@/lib/books/use-searchable-pdf-job'
import { useSearchablePdfStatus } from '@/lib/books/use-searchable-pdf-status'
import type { BookLessonRecord, BookRecord, BookUnitRecord } from '@/lib/books/types'
import { cn } from '@/lib/utils'

interface BookLessonSelectablePrepProps {
  book: BookRecord
  unit: BookUnitRecord
  lesson: BookLessonRecord
  className?: string
}

/** Lesson shelf step: put a hidden word layer on every page of the lesson, not just the stories. */
export function BookLessonSelectablePrep({ book, unit, lesson, className }: BookLessonSelectablePrepProps) {
  const jobKey = useMemo(
    () => lessonSelectableJobKey(book.id, unit.id, lesson.id),
    [book.id, unit.id, lesson.id],
  )
  const title = lesson.title?.trim() || 'Lesson'

  const {
    selectableRunning,
    selectableProgress,
    selectableNotice,
    startSelectable,
    stopSelectable,
    dismissSelectableNotice,
  } = useSearchablePdfJob(jobKey)

  const { status, loading, error } = useSearchablePdfStatus({
    bookId: book.id,
    unitId: unit.id,
    storyId: jobKey,
    lessonId: lesson.id,
    title,
    scope: 'lesson',
    refreshKey: selectableRunning ? 1 : 0,
  })

  const pagesKnown = !error
  const chip: { status: DeskStepStatus; label: string } = selectableRunning
    ? { status: 'running', label: 'Working' }
    : error
      ? { status: 'attention', label: 'Needs pages' }
      : status === 'stamped' || status === 'native-text'
        ? { status: 'done', label: 'Done' }
        : loading || status === 'unknown'
          ? { status: 'todo', label: 'Checking' }
          : { status: 'todo', label: 'To do' }

  const headline = error
    ? error
    : status === 'stamped'
      ? 'Every page in this lesson has a hidden word layer.'
      : status === 'native-text'
        ? 'This book file already has text you can select on these pages.'
        : status === 'needs-ocr' || status === 'empty'
          ? 'Some lesson pages are pictures only, so words can\u2019t be selected yet.'
          : 'Checking the lesson pages\u2026'

  function run(force: boolean) {
    startSelectable({
      bookId: book.id,
      unitId: unit.id,
      lessonId: lesson.id,
      title,
      scope: 'lesson',
      force,
    })
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-2xl bg-[var(--surface-2)] px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <MousePointer2 className="h-4 w-4 text-muted-foreground" aria-hidden />
          <p className="text-[14px] font-semibold tracking-tight text-foreground">Selectable pages</p>
          <DeskStatusChip status={chip.status} label={chip.label} />
        </div>
        <p className="text-[13px] leading-relaxed text-foreground">{headline}</p>
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          Covers vocabulary, stories, and every other part, so you can drag, copy, and translate words anywhere in
          the lesson.
        </p>
        {selectableRunning && selectableProgress ? (
          <SelectableJobStatus progress={selectableProgress} onStop={stopSelectable} />
        ) : null}
        {!selectableRunning && selectableNotice ? (
          <DismissibleScanNotice notice={selectableNotice} onDismiss={dismissSelectableNotice} />
        ) : null}
      </div>

      {selectableRunning || !pagesKnown || status === 'native-text' ? null : status === 'stamped' ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 shrink-0 gap-1.5 rounded-lg px-3"
          onClick={() => run(true)}
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Redo
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          className="h-8 shrink-0 gap-1.5 rounded-lg px-4"
          disabled={loading}
          onClick={() => run(false)}
        >
          <MousePointer2 className="h-3.5 w-3.5" aria-hidden />
          Make lesson selectable
        </Button>
      )}
    </div>
  )
}

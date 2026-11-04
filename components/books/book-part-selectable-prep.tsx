'use client'

import { useEffect, useMemo } from 'react'
import { MousePointer2, RefreshCw } from 'lucide-react'
import { DismissibleScanNotice } from '@/components/books/dismissible-scan-notice'
import { SelectableJobStatus } from '@/components/books/selectable-job-status'
import {
  DeskStatusChip,
  type DeskStepStatus,
} from '@/components/students/fullscreen-book-overlay/sections/DeskStatusChip'
import { Button } from '@/components/ui/button'
import { readingStoryPartKey } from '@/lib/books/reading-story-map'
import type { SearchablePdfRangeStatus } from '@/lib/books/searchable-pdf-client'
import { useSearchablePdfJob } from '@/lib/books/use-searchable-pdf-job'
import { useSearchablePdfStatus } from '@/lib/books/use-searchable-pdf-status'
import type { BookLessonPartRecord, BookLessonRecord, BookRecord, BookUnitRecord } from '@/lib/books/types'
import { cn } from '@/lib/utils'

export interface SelectableStepState {
  status: DeskStepStatus
  label: string
  summary: string
}

/** Shared by the Selectable screen and its checklist row. */
export function selectableStepState(args: {
  pagesReady: boolean
  running: boolean
  status: SearchablePdfRangeStatus
  loading?: boolean
}): SelectableStepState {
  if (!args.pagesReady) return { status: 'todo', label: 'Needs pages', summary: 'Set the story pages first' }
  if (args.running) return { status: 'running', label: 'Working', summary: 'Making pages selectable' }
  if (args.status === 'stamped') return { status: 'done', label: 'Done', summary: 'Pages are selectable' }
  if (args.status === 'native-text') return { status: 'done', label: 'Done', summary: 'Already in the book' }
  if (args.loading || args.status === 'unknown') return { status: 'todo', label: 'Checking', summary: 'Checking the pages' }
  return { status: 'todo', label: 'To do', summary: 'Pages are pictures only' }
}

interface BookPartSelectablePrepProps {
  book: BookRecord
  unit: BookUnitRecord
  lesson: BookLessonRecord
  part: BookLessonPartRecord
  totalPdfPages: number | null
  pagesReady: boolean
  /** Bump when the story page range changes so the status is re-checked. */
  refreshKey?: number
  onStatusChange?: (status: SearchablePdfRangeStatus, loading: boolean) => void
  className?: string
}

/** Story desk step: put a hidden word layer on the story pages for class select / copy / translate. */
export function BookPartSelectablePrep({
  book,
  unit,
  lesson,
  part,
  totalPdfPages,
  pagesReady,
  refreshKey = 0,
  onStatusChange,
  className,
}: BookPartSelectablePrepProps) {
  const storyId = useMemo(
    () => readingStoryPartKey(book.id, unit.id, lesson.id, part.id),
    [book.id, unit.id, lesson.id, part.id],
  )
  const title = part.title?.trim() || 'Story'

  const {
    selectableRunning,
    selectableProgress,
    selectableNotice,
    startSelectable,
    stopSelectable,
    dismissSelectableNotice,
  } = useSearchablePdfJob(storyId)

  const { status, loading } = useSearchablePdfStatus({
    bookId: book.id,
    unitId: unit.id,
    storyId,
    lessonId: lesson.id,
    partId: part.id,
    title,
    totalPdfPages,
    enabled: pagesReady,
    refreshKey: refreshKey * 2 + (selectableRunning ? 1 : 0),
  })

  useEffect(() => {
    onStatusChange?.(status, loading)
  }, [status, loading, onStatusChange])

  const step = selectableStepState({ pagesReady, running: selectableRunning, status, loading })

  function run(force: boolean) {
    startSelectable({
      bookId: book.id,
      unitId: unit.id,
      lessonId: lesson.id,
      partId: part.id,
      title,
      totalPdfPages,
      force,
    })
  }

  const headline = !pagesReady
    ? 'Set the story pages before making them selectable.'
    : status === 'stamped'
      ? 'The story pages have a hidden word layer.'
      : status === 'native-text'
        ? 'This book file already has text you can select.'
        : status === 'needs-ocr' || status === 'empty'
          ? 'These pages are pictures only, so words can\u2019t be selected yet.'
          : 'Checking the story pages\u2026'

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="space-y-2">
        <DeskStatusChip status={step.status} label={step.label} />
        <p className="text-[13px] leading-relaxed text-foreground">{headline}</p>
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          Selectable pages let you drag, copy, and translate words on the book in class.
        </p>
      </div>

      {selectableRunning && selectableProgress ? (
        <SelectableJobStatus progress={selectableProgress} onStop={stopSelectable} />
      ) : null}
      {!selectableRunning && selectableNotice ? (
        <DismissibleScanNotice notice={selectableNotice} onDismiss={dismissSelectableNotice} />
      ) : null}

      {selectableRunning || status === 'native-text' ? null : status === 'stamped' ? (
        <div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 rounded-lg px-3"
            onClick={() => run(true)}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Redo
          </Button>
        </div>
      ) : (
        <div>
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5 rounded-lg px-4"
            disabled={!pagesReady || loading}
            onClick={() => run(false)}
          >
            <MousePointer2 className="h-3.5 w-3.5" aria-hidden />
            Make pages selectable
          </Button>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { PdfPageThumbnail } from '@/components/students/pdf-page-thumbnail'
import { Button } from '@/components/ui/button'
import type { BookLessonRecord } from '@/lib/books/types'
import type { TocUnitDraft } from '@/lib/books/toc-import'
import type { TocExtractProfileId } from '@/lib/books/toc-extract-profile'
import { tocChunkLabelStyleForProfile } from '@/lib/books/toc-extract-profile'
import { cn } from '@/lib/utils'

const PROFILE_LABEL: Record<TocExtractProfileId, string> = {
  wonders_workshop: 'Wonders Workshop',
  wonders_literature: 'Wonders Literature',
  journeys: 'Journeys',
  generic: 'Generic',
}

export type ExtractProgressPhase = 'reading' | 'finding' | 'filling' | 'done' | 'error'

export type ExtractProgress = {
  phase: ExtractProgressPhase
  detail: string | null
  activePdfPage: number | null
}

export const EXTRACT_PHASE_STEPS: Array<{
  id: Exclude<ExtractProgressPhase, 'error'>
  label: string
}> = [
  { id: 'reading', label: 'Reading pages' },
  { id: 'finding', label: 'Finding units' },
  { id: 'filling', label: 'Filling weeks' },
  { id: 'done', label: 'Done' },
]

export function extractPhaseButtonLabel(progress: ExtractProgress | null, extracting: boolean): string {
  if (!extracting || !progress) return ''
  switch (progress.phase) {
    case 'reading':
      return 'Reading pages…'
    case 'finding':
      return 'Finding units…'
    case 'filling':
      return 'Filling weeks…'
    case 'done':
      return 'Done'
    case 'error':
      return 'Extract failed'
    default:
      return 'Extracting…'
  }
}

export function outlineExtractSummary(
  unitCount: number,
  chunkCount: number,
  profile: TocExtractProfileId,
): string {
  const units = unitCount === 1 ? '1 unit' : `${unitCount} units`
  const style = tocChunkLabelStyleForProfile(profile)
  if (style === 'week') {
    const weeks = chunkCount === 1 ? '1 week' : `${chunkCount} weeks`
    return `${units}, ${weeks}`
  }
  if (style === 'lesson') {
    const lessons = chunkCount === 1 ? '1 lesson' : `${chunkCount} lessons`
    return `${units}, ${lessons}`
  }
  return units
}

function chunkCountLabel(count: number, profile: TocExtractProfileId): string {
  const style = tocChunkLabelStyleForProfile(profile)
  if (style === 'week') return count === 1 ? '1 week' : `${count} weeks`
  if (style === 'lesson') return count === 1 ? '1 lesson' : `${count} lessons`
  return count === 1 ? '1 section' : `${count} sections`
}

export type ExtractUnitResultRow = {
  id: string
  title: string
  chunkCount: number
}

export function BookExtractMarking({
  profile,
  scopeLabel,
  from,
  to,
  multiVolumeHint,
  extracting,
  progress,
  errorMessage,
  unitRows,
  chunkCount,
  rangeChanged,
  recommendStaged,
  staged,
  onStagedChange,
  onReview,
}: {
  profile: TocExtractProfileId
  scopeLabel: string | null
  from: number | null
  to: number | null
  multiVolumeHint: boolean
  extracting: boolean
  progress: ExtractProgress | null
  errorMessage: string | null
  unitRows: ExtractUnitResultRow[]
  chunkCount: number
  rangeChanged: boolean
  recommendStaged: boolean
  staged: boolean
  onStagedChange: (value: boolean) => void
  onReview: () => void
}) {
  const pageLine =
    from == null || to == null
      ? 'Set the contents pages, then extract.'
      : from === to
        ? `Contents PDF ${from}`
        : `Contents PDF ${from}–${to}`
  const unitCount = unitRows.length
  const hasOutline = unitCount > 0 && !rangeChanged && !extracting
  const fillingLabel =
    tocChunkLabelStyleForProfile(profile) === 'lesson' ? 'Filling lessons' : 'Filling weeks'
  const phaseSteps = EXTRACT_PHASE_STEPS.map((step) =>
    step.id === 'filling' ? { ...step, label: fillingLabel } : step,
  )
  const activePhase = progress?.phase ?? null
  const showPhases = extracting || activePhase === 'done' || activePhase === 'error'

  return (
    <div className="flex w-full flex-col gap-3 rounded-2xl bg-[var(--surface-3)] px-3 py-3">
      <div>
        <p className="text-[13px] font-semibold tracking-tight text-foreground">
          Extract
          {scopeLabel ? (
            <span className="font-medium text-muted-foreground"> · {scopeLabel}</span>
          ) : null}
        </p>
        <p className="mt-1 text-[12px] leading-snug text-muted-foreground">{pageLine}</p>
      </div>
      <p className="text-[12px] font-medium text-foreground">{PROFILE_LABEL[profile]}</p>
      {multiVolumeHint ? (
        <p className="text-[12px] leading-snug text-muted-foreground">
          This pass can create several units from these pages.
        </p>
      ) : null}
      {recommendStaged ? (
        <label className="flex items-start gap-2 text-[12px] leading-snug text-muted-foreground">
          <input
            type="checkbox"
            className="mt-0.5 h-3.5 w-3.5 rounded border-border"
            checked={staged}
            onChange={(event) => onStagedChange(event.target.checked)}
            disabled={extracting}
          />
          Split these pages into smaller passes
        </label>
      ) : null}

      {showPhases ? (
        <div className="space-y-2">
          <ol className="grid gap-1">
            {phaseSteps.map((step, index) => {
              const activeId =
                activePhase === 'error'
                  ? null
                  : activePhase === 'done'
                    ? 'done'
                    : activePhase
              const stepIndex = phaseSteps.findIndex((s) => s.id === activeId)
              const isDone = activePhase === 'done' || (stepIndex >= 0 && index < stepIndex)
              const isActive =
                activePhase !== 'error' &&
                activePhase !== 'done' &&
                step.id === activePhase
              return (
                <li
                  key={step.id}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-2 py-1 text-[12px]',
                    isActive
                      ? 'bg-[var(--surface-2)] font-medium text-foreground'
                      : isDone
                        ? 'text-foreground'
                        : 'text-muted-foreground',
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums',
                      isActive
                        ? 'bg-foreground text-background'
                        : isDone
                          ? 'bg-[var(--surface-2)] text-foreground'
                          : 'bg-transparent text-muted-foreground ring-1 ring-border',
                    )}
                  >
                    {isDone && !isActive ? '✓' : index + 1}
                  </span>
                  {step.label}
                </li>
              )
            })}
          </ol>
          {progress?.detail && activePhase !== 'done' ? (
            <p className="px-1 text-[12px] leading-snug text-muted-foreground">{progress.detail}</p>
          ) : null}
        </div>
      ) : null}

      {errorMessage ? <p className="text-[12px] leading-snug text-amber-800">{errorMessage}</p> : null}
      {rangeChanged ? (
        <p className="text-[12px] leading-snug text-amber-800">
          The contents range changed. Extract again before saving.
        </p>
      ) : null}

      {hasOutline ? (
        <div className="grid gap-2">
          <p className="text-[13px] font-medium text-foreground">
            {outlineExtractSummary(unitCount, chunkCount, profile)}
          </p>
          <ul className="max-h-40 space-y-1 overflow-y-auto pr-0.5">
            {unitRows.map((row) => (
              <li
                key={row.id}
                className="flex items-baseline justify-between gap-2 rounded-lg bg-[var(--surface-2)] px-2 py-1.5"
              >
                <span className="min-w-0 truncate text-[12px] font-medium text-foreground">
                  {row.title || 'Untitled unit'}
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  {chunkCountLabel(row.chunkCount, profile)}
                </span>
              </li>
            ))}
          </ul>
          <Button type="button" size="sm" className="h-8" onClick={onReview}>
            Review
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export function BookExtractContentsRow({
  fileUrl,
  unitId,
  pdfReady,
  from,
  to,
  activePdfPage = null,
  extracting = false,
}: {
  fileUrl: string
  unitId: string
  pdfReady: boolean
  from: number
  to: number
  activePdfPage?: number | null
  extracting?: boolean
}) {
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null)
  const pages: number[] = []
  if (from <= to) {
    for (let page = from; page <= to; page++) pages.push(page)
  }
  if (pages.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-[13px] text-muted-foreground">
        Those contents pages are past the end of this PDF.
      </div>
    )
  }

  return (
    <div
      ref={setScrollRoot}
      className="flex min-h-0 flex-1 items-center overflow-x-auto overflow-y-hidden"
    >
      <div className="mx-auto flex w-max items-end gap-3 px-4 py-4">
        {pages.map((pdfPage) => {
          const isActive = activePdfPage != null && pdfPage === activePdfPage
          const dimOthers = extracting && activePdfPage != null && !isActive
          return (
            <div
              key={pdfPage}
              className={cn(
                'flex shrink-0 flex-col items-center gap-1.5 transition',
                dimOthers ? 'opacity-45' : 'opacity-100',
              )}
            >
              <div
                className={cn(
                  'rounded-lg',
                  isActive ? 'ring-2 ring-foreground ring-offset-2 ring-offset-[var(--surface-1,#0f1115)]' : null,
                )}
              >
                <PdfPageThumbnail
                  fileUrl={fileUrl}
                  unitId={unitId}
                  pageNumber={pdfPage}
                  width={200}
                  scrollRoot={scrollRoot}
                  pdfReady={pdfReady}
                  eager={pages.length <= 8 || isActive}
                  label={`Contents PDF ${pdfPage}`}
                />
              </div>
              <span
                className={cn(
                  'text-[12px] font-semibold tabular-nums',
                  isActive ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                PDF {pdfPage}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function BookExtractOutlineDraft({
  drafts,
  lessonsByUnitIndex,
  profile,
  extracting,
}: {
  drafts: TocUnitDraft[]
  lessonsByUnitIndex: BookLessonRecord[][]
  profile: TocExtractProfileId
  extracting: boolean
}) {
  if (drafts.length === 0) {
    return (
      <div className="flex min-h-[7rem] items-center justify-center border-t border-[var(--border)]/60 px-6 py-4 text-center text-[13px] text-muted-foreground">
        {extracting ? 'Building the outline…' : 'Press Extract to read these contents pages.'}
      </div>
    )
  }

  const chunkWord = tocChunkLabelStyleForProfile(profile) === 'week' ? 'Week' : 'Lesson'

  return (
    <div className="min-h-0 flex-1 overflow-y-auto border-t border-[var(--border)]/60 px-4 py-3">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {extracting ? 'Outline draft' : 'Outline'}
      </p>
      <ul className="space-y-2">
        {drafts.map((draft, unitIndex) => {
          const lessons = lessonsByUnitIndex[unitIndex] ?? []
          return (
            <li key={draft.id} className="rounded-xl bg-[var(--surface-3)] px-3 py-2">
              <p className="truncate text-[13px] font-semibold tracking-tight text-foreground">
                {draft.title || `Unit ${unitIndex + 1}`}
              </p>
              {lessons.length > 0 ? (
                <ul className="mt-1.5 space-y-0.5 border-t border-[var(--border)]/40 pt-1.5">
                  {lessons.map((lesson, lessonIndex) => (
                    <li
                      key={lesson.id}
                      className="truncate text-[12px] leading-snug text-muted-foreground"
                    >
                      {lesson.title || `${chunkWord} ${lessonIndex + 1}`}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-[12px] text-muted-foreground">
                  {extracting ? 'Filling…' : 'No weeks yet'}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

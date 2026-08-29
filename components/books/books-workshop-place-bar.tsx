'use client'

import { Fragment } from 'react'
import { BookA, ChevronRight, ListChecks, ScrollText } from 'lucide-react'
import {
  formatWorkshopPlaceLine,
  workshopPlaceSegments,
  type BooksWorkshopMarkPhase,
  type BooksWorkshopPlace,
  type BooksWorkshopSectionKind,
} from '@/lib/books/books-workshop'
import { BOOK_BOTTOM_CHROME_HEIGHT } from '@/components/students/fullscreen-book-overlay/constants'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { cn } from '@/lib/utils'

interface BooksWorkshopPlaceBarProps {
  place: BooksWorkshopPlace
  kind?: BooksWorkshopSectionKind | null
  /** Outlined / marked story — Text + Checks icons. */
  showStoryActions?: boolean
  onOpenText?: () => void
  onOpenChecks?: () => void
  textReady?: boolean
  checksApproved?: boolean
  hasUsableChecks?: boolean
  textOpen?: boolean
  checksOpen?: boolean
  /** Outlined / marked vocab — Words icon. */
  showVocabActions?: boolean
  onOpenWords?: () => void
  wordsReady?: boolean
  wordsOpen?: boolean
  /** Unmarked — Mark this section flow. */
  showMarkAction?: boolean
  markPhase?: BooksWorkshopMarkPhase
  markStart?: string
  markEnd?: string
  onMarkStartChange?: (value: string) => void
  onMarkEndChange?: (value: string) => void
  onStartMark?: () => void
  onCancelMark?: () => void
  onConfirmSpan?: () => void
  onPickMarkType?: (type: 'story' | 'vocab' | 'exercise') => void
  markBusy?: boolean
}

const iconBtn = cn(
  'relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
  'text-white/80 transition-colors hover:bg-white/15 hover:text-white',
  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30',
)

const textBtn = cn(
  'flex h-7 shrink-0 items-center rounded-full px-2.5',
  'text-[10px] font-medium transition-colors',
  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30',
)

/** Docked identity strip — trail + type chip; story / mark actions on the right. */
export function BooksWorkshopPlaceBar({
  place,
  kind,
  showStoryActions = false,
  onOpenText,
  onOpenChecks,
  textReady = false,
  checksApproved = false,
  hasUsableChecks = false,
  textOpen = false,
  checksOpen = false,
  showVocabActions = false,
  onOpenWords,
  wordsReady = false,
  wordsOpen = false,
  showMarkAction = false,
  markPhase = 'idle',
  markStart = '',
  markEnd = '',
  onMarkStartChange,
  onMarkEndChange,
  onStartMark,
  onCancelMark,
  onConfirmSpan,
  onPickMarkType,
  markBusy = false,
}: BooksWorkshopPlaceBarProps) {
  const { ancestors, current, typeChip } = workshopPlaceSegments(place, kind)
  const line = formatWorkshopPlaceLine(place, kind)

  return (
    <div
      className={cn(
        'flex w-full items-center gap-2.5 border-b border-white/[0.08] bg-[var(--book-reading-mat)] px-3 text-white',
      )}
      style={{ height: BOOK_BOTTOM_CHROME_HEIGHT }}
      role="banner"
      aria-label={line}
    >
      <Breadcrumb className="min-w-0 flex-1">
        <BreadcrumbList className="flex-nowrap gap-1 text-[11px] sm:gap-1">
          {ancestors.map((label) => (
            <Fragment key={label}>
              <BreadcrumbItem className="min-w-0 shrink">
                <span className="block max-w-[10rem] truncate text-white/50">{label}</span>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="mx-0 text-white/30 [&>svg]:size-3">
                <ChevronRight />
              </BreadcrumbSeparator>
            </Fragment>
          ))}
          <BreadcrumbItem className="min-w-0 shrink">
            <BreadcrumbPage className="max-w-[14rem] truncate font-medium text-white/90">
              {current}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      {typeChip ? (
        <span
          className={cn(
            'shrink-0 rounded-full bg-white/10 px-2 py-0.5',
            'text-[10px] font-medium text-white/85',
          )}
        >
          {typeChip}
        </span>
      ) : null}

      {showMarkAction && markPhase === 'idle' && onStartMark ? (
        <button
          type="button"
          title="Mark this section"
          aria-label="Mark this section"
          onClick={onStartMark}
          className={cn(textBtn, 'bg-white/10 text-white hover:bg-white/15')}
        >
          Mark this section
        </button>
      ) : null}

      {showMarkAction && markPhase === 'span' ? (
        <div className="flex shrink-0 items-center gap-1.5">
          <label className="flex items-center gap-1 text-[10px] text-white/55">
            Start
            <input
              inputMode="numeric"
              value={markStart}
              onChange={(e) => onMarkStartChange?.(e.target.value)}
              className="h-7 w-12 rounded-md border border-white/15 bg-black/25 px-1.5 text-[11px] font-medium tabular-nums text-white outline-none focus:ring-1 focus:ring-white/25"
              aria-label="Start page"
            />
          </label>
          <label className="flex items-center gap-1 text-[10px] text-white/55">
            End
            <input
              inputMode="numeric"
              value={markEnd}
              onChange={(e) => onMarkEndChange?.(e.target.value)}
              className="h-7 w-12 rounded-md border border-white/15 bg-black/25 px-1.5 text-[11px] font-medium tabular-nums text-white outline-none focus:ring-1 focus:ring-white/25"
              aria-label="End page"
            />
          </label>
          <button
            type="button"
            className={cn(textBtn, 'text-white/70 hover:bg-white/10 hover:text-white')}
            onClick={onCancelMark}
          >
            Cancel
          </button>
          <button
            type="button"
            className={cn(textBtn, 'bg-white/15 text-white hover:bg-white/20')}
            onClick={onConfirmSpan}
            disabled={markBusy}
          >
            Continue
          </button>
        </div>
      ) : null}

      {showMarkAction && markPhase === 'pickType' ? (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className={cn(textBtn, 'bg-white/15 text-white hover:bg-white/20')}
            disabled={markBusy}
            onClick={() => onPickMarkType?.('story')}
          >
            {markBusy ? 'Saving…' : 'Story'}
          </button>
          <button
            type="button"
            className={cn(textBtn, 'bg-white/10 text-white/90 hover:bg-white/15')}
            disabled={markBusy}
            onClick={() => onPickMarkType?.('vocab')}
          >
            Vocab
          </button>
          <button
            type="button"
            className={cn(textBtn, 'bg-white/10 text-white/90 hover:bg-white/15')}
            disabled={markBusy}
            onClick={() => onPickMarkType?.('exercise')}
          >
            Exercise
          </button>
          <button
            type="button"
            className={cn(textBtn, 'text-white/70 hover:bg-white/10 hover:text-white')}
            disabled={markBusy}
            onClick={onCancelMark}
          >
            Cancel
          </button>
        </div>
      ) : null}

      {showVocabActions && onOpenWords ? (
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            title={wordsReady ? 'Vocabulary words' : 'Scan or edit vocabulary words'}
            aria-label="Vocabulary words"
            aria-pressed={wordsOpen}
            onClick={onOpenWords}
            className={cn(iconBtn, wordsOpen && 'bg-white/15 text-white')}
          >
            <BookA className="h-3.5 w-3.5" aria-hidden />
            {!wordsReady ? (
              <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
            ) : (
              <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
            )}
          </button>
        </div>
      ) : null}

      {showStoryActions && onOpenText && onOpenChecks ? (
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            title={textReady ? 'Story text' : 'Scan or paste story text'}
            aria-label="Story text"
            aria-pressed={textOpen}
            onClick={onOpenText}
            className={cn(iconBtn, textOpen && 'bg-white/15 text-white')}
          >
            <ScrollText className="h-3.5 w-3.5" aria-hidden />
            {!textReady ? (
              <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
            ) : null}
          </button>
          <button
            type="button"
            title={
              checksApproved
                ? 'Reading checks (approved)'
                : hasUsableChecks
                  ? 'Reading checks'
                  : 'Add reading checks'
            }
            aria-label="Reading checks"
            aria-pressed={checksOpen}
            onClick={onOpenChecks}
            className={cn(iconBtn, checksOpen && 'bg-white/15 text-white')}
          >
            <ListChecks className="h-3.5 w-3.5" aria-hidden />
            {checksApproved ? (
              <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
            ) : !hasUsableChecks ? (
              <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
            ) : null}
          </button>
        </div>
      ) : null}
    </div>
  )
}

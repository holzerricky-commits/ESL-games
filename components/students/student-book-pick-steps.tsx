'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { BookCoverThumbnail } from '@/components/books/book-cover-thumbnail'
import { BookContentFormatBadge } from '@/components/books/book-content-format-badge'
import { bookHasCustomCover } from '@/lib/books/book-cover-display'
import {
  bookMatchesPickerFilters,
  formatBookGradeChipLabel,
  listBookPickerFacets,
  resolveBookCatalogIdentity,
  resolveBookPickInitialState,
  type BookPickStepId,
} from '@/lib/books/book-catalog-labels'
import type { BookLibraryPayload, BookRecord } from '@/lib/books/types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type BookPickStep = BookPickStepId

type StudentBookPickStepsBase = {
  library: BookLibraryPayload | null
  libraryLoading?: boolean
  pdfReady: boolean
  /** Remount / reset key — e.g. dialog open or setup editing session. */
  resetKey?: string | number | boolean
  className?: string
  /** Optional exit control (e.g. cancel editing books in setup). */
  onCancel?: () => void
}

type SingleModeProps = StudentBookPickStepsBase & {
  mode: 'single'
  onConfirm: (bookId: string) => void
  isSaving?: boolean
}

type MultiModeProps = StudentBookPickStepsBase & {
  mode: 'multi'
  initialSelectedIds?: string[]
  onConfirm: (bookIds: string[]) => void
  isSaving?: boolean
}

export type StudentBookPickStepsProps = SingleModeProps | MultiModeProps

const choiceButtonClass =
  'w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3.5 text-left text-base font-semibold text-foreground transition-colors hover:border-[var(--brand-blue)]/40 hover:bg-[var(--card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-blue)] sm:min-w-[10rem] sm:flex-1'

function BookCoverCard({
  book,
  pdfReady,
  selected,
  onSelect,
  multi,
}: {
  book: BookRecord
  pdfReady: boolean
  selected: boolean
  onSelect: () => void
  multi: boolean
}) {
  const firstUnit = book.units[0]
  const showCover = firstUnit && (bookHasCustomCover(book) || pdfReady)
  const identity = resolveBookCatalogIdentity(book)

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-blue)]',
        selected
          ? 'border-[var(--brand-blue)]/50 bg-[var(--brand-blue)]/5'
          : 'border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--card)]',
      )}
    >
      {multi ? (
        <span
          className={cn(
            'mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px]',
            selected
              ? 'border-[var(--brand-blue)] bg-[var(--brand-blue)] text-white'
              : 'border-[var(--border)] bg-background',
          )}
          aria-hidden
        >
          {selected ? '✓' : ''}
        </span>
      ) : null}
      {showCover && firstUnit ? (
        <BookCoverThumbnail
          book={book}
          unitId={firstUnit.id}
          width={72}
          pdfReady={pdfReady}
          label={`${book.title} cover`}
          className="shrink-0"
        />
      ) : (
        <div className="flex h-[102px] w-[72px] shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-background text-[10px] text-muted-foreground">
          No cover
        </div>
      )}
      <span className="min-w-0 flex-1 self-center">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-semibold leading-snug text-foreground">{book.title}</span>
          <BookContentFormatBadge book={book} />
        </span>
        {identity.role ? (
          <span className="mt-1 block text-xs text-muted-foreground">{identity.role}</span>
        ) : null}
      </span>
    </button>
  )
}

export function StudentBookPickSteps(props: StudentBookPickStepsProps) {
  const { library, libraryLoading = false, pdfReady, resetKey, className, onCancel } = props
  const books = library?.books ?? []
  const facets = useMemo(() => listBookPickerFacets(books), [books])

  const [step, setStep] = useState<BookPickStep>('series')
  const [series, setSeries] = useState<string | null>(null)
  const [grade, setGrade] = useState<string | null>(null)
  const [draftIds, setDraftIds] = useState<string[]>(
    props.mode === 'multi' ? (props.initialSelectedIds ?? []) : [],
  )

  function bookIdsForSeriesGrade(seriesValue: string, gradeValue: string | null) {
    return books
      .filter((book) => bookMatchesPickerFilters(book, { series: seriesValue, grade: gradeValue }))
      .map((book) => book.id)
  }

  /** Preselect this grade’s books; keep picks from other series only. */
  function selectionForGrade(
    prevIds: string[],
    seriesValue: string,
    gradeValue: string | null,
  ) {
    const gradeIds = bookIdsForSeriesGrade(seriesValue, gradeValue)
    const sameSeriesIds = new Set(
      books
        .filter((book) => resolveBookCatalogIdentity(book).series === seriesValue)
        .map((book) => book.id),
    )
    const keptFromOtherSeries = prevIds.filter((id) => !sameSeriesIds.has(id))
    return [...keptFromOtherSeries, ...gradeIds]
  }

  useEffect(() => {
    const initial = resolveBookPickInitialState(books)
    setStep(initial.step)
    setSeries(initial.series)
    setGrade(initial.grade)
    if (props.mode === 'multi') {
      const seeded = props.initialSelectedIds ?? []
      if (seeded.length > 0) {
        setDraftIds(seeded)
      } else if (initial.step === 'book' && initial.series) {
        setDraftIds(bookIdsForSeriesGrade(initial.series, initial.grade))
      } else {
        setDraftIds([])
      }
    } else {
      setDraftIds([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when dialog/setup session changes
  }, [resetKey, facets.series.join('|')])

  const gradeOptions = series ? (facets.gradesBySeries[series] ?? []) : []

  const filteredBooks = useMemo(() => {
    if (!series) return []
    return books.filter((book) => bookMatchesPickerFilters(book, { series, grade }))
  }, [books, series, grade])

  function pickSeries(next: string) {
    setSeries(next)
    const grades = facets.gradesBySeries[next] ?? []
    if (grades.length <= 1) {
      const nextGrade = grades[0] ?? null
      setGrade(nextGrade)
      setStep('book')
      if (props.mode === 'multi') {
        setDraftIds((prev) => selectionForGrade(prev, next, nextGrade))
      }
      return
    }
    setGrade(null)
    setStep('grade')
  }

  function pickGrade(next: string) {
    setGrade(next)
    setStep('book')
    if (props.mode === 'multi' && series) {
      setDraftIds((prev) => selectionForGrade(prev, series, next))
    }
  }

  function goBack() {
    if (step === 'book') {
      if (series && (facets.gradesBySeries[series] ?? []).length > 1) {
        setGrade(null)
        setStep('grade')
        return
      }
      if (facets.series.length > 1) {
        setSeries(null)
        setGrade(null)
        setStep('series')
      }
      return
    }
    if (step === 'grade') {
      if (facets.series.length > 1) {
        setSeries(null)
        setGrade(null)
        setStep('series')
      }
    }
  }

  const canGoBack =
    (step === 'grade' && facets.series.length > 1) ||
    (step === 'book' &&
      ((series != null && (facets.gradesBySeries[series] ?? []).length > 1) || facets.series.length > 1))

  const crumbParts: string[] = []
  if (series) crumbParts.push(series)
  if (grade) crumbParts.push(formatBookGradeChipLabel(grade))

  function toggleMulti(bookId: string) {
    setDraftIds((prev) =>
      prev.includes(bookId) ? prev.filter((id) => id !== bookId) : [...prev, bookId],
    )
  }

  const showNavBar = canGoBack || crumbParts.length > 0 || Boolean(onCancel)

  if (libraryLoading) {
    return <p className={cn('text-sm text-muted-foreground', className)}>Loading books…</p>
  }

  if (books.length === 0) {
    return <p className={cn('text-sm text-muted-foreground', className)}>No books in your library yet.</p>
  }

  return (
    <div className={cn('space-y-4', className)}>
      {showNavBar ? (
        <div className="flex flex-wrap items-center gap-2">
          {canGoBack ? (
            <button
              type="button"
              onClick={goBack}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft size={14} aria-hidden />
              Back
            </button>
          ) : null}
          {crumbParts.length > 0 ? (
            <p className="text-sm text-muted-foreground">{crumbParts.join(' · ')}</p>
          ) : null}
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="ml-auto text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Cancel
            </button>
          ) : null}
        </div>
      ) : null}

      {step === 'series' ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {facets.series.map((item) => (
            <button key={item} type="button" className={choiceButtonClass} onClick={() => pickSeries(item)}>
              {item}
            </button>
          ))}
        </div>
      ) : null}

      {step === 'grade' && series ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {gradeOptions.map((item) => (
            <button
              key={item}
              type="button"
              className={choiceButtonClass}
              onClick={() => pickGrade(item)}
            >
              {formatBookGradeChipLabel(item)}
            </button>
          ))}
        </div>
      ) : null}

      {step === 'book' && series ? (
        <div className="space-y-3">
          {filteredBooks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No books here.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredBooks.map((book) => (
                <BookCoverCard
                  key={book.id}
                  book={book}
                  pdfReady={pdfReady}
                  multi={props.mode === 'multi'}
                  selected={props.mode === 'multi' ? draftIds.includes(book.id) : false}
                  onSelect={() => {
                    if (props.mode === 'single') {
                      if (props.isSaving) return
                      props.onConfirm(book.id)
                      return
                    }
                    toggleMulti(book.id)
                  }}
                />
              ))}
            </div>
          )}

          {props.mode === 'multi' ? (
            <div className="pt-1">
              <Button
                type="button"
                onClick={() => props.onConfirm(draftIds)}
                disabled={props.isSaving || libraryLoading || draftIds.length === 0}
              >
                {props.isSaving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          ) : props.isSaving ? (
            <p className="text-sm text-muted-foreground">Saving…</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

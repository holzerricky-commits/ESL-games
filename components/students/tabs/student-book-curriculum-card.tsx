'use client'

import { useEffect, useMemo } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { BookCoverThumbnail } from '@/components/books/book-cover-thumbnail'
import { BookContentFormatBadge } from '@/components/books/book-content-format-badge'
import { bookHasCustomCover } from '@/lib/books/book-cover-display'
import { formatEffectivePageSpan, mapPdfPageToDisplayLabel } from '@/lib/books/page-numbering'
import { isPresentationBook } from '@/lib/books/book-catalog-labels'
import type { BookLibraryPayload, BookRecord } from '@/lib/books/types'
import {
  getStudentSectionOptions,
  isStudentCurriculumBookStartFresherThanLastStop,
  resolveCurriculumBookStarts,
  type StudentCurriculumBookStart,
  type StudentSectionOption,
} from '@/lib/students/selectors'
import type { StudentClassSessionView, StudentProfileView } from '@/lib/students/types'
import { StudentCurriculumBookPreview } from '@/components/students/tabs/student-curriculum-book-preview'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

function sectionDisplayTitle(option: StudentSectionOption): string {
  return (option.partTitle ?? option.lessonTitle ?? option.title ?? option.pathLabel).trim()
}

interface StudentBookCurriculumCardProps {
  book: BookRecord
  library: BookLibraryPayload
  student: StudentProfileView
  pdfReady: boolean
  scheduledClasses: StudentClassSessionView[]
  isGlobalLatestStop?: boolean
  /** Matches the Next class “what we’re teaching” book. */
  isTodayTeachingBook?: boolean
  autoOpenPreview?: boolean
  previewOpen?: boolean
  previewUnitId?: string
  previewPage?: number
  onOpenPreview: (unitId?: string, page?: number) => void
  onClosePreview: () => void
  onRemove: () => void
  onDataUpdated: () => void
}

export function StudentBookCurriculumCard({
  book,
  library,
  student,
  pdfReady,
  scheduledClasses,
  isGlobalLatestStop = false,
  isTodayTeachingBook = false,
  autoOpenPreview = false,
  previewOpen = false,
  previewUnitId,
  previewPage,
  onOpenPreview,
  onClosePreview,
  onRemove,
  onDataUpdated,
}: StudentBookCurriculumCardProps) {
  const firstUnit = book.units[0] ?? null
  const showCover = firstUnit && (bookHasCustomCover(book) || pdfReady)

  const sectionOptions = useMemo(
    () => getStudentSectionOptions(student.id, library),
    [student.id, library],
  )

  const bookStart: StudentCurriculumBookStart | null = useMemo(() => {
    const starts = resolveCurriculumBookStarts(
      {
        curriculumBookStarts: student.curriculumBookStarts,
        curriculumAnchorSectionId: student.curriculumAnchorSectionId,
        updatedAt: '',
      },
      library,
      sectionOptions,
    )
    return starts[book.id] ?? null
  }, [student.curriculumBookStarts, student.curriculumAnchorSectionId, library, sectionOptions, book.id])

  const anchorOption = useMemo(() => {
    if (!bookStart) return null
    return sectionOptions.find((o) => o.id === bookStart.sectionId) ?? null
  }, [bookStart, sectionOptions])

  const latestBookmarkSession = useMemo(() => {
    const withBm = scheduledClasses.filter(
      (s) => s.status === 'completed' && s.bookmarkAtEnd?.bookId === book.id,
    )
    if (!withBm.length) return null
    return (
      [...withBm].sort((a, b) => {
        const tb = Date.parse(b.classEndedAt ?? b.updatedAt ?? b.scheduledFor)
        const ta = Date.parse(a.classEndedAt ?? a.updatedAt ?? a.scheduledFor)
        return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0)
      })[0] ?? null
    )
  }, [scheduledClasses, book.id])

  const latestBookmark = latestBookmarkSession?.bookmarkAtEnd ?? null

  const startFresherThanStop = useMemo(
    () => isStudentCurriculumBookStartFresherThanLastStop(student.id, book.id, library),
    [student.id, book.id, library, bookStart, latestBookmarkSession],
  )

  const bookmarkUnit = latestBookmark?.unitId
    ? book.units.find((u) => u.id === latestBookmark.unitId)
    : firstUnit

  const defaultOpenUnitId = startFresherThanStop
    ? (bookStart?.unitId ?? firstUnit?.id ?? book.units[0]?.id)
    : (latestBookmark?.unitId ?? bookStart?.unitId ?? firstUnit?.id ?? book.units[0]?.id)

  const needsStartSetup = !latestBookmark && !bookStart

  const continuePageLabel = useMemo(() => {
    if (!latestBookmark || !bookmarkUnit) return null
    return mapPdfPageToDisplayLabel(latestBookmark.pdfPage, book, bookmarkUnit, null, 'mapped')
  }, [latestBookmark, bookmarkUnit, book])

  const openMappedPage = useMemo(() => {
    if (previewPage != null) return previewPage
    if (startFresherThanStop) return bookStart?.mappedPage
    if (latestBookmark) return undefined
    return bookStart?.mappedPage
  }, [previewPage, startFresherThanStop, latestBookmark, bookStart?.mappedPage])

  useEffect(() => {
    if (autoOpenPreview && !previewOpen) {
      onOpenPreview(defaultOpenUnitId, startFresherThanStop ? bookStart?.mappedPage : undefined)
    }
  }, [
    autoOpenPreview,
    previewOpen,
    defaultOpenUnitId,
    bookStart?.mappedPage,
    startFresherThanStop,
    onOpenPreview,
  ])

  const statusChip = useMemo(() => {
    if (startFresherThanStop && bookStart && anchorOption) {
      const unit = book.units.find((u) => u.id === bookStart.unitId)
      const pageLabel =
        unit != null
          ? String(bookStart.mappedPage)
          : typeof anchorOption.startPageHint === 'number'
            ? String(anchorOption.startPageHint)
            : null
      const span =
        unit && typeof anchorOption.startPageHint === 'number'
          ? formatEffectivePageSpan(
              anchorOption.startPageHint,
              anchorOption.endPageHint ?? null,
              book,
              unit,
              null,
              'mapped',
            )
          : ''
      const spanBit =
        pageLabel != null
          ? ` · p. ${pageLabel}`
          : span && span !== 'pages —' && !span.startsWith('pages —')
            ? ` · ${span}`
            : ''
      return {
        tone: 'set' as const,
        label: `Starts: ${sectionDisplayTitle(anchorOption)}${spanBit}`,
      }
    }
    if (latestBookmark && bookmarkUnit && continuePageLabel) {
      const prefix = isGlobalLatestStop ? 'Latest stop' : 'Last class'
      return {
        tone: 'progress' as const,
        label: `${prefix}: p. ${continuePageLabel}`,
      }
    }
    if (bookStart && anchorOption) {
      const unit = book.units.find((u) => u.id === bookStart.unitId)
      const pageLabel =
        unit != null
          ? String(bookStart.mappedPage)
          : typeof anchorOption.startPageHint === 'number'
            ? String(anchorOption.startPageHint)
            : null
      const span =
        unit && typeof anchorOption.startPageHint === 'number'
          ? formatEffectivePageSpan(
              anchorOption.startPageHint,
              anchorOption.endPageHint ?? null,
              book,
              unit,
              null,
              'mapped',
            )
          : ''
      const spanBit =
        pageLabel != null
          ? ` · p. ${pageLabel}`
          : span && span !== 'pages —' && !span.startsWith('pages —')
            ? ` · ${span}`
            : ''
      return {
        tone: 'set' as const,
        label: `Starts: ${sectionDisplayTitle(anchorOption)}${spanBit}`,
      }
    }
    return {
      tone: 'unset' as const,
      label: 'Set starting place',
    }
  }, [
    startFresherThanStop,
    latestBookmark,
    bookmarkUnit,
    continuePageLabel,
    isGlobalLatestStop,
    bookStart,
    anchorOption,
    book,
  ])

  const primaryLabel = useMemo(() => {
    if (previewOpen) return 'Close preview'
    if (needsStartSetup) return 'Set starting place'
    if (startFresherThanStop && bookStart) return `Open at p. ${bookStart.mappedPage}`
    if (continuePageLabel) return `Continue at p. ${continuePageLabel}`
    if (bookStart) return `Open at p. ${bookStart.mappedPage}`
    return isPresentationBook(book) ? 'Open presentation' : 'Open book'
  }, [previewOpen, needsStartSetup, startFresherThanStop, continuePageLabel, bookStart, book])

  function openPreview() {
    if (previewOpen) {
      onClosePreview()
      return
    }
    // Bookmark stores PDF index; starting place stores mapped page. Preview treats
    // initialPage as mapped — pass mapped start when plan pin wins; else resume path.
    if (startFresherThanStop) {
      onOpenPreview(defaultOpenUnitId, bookStart?.mappedPage)
    } else if (latestBookmark) {
      onOpenPreview(defaultOpenUnitId, undefined)
    } else {
      onOpenPreview(defaultOpenUnitId, bookStart?.mappedPage)
    }
  }

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
      <div className="flex gap-4 p-4">
        <button
          type="button"
          onClick={openPreview}
          className="shrink-0 rounded-md text-left transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-blue)]"
          aria-label={`${primaryLabel}: ${book.title}`}
        >
          {showCover && firstUnit ? (
            <BookCoverThumbnail
              book={book}
              unitId={firstUnit.id}
              width={88}
              pdfReady={pdfReady}
              label={`${book.title} cover`}
            />
          ) : (
            <div className="flex h-[124px] w-[88px] items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-2)] text-xs text-muted-foreground">
              No cover
            </div>
          )}
        </button>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              onClick={openPreview}
              className="min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-blue)] rounded-sm"
            >
              <h4 className="text-base font-semibold leading-tight text-foreground hover:underline underline-offset-2">
                {book.title}
              </h4>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <BookContentFormatBadge book={book} />
                {isTodayTeachingBook ? (
                  <span className="rounded-full bg-[var(--brand-blue)]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--brand-blue)]">
                    Today
                  </span>
                ) : null}
                {isGlobalLatestStop && !isTodayTeachingBook ? (
                  <span className="rounded-full bg-[var(--brand-green)]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--brand-green)]">
                    Last class
                  </span>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {book.units.length} unit{book.units.length === 1 ? '' : 's'}
                </p>
              </div>
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon-sm" className="shrink-0 text-muted-foreground">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Book options</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem variant="destructive" onClick={onRemove}>
                  {isPresentationBook(book) ? 'Remove presentation' : 'Remove book'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <span
            className={cn(
              'inline-flex max-w-full rounded-full px-2.5 py-0.5 text-xs font-medium',
              statusChip.tone === 'unset' && 'bg-amber-500/15 text-amber-800 dark:text-amber-200',
              statusChip.tone === 'set' && 'bg-[var(--brand-blue)]/10 text-[var(--brand-blue)]',
              statusChip.tone === 'progress' && 'bg-[var(--brand-green)]/10 text-[var(--brand-green)]',
            )}
          >
            <span className="truncate">{statusChip.label}</span>
          </span>

          <div className="pt-1">
            <Button
              type="button"
              size="sm"
              variant={previewOpen ? 'secondary' : needsStartSetup ? 'default' : 'outline'}
              onClick={openPreview}
            >
              {primaryLabel}
            </Button>
          </div>
        </div>
      </div>

      {previewOpen ? (
        <StudentCurriculumBookPreview
          key={`${book.id}-${previewUnitId ?? defaultOpenUnitId}-${openMappedPage ?? 'resume'}`}
          book={book}
          library={library}
          studentId={student.id}
          pdfReady={pdfReady}
          initialUnitId={previewUnitId ?? defaultOpenUnitId}
          initialPage={openMappedPage}
          onClose={onClosePreview}
          onStartSaved={onDataUpdated}
        />
      ) : null}
    </article>
  )
}

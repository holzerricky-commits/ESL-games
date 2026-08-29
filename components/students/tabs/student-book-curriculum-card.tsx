'use client'

import { useEffect, useMemo } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { BookCoverMockup } from '@/components/books/book-cover-mockup'
import { BookCoverMockupArt } from '@/components/books/book-cover-mockup-art'
import { CachedBookImage } from '@/components/books/cached-book-image'
import {
  bookCoverImageUrl,
  getBookCoverSource,
} from '@/lib/books/book-cover-display'
import { mapPdfPageToDisplayLabel } from '@/lib/books/page-numbering'
import { isPresentationBook } from '@/lib/books/book-catalog-labels'
import type { BookLibraryPayload, BookRecord } from '@/lib/books/types'
import {
  getStudentSectionOptions,
  isStudentCurriculumBookStartFresherThanLastStop,
  resolveCurriculumBookStarts,
  type StudentCurriculumBookStart,
} from '@/lib/students/selectors'
import type { StudentClassSessionView, StudentProfileView } from '@/lib/students/types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const SHELF_COVER_WIDTH = 180

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
  onOpenPreview: (unitId?: string, page?: number) => void
  onClosePreview: () => void
  onRemove: () => void
}

export function StudentBookCurriculumCard({
  book,
  library,
  student,
  pdfReady: _pdfReady,
  scheduledClasses,
  isGlobalLatestStop = false,
  isTodayTeachingBook = false,
  autoOpenPreview = false,
  previewOpen = false,
  onOpenPreview,
  onClosePreview,
  onRemove,
}: StudentBookCurriculumCardProps) {
  const firstUnit = book.units[0] ?? null
  const coverSource = getBookCoverSource(book, 1)

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

  /** One short status line under the cover. */
  const statusLine = useMemo(() => {
    const todayPrefix = isTodayTeachingBook ? 'Today' : null
    const lastPrefix = isGlobalLatestStop && !isTodayTeachingBook ? 'Last' : null

    if (startFresherThanStop && bookStart) {
      const page = `p. ${bookStart.mappedPage}`
      return todayPrefix ? `${todayPrefix} · ${page}` : `Start · ${page}`
    }
    if (latestBookmark && continuePageLabel) {
      const page = `p. ${continuePageLabel}`
      if (todayPrefix) return `${todayPrefix} · ${page}`
      if (lastPrefix) return `${lastPrefix} · ${page}`
      return page
    }
    if (bookStart) {
      const page = `p. ${bookStart.mappedPage}`
      return todayPrefix ? `${todayPrefix} · ${page}` : `Start · ${page}`
    }
    if (todayPrefix) return `${todayPrefix} · Set start`
    return 'Set start'
  }, [
    isTodayTeachingBook,
    isGlobalLatestStop,
    startFresherThanStop,
    bookStart,
    latestBookmark,
    continuePageLabel,
  ])

  const statusTone = needsStartSetup
    ? 'unset'
    : startFresherThanStop
      ? 'set'
      : latestBookmark
        ? 'progress'
        : bookStart
          ? 'set'
          : 'unset'

  const ariaAction = useMemo(() => {
    if (previewOpen) return 'Close preview'
    if (needsStartSetup) return 'Set start'
    if (startFresherThanStop && bookStart) return `Open at page ${bookStart.mappedPage}`
    if (continuePageLabel) return `Continue at page ${continuePageLabel}`
    if (bookStart) return `Open at page ${bookStart.mappedPage}`
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
    <article
      className={cn(
        'group relative flex w-full max-w-[180px] flex-col gap-2.5 transition',
        previewOpen ? 'opacity-100' : undefined,
      )}
    >
      <div className="relative">
        <button
          type="button"
          onClick={openPreview}
          className={cn(
            'relative flex w-full justify-center text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2',
            previewOpen && 'rounded-md ring-2 ring-[var(--brand-blue)] ring-offset-2 ring-offset-[var(--background)]',
          )}
          aria-label={`${ariaAction}: ${book.title}`}
          aria-expanded={previewOpen}
        >
          <span className="relative inline-block shrink-0">
            <BookCoverMockup widthPx={SHELF_COVER_WIDTH} interactive={!previewOpen}>
              {coverSource?.kind === 'image' ? (
                <CachedBookImage
                  src={bookCoverImageUrl(coverSource.imagePath)}
                  className="book-cover-mockup__art"
                />
              ) : coverSource?.kind === 'pdf' ? (
                <BookCoverMockupArt
                  filePath={coverSource.filePath}
                  pageNumber={coverSource.pageNumber}
                  label={book.title}
                />
              ) : (
                <div className="book-cover-mockup__fallback">
                  <span className="book-cover-mockup__fallback-label">{book.title}</span>
                </div>
              )}
            </BookCoverMockup>
            <span
              className={cn(
                'pointer-events-none absolute left-2 top-2 z-10 h-2 w-2 rounded-full shadow-[0_0_0_2px_rgba(255,255,255,0.85)]',
                statusTone === 'unset' && 'bg-[var(--brand-yellow)]',
                statusTone === 'set' && 'bg-[var(--brand-blue)]',
                statusTone === 'progress' && 'bg-[var(--brand-green)]',
              )}
              title={statusLine}
              aria-hidden
            />
          </span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'absolute right-1 top-1 z-20 flex h-7 w-7 items-center justify-center rounded-full',
                'bg-[var(--surface-2)]/90 text-muted-foreground shadow-sm backdrop-blur-sm transition',
                'opacity-80 hover:bg-[var(--surface-2)] hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100',
                'active:scale-95',
              )}
              aria-label="Book options"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem variant="destructive" onClick={onRemove}>
              {isPresentationBook(book) ? 'Remove presentation' : 'Remove book'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="min-w-0 space-y-0.5 px-0.5">
        <button
          type="button"
          onClick={openPreview}
          className="line-clamp-2 w-full text-left text-[13px] font-medium leading-snug tracking-tight text-foreground transition hover:opacity-80"
        >
          {book.title}
        </button>
        <p
          className={cn(
            'truncate text-[12px] leading-snug',
            statusTone === 'unset' ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground',
          )}
        >
          {statusLine}
        </p>
      </div>
    </article>
  )
}

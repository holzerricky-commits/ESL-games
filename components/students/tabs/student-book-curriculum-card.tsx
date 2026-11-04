'use client'

import { useEffect, useMemo, type CSSProperties, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react'
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
import type { StudentBookAssignmentStatus } from '@/lib/types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const SHELF_COVER_WIDTH = 180
const ROW_COVER_WIDTH = 112

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
  assignmentStatus: StudentBookAssignmentStatus
  onSetStatus: (status: StudentBookAssignmentStatus) => void
  onRemove: () => void
  /** Cover left, place info right. Default is a tall shelf cover. */
  layout?: 'stack' | 'row'
  /** Optional lesson / unit line under the place status. */
  lessonLine?: string | null
  /** Cover is following the pointer. The slot keeps a placeholder. */
  coverLift?: { width: number; height: number; style: CSSProperties } | null
  onCoverPointerDown?: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onCoverClick?: (event: ReactMouseEvent<HTMLButtonElement>) => void
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
  assignmentStatus,
  onSetStatus,
  onRemove,
  layout = 'stack',
  lessonLine = null,
  coverLift = null,
  onCoverPointerDown,
  onCoverClick,
}: StudentBookCurriculumCardProps) {
  const firstUnit = book.units[0] ?? null
  const coverWidth = layout === 'row' ? ROW_COVER_WIDTH : SHELF_COVER_WIDTH
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

  const unitLine = useMemo(() => {
    if (lessonLine?.trim()) return lessonLine.trim()
    const unitId = defaultOpenUnitId
    const unit = unitId ? book.units.find((u) => u.id === unitId) : null
    return unit?.title?.trim() || null
  }, [lessonLine, defaultOpenUnitId, book.units])

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
    if (previewOpen) return 'Close'
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
    if (startFresherThanStop) {
      onOpenPreview(defaultOpenUnitId, bookStart?.mappedPage)
    } else if (latestBookmark) {
      onOpenPreview(defaultOpenUnitId, undefined)
    } else {
      onOpenPreview(defaultOpenUnitId, bookStart?.mappedPage)
    }
  }

  const coverButton = (
    <button
      type="button"
      data-shelf-drag-cover=""
      onPointerDown={onCoverPointerDown}
      onClick={(event) => {
        onCoverClick?.(event)
        if (event.defaultPrevented) return
        openPreview()
      }}
      className={cn(
        'relative flex shrink-0 cursor-grab justify-center text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 active:cursor-grabbing',
        previewOpen && !coverLift && 'rounded-md ring-2 ring-[var(--brand-blue)] ring-offset-2 ring-offset-[var(--background)]',
      )}
      style={coverLift ? { ...coverLift.style, touchAction: 'none' } : { touchAction: 'none' }}
      aria-label={`${ariaAction}: ${book.title}`}
      aria-expanded={previewOpen}
      aria-grabbed={coverLift ? true : undefined}
    >
      <span className="relative inline-block shrink-0">
        <BookCoverMockup widthPx={coverWidth} interactive={!previewOpen && !coverLift}>
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
  )

  const optionsMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-full',
            'bg-[var(--surface-2)]/90 text-muted-foreground shadow-sm backdrop-blur-sm transition',
            'opacity-80 hover:bg-[var(--surface-2)] hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100',
            'active:scale-95',
            coverLift && 'hidden',
            layout === 'stack' && 'absolute right-1 top-1 z-20',
          )}
          aria-label="Book options"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {assignmentStatus !== 'in_class' ? (
          <DropdownMenuItem onClick={() => onSetStatus('in_class')}>In class</DropdownMenuItem>
        ) : null}
        {assignmentStatus !== 'paused' ? (
          <DropdownMenuItem onClick={() => onSetStatus('paused')}>Pause</DropdownMenuItem>
        ) : null}
        {assignmentStatus !== 'finished' ? (
          <DropdownMenuItem onClick={() => onSetStatus('finished')}>Finished</DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onRemove}>
          {isPresentationBook(book) ? 'Remove presentation' : 'Remove book'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  if (layout === 'row') {
    return (
      <article
        className={cn(
          'group relative flex w-full items-start gap-4 rounded-xl p-1 transition',
          previewOpen ? 'opacity-100' : undefined,
        )}
      >
        <div className="relative shrink-0">
          {coverLift ? (
            <span
              aria-hidden
              className="block rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-3)]/50"
              style={{ width: coverLift.width, height: coverLift.height }}
            />
          ) : null}
          {coverButton}
        </div>

        <div className="min-w-0 flex-1 space-y-1 pt-1">
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              onClick={openPreview}
              className="line-clamp-2 text-left text-[15px] font-medium leading-snug tracking-tight text-foreground transition hover:opacity-80"
            >
              {book.title}
            </button>
            <div className="relative shrink-0">{optionsMenu}</div>
          </div>
          <p
            className={cn(
              'text-[13px] leading-snug',
              statusTone === 'unset' ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground',
            )}
          >
            {statusLine}
          </p>
          {unitLine ? (
            <p className="truncate text-[12px] leading-snug text-muted-foreground/90">{unitLine}</p>
          ) : null}
          <button
            type="button"
            onClick={openPreview}
            className="pt-1 text-left text-[12px] font-medium text-foreground/80 transition hover:text-foreground"
          >
            {needsStartSetup ? 'Set start' : previewOpen ? 'Close' : 'Open'}
          </button>
        </div>
      </article>
    )
  }

  return (
    <article
      className={cn(
        'group relative flex w-full max-w-[180px] flex-col gap-2.5 transition',
        previewOpen ? 'opacity-100' : undefined,
      )}
    >
      <div className="relative">
        {coverLift ? (
          <span
            aria-hidden
            className="block rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-3)]/50"
            style={{ width: coverLift.width, height: coverLift.height }}
          />
        ) : null}
        {coverButton}
        {optionsMenu}
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

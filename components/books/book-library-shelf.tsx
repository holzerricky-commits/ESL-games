'use client'

import { useMemo } from 'react'
import { Plus } from 'lucide-react'
import { BookCoverMockup } from '@/components/books/book-cover-mockup'
import { BookCoverMockupArt } from '@/components/books/book-cover-mockup-art'
import { CachedBookImage } from '@/components/books/cached-book-image'
import {
  bookCoverImageUrl,
  getBookCoverSource,
} from '@/lib/books/book-cover-display'
import { resolveBookCatalogIdentity } from '@/lib/books/book-catalog-labels'
import { groupBooksIntoSeriesShelves } from '@/lib/books/book-library-shelves'
import {
  BOOK_SHELF_STATUS_LABEL,
  resolveBookShelfStatus,
  type BookShelfStatus,
} from '@/lib/books/book-shelf-status'
import type { BookRecord } from '@/lib/books/types'
import { cn } from '@/lib/utils'

/** Dense shelf — larger covers, still the welcome hardcover chrome. */
const SHELF_COVER_WIDTH = 200

function statusDotClass(status: BookShelfStatus): string {
  if (status === 'needs_outline') return 'bg-[var(--brand-yellow)]'
  if (status === 'has_stories') return 'bg-[var(--brand-blue)]'
  return 'bg-[var(--brand-green)]'
}

function seriesSectionId(series: string): string {
  return `shelf-series-${series.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'other'}`
}

interface BookLibraryShelfProps {
  books: BookRecord[]
  pdfReady: boolean
  /** Cover click → lesson shelf (or outline empty state). */
  onOpenBook: (bookId: string) => void
  onAddBook: () => void
}

/**
 * Series rows (horizontal): one line per series, books in G1 → G2 → G3… order.
 */
export function BookLibraryShelf({
  books,
  pdfReady,
  onOpenBook,
  onAddBook,
}: BookLibraryShelfProps) {
  const shelves = useMemo(() => groupBooksIntoSeriesShelves(books), [books])

  return (
    <section className="space-y-8">
      <header className="flex items-end justify-between gap-4 px-0.5">
        <div>
          <h3 className="text-[28px] font-semibold tracking-tight text-foreground">Library</h3>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {books.length} {books.length === 1 ? 'book' : 'books'}
            {shelves.length > 1 ? ` · ${shelves.length} series` : null}
          </p>
        </div>
        <button
          type="button"
          onClick={onAddBook}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-3)] text-foreground transition hover:bg-[var(--surface-4)] active:scale-95"
          aria-label="Add book"
          title="Add book"
        >
          <Plus className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        </button>
      </header>

      {shelves.length > 1 ? (
        <nav className="flex flex-wrap gap-2 px-0.5" aria-label="Jump to series">
          {shelves.map((shelf) => (
            <a
              key={shelf.series}
              href={`#${seriesSectionId(shelf.series)}`}
              className="rounded-full bg-[var(--surface-3)] px-3 py-1.5 text-[12px] font-medium text-foreground transition hover:bg-[var(--surface-4)]"
            >
              {shelf.series}
              <span className="ml-1.5 text-muted-foreground">{shelf.books.length}</span>
            </a>
          ))}
        </nav>
      ) : null}

      <div className="space-y-8">
        {shelves.map((shelf) => (
          <section
            key={shelf.series}
            id={seriesSectionId(shelf.series)}
            className="scroll-mt-6 space-y-3"
          >
            <div className="flex items-baseline justify-between gap-3 px-0.5">
              <h4 className="text-[17px] font-semibold tracking-tight text-foreground">
                {shelf.series}
              </h4>
              <span className="text-[12px] text-muted-foreground">
                {shelf.books.length} {shelf.books.length === 1 ? 'book' : 'books'}
              </span>
            </div>

            <div className="-mx-1 overflow-x-auto pb-2 pt-1 [scrollbar-width:thin]">
              <ul className="flex w-max flex-row items-start gap-4 px-1">
                {shelf.books.map((book, index) => {
                  const grade = resolveBookCatalogIdentity(book).grade?.trim()
                  const prevGrade =
                    index > 0
                      ? resolveBookCatalogIdentity(shelf.books[index - 1]!).grade?.trim()
                      : null
                  const showGradeTick = Boolean(grade && grade !== prevGrade)

                  return (
                    <li key={book.id} className="w-[200px] shrink-0">
                      {showGradeTick ? (
                        <p className="mb-2 truncate px-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          {grade}
                        </p>
                      ) : (
                        <div className="mb-2 h-[16px]" aria-hidden />
                      )}
                      <BookShelfCard
                        book={book}
                        pdfReady={pdfReady}
                        onOpen={() => onOpenBook(book.id)}
                        hideGradeInSubtitle
                      />
                    </li>
                  )
                })}
              </ul>
            </div>
          </section>
        ))}
      </div>
    </section>
  )
}

function BookShelfCard({
  book,
  onOpen,
  hideGradeInSubtitle = false,
}: {
  book: BookRecord
  pdfReady: boolean
  onOpen: () => void
  hideGradeInSubtitle?: boolean
}) {
  const status = resolveBookShelfStatus(book)
  const catalog = resolveBookCatalogIdentity(book)
  const subtitle = hideGradeInSubtitle
    ? [catalog.role].filter(Boolean).join(' · ')
    : [catalog.grade, catalog.role].filter(Boolean).join(' · ')
  const coverSource = getBookCoverSource(book, 1)

  return (
    <div className="group flex w-full flex-col gap-2.5">
      <button
        type="button"
        onClick={onOpen}
        className="relative flex w-full justify-center text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
        aria-label={`Open ${book.title}`}
      >
        <span className="relative inline-block shrink-0">
          <BookCoverMockup widthPx={SHELF_COVER_WIDTH} interactive>
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
              statusDotClass(status),
            )}
            title={BOOK_SHELF_STATUS_LABEL[status]}
            aria-label={BOOK_SHELF_STATUS_LABEL[status]}
          />
        </span>
      </button>

      <div className="min-w-0 space-y-1 px-0.5">
        <button
          type="button"
          onClick={onOpen}
          className="line-clamp-2 w-full text-left text-[13px] font-medium leading-snug tracking-tight text-foreground transition hover:opacity-80"
        >
          {book.title}
        </button>
        {subtitle ? (
          <p className="truncate text-[12px] leading-snug text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
    </div>
  )
}

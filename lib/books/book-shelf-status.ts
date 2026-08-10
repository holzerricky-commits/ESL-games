import { isPresentationBook } from '@/lib/books/book-catalog-labels'
import { discoverOutlineStories } from '@/lib/books/reading-story-map'
import { bookHasTocMapping } from '@/lib/books/strip-book-toc-mapping'
import type { BookRecord } from '@/lib/books/types'

/** Single shelf status — one visual signal per book. */
export type BookShelfStatus = 'needs_outline' | 'mapped' | 'has_stories'

export function resolveBookShelfStatus(book: BookRecord): BookShelfStatus {
  if (isPresentationBook(book)) {
    return book.units.length > 0 ? 'mapped' : 'needs_outline'
  }
  if (!bookHasTocMapping(book)) return 'needs_outline'
  if (discoverOutlineStories(book).length > 0) return 'has_stories'
  return 'mapped'
}

export const BOOK_SHELF_STATUS_LABEL: Record<BookShelfStatus, string> = {
  needs_outline: 'Needs map',
  mapped: 'Mapped',
  has_stories: 'Stories ready',
}

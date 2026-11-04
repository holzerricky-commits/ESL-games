import { resolveBookCatalogIdentity } from '@/lib/books/book-catalog-labels'
import type { BookRecord, BookUnitRecord } from '@/lib/books/types'

function findPeerBooksByRole(
  libraryBooks: readonly BookRecord[],
  book: BookRecord,
  role: 'Workshop' | 'Literature',
): BookRecord[] {
  const self = resolveBookCatalogIdentity(book)
  return libraryBooks.filter((candidate) => {
    if (candidate.id === book.id) return false
    const id = resolveBookCatalogIdentity(candidate)
    if (id.role !== role) return false
    if (self.series && id.series && self.series !== id.series) return false
    if (self.grade && id.grade && self.grade !== id.grade) return false
    return true
  })
}

/** Peer Workshop books for a Literature title — same series + grade when known. */
export function findPeerWorkshopBooks(
  libraryBooks: readonly BookRecord[],
  literatureBook: BookRecord,
): BookRecord[] {
  return findPeerBooksByRole(libraryBooks, literatureBook, 'Workshop')
}

/** Peer Literature books for a Workshop title — same series + grade when known. */
export function findPeerLiteratureBooks(
  libraryBooks: readonly BookRecord[],
  workshopBook: BookRecord,
): BookRecord[] {
  return findPeerBooksByRole(libraryBooks, workshopBook, 'Literature')
}

export function isLiteratureReadingBook(book: BookRecord): boolean {
  return resolveBookCatalogIdentity(book).role === 'Literature'
}

export function listWorkshopLessonsForPicker(unit: BookUnitRecord): Array<{
  id: string
  title: string
}> {
  return (unit.lessons ?? []).map((lesson) => ({
    id: lesson.id,
    title: lesson.title,
  }))
}

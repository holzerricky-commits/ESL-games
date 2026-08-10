import { resolveBookCatalogIdentity } from '@/lib/books/book-catalog-labels'
import type { BookRecord, BookUnitRecord } from '@/lib/books/types'

/** Peer Workshop books for a Literature (or similar) title — same series + grade when known. */
export function findPeerWorkshopBooks(
  libraryBooks: BookRecord[],
  literatureBook: BookRecord,
): BookRecord[] {
  const lit = resolveBookCatalogIdentity(literatureBook)
  return libraryBooks.filter((book) => {
    if (book.id === literatureBook.id) return false
    const id = resolveBookCatalogIdentity(book)
    if (id.role !== 'Workshop') return false
    if (lit.series && id.series && lit.series !== id.series) return false
    if (lit.grade && id.grade && lit.grade !== id.grade) return false
    return true
  })
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

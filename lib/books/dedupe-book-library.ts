import { resolveBookFolderForBook } from '@/lib/books/book-cover-path'
import type { BookLibraryPayload, BookRecord } from '@/lib/books/types'

function outlineWeight(book: BookRecord): number {
  let weight = book.units.length
  for (const unit of book.units) {
    const lessons = unit.lessons ?? []
    weight += lessons.length * 10
    for (const lesson of lessons) {
      weight += (lesson.parts?.length ?? 0) * 2
    }
  }
  if (book.series?.trim()) weight += 5
  if (book.grade?.trim()) weight += 1
  if (book.role?.trim()) weight += 1
  if (book.coverImagePath?.trim()) weight += 1
  return weight
}

/**
 * Keep one record per book id. Prefers the copy with the richest outline / labels.
 */
export function dedupeBooksById(books: BookRecord[]): BookRecord[] {
  const bestById = new Map<string, BookRecord>()
  const order: string[] = []

  for (const book of books) {
    const id = book.id?.trim()
    if (!id) continue
    const prev = bestById.get(id)
    if (!prev) {
      bestById.set(id, book)
      order.push(id)
      continue
    }
    if (outlineWeight(book) > outlineWeight(prev)) {
      bestById.set(id, book)
    }
  }

  return order.map((id) => bestById.get(id)!).filter(Boolean)
}

export function dedupeBookLibraryPayload(payload: BookLibraryPayload): BookLibraryPayload {
  return { books: dedupeBooksById(payload.books) }
}

/** Find a book by id or by folder on disk (first match after optional dedupe). */
export function findBookByIdOrFolder(
  books: BookRecord[],
  bookId: string,
  bookFolder: string,
): BookRecord | undefined {
  const byId = books.find((book) => book.id === bookId)
  if (byId) return byId
  return books.find((book) => resolveBookFolderForBook(book) === bookFolder)
}

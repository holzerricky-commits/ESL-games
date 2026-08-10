import type { BookRecord } from '@/lib/books/types'

export type BookCoverSource =
  | { kind: 'image'; imagePath: string }
  | { kind: 'pdf'; filePath: string; pageNumber: number }

export function bookCoverImageUrl(imagePath: string): string {
  return `/api/book-file?path=${encodeURIComponent(imagePath)}`
}

export function getBookCoverSource(
  book: BookRecord,
  pdfPage = 1,
): BookCoverSource | null {
  const trimmedCover = book.coverImagePath?.trim()
  if (trimmedCover) {
    return { kind: 'image', imagePath: trimmedCover }
  }
  const filePath = book.units[0]?.filePath
  if (!filePath) return null
  return { kind: 'pdf', filePath, pageNumber: pdfPage }
}

export function bookHasCustomCover(book: BookRecord): boolean {
  return Boolean(book.coverImagePath?.trim())
}

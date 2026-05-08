import path from 'node:path'
import { isBookLibraryFilePath } from '@/lib/books/manifest-validation'
import { getBookLibraryRoot, loadBookLibrary } from '@/lib/books/server'

/** Absolute path to the unit’s PDF under `book-library`, or null if missing / invalid. */
export async function resolveUnitPdfAbsolutePath(bookId: string, unitId: string): Promise<string | null> {
  const lib = await loadBookLibrary()
  const book = lib.books.find((b) => b.id === bookId)
  const unit = book?.units.find((u) => u.id === unitId)
  if (!unit?.filePath?.trim()) return null
  const libraryRoot = getBookLibraryRoot()
  const rel = unit.filePath.replaceAll('\\', '/').replace(/^\/+/, '')
  const cwd = /* turbopackIgnore: true */ process.cwd()
  if (!isBookLibraryFilePath(rel, cwd, libraryRoot)) return null
  const insideLibrary = rel.replace(/^book-library\/?/i, '')
  return path.join(libraryRoot, insideLibrary)
}

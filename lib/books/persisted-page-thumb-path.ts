import { resolveBookFolderFromUnitPath } from '@/lib/books/book-cover-path'
import { slugifyDiskSegment } from '@/lib/books/book-disk-naming'

export const PAGE_THUMB_DIR_NAME = 'thumbs'
export const MAX_PAGE_THUMB_PAGE = 9999

export function normalizeLibraryRelativePath(filePath: string): string {
  return filePath.replaceAll('\\', '/').replace(/^\/+/, '')
}

export function clampPageThumbPage(pageNumber: number): number | null {
  if (!Number.isFinite(pageNumber)) return null
  const page = Math.floor(pageNumber)
  if (page < 1 || page > MAX_PAGE_THUMB_PAGE) return null
  return page
}

/**
 * Disk path for a saved page picture, e.g.
 * `book-library/journeys-g4/thumbs/student-book-p12.jpg`
 */
export function persistedPageThumbRelativePath(
  pdfFilePath: string,
  pageNumber: number,
): string | null {
  const normalized = normalizeLibraryRelativePath(pdfFilePath)
  const folder = resolveBookFolderFromUnitPath(normalized)
  if (!folder) return null
  const prefix = `book-library/${folder}/`
  if (!normalized.startsWith(prefix)) return null
  const page = clampPageThumbPage(pageNumber)
  if (page == null) return null
  const rest = normalized.slice(prefix.length).replace(/\.pdf$/i, '')
  const stem = slugifyDiskSegment(rest.replaceAll('/', '-')) || 'page'
  return `book-library/${folder}/${PAGE_THUMB_DIR_NAME}/${stem}-p${page}.jpg`
}

export function bookPageThumbUrl(filePath: string, pageNumber: number): string {
  const page = clampPageThumbPage(pageNumber) ?? 1
  return `/api/books/page-thumb?path=${encodeURIComponent(normalizeLibraryRelativePath(filePath))}&page=${page}`
}

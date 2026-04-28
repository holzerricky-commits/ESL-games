import type { BookRecord, BookUnitRecord } from '@/lib/books/types'

function slugFromFilePath(filePath: string, index: number): string {
  const s = filePath
    .split('/')
    .pop()
    ?.replace(/\.pdf$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
  return s || `pdf-${index + 1}`
}

/** True when the manifest has TOC-style fields worth clearing for retesting. */
export function bookHasTocMapping(book: BookRecord): boolean {
  return book.units.some((u) => u.lessons != null && u.lessons.length > 0)
}

/**
 * Remove lesson trees.
 * Collapses to one unit row per distinct `filePath` (typical after TOC split of one PDF).
 */
export function stripBookTocMapping(book: BookRecord): BookRecord {
  const paths = [...new Set(book.units.map((u) => u.filePath))].sort()
  const units: BookUnitRecord[] = paths.map((filePath, i) => {
    const base = filePath.split('/').pop() ?? filePath
    const title = base.replace(/\.pdf$/i, '') || `Unit ${i + 1}`
    const slug = slugFromFilePath(filePath, i)
    return {
      id: `unit-${slug}-${i + 1}`,
      title,
      filePath,
    }
  })
  return { ...book, units }
}

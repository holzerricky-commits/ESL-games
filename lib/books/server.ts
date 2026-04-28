import path from 'node:path'
import { promises as fs } from 'node:fs'
import type { BookLibraryPayload, BookRecord } from '@/lib/books/types'

const PROJECT_ROOT = process.cwd()
const BOOK_LIBRARY_ROOT = path.resolve(PROJECT_ROOT, 'book-library')
const MANIFEST_FILE_NAME = 'books.json'

function toSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function titleFromFileName(fileName: string): string {
  const withoutExt = fileName.replace(/\.[^.]+$/, '')
  return withoutExt.replace(/[-_]+/g, ' ').trim() || fileName
}

function isPdf(fileName: string): boolean {
  return /\.pdf$/i.test(fileName)
}

function compareNaturalFileNames(a: string, b: string): number {
  return a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: 'base',
  })
}

function optionalStartPageHint(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const asInt = Math.floor(value)
  return asInt >= 1 ? asInt : null
}

function optionalAnchorConfidence(value: unknown): 'high' | 'medium' | 'low' | null {
  return value === 'high' || value === 'medium' || value === 'low' ? value : null
}

function optionalAnchorSource(value: unknown): 'toc' | 'heading' | 'fallback' | null {
  return value === 'toc' || value === 'heading' || value === 'fallback' ? value : null
}

function normalizePageList(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  const out = new Set<number>()
  for (const page of value) {
    if (typeof page !== 'number' || !Number.isFinite(page)) continue
    const rounded = Math.floor(page)
    if (rounded < 1) continue
    out.add(rounded)
  }
  return [...out].sort((a, b) => a - b)
}

function normalizePageAlignmentByFile(
  value: unknown,
): Record<string, { notCountedPdfPages: number[]; hiddenPdfPages?: number[] }> | null {
  if (value == null || typeof value !== 'object') return null
  const entries = Object.entries(value as Record<string, unknown>)
  const out: Record<string, { notCountedPdfPages: number[]; hiddenPdfPages?: number[] }> = {}
  for (const [filePath, rawAlignment] of entries) {
    if (!filePath || typeof filePath !== 'string') continue
    if (rawAlignment == null || typeof rawAlignment !== 'object') continue
    const record = rawAlignment as Record<string, unknown>
    const notCountedPdfPages = normalizePageList(record.notCountedPdfPages)
    const hiddenPdfPages = normalizePageList(record.hiddenPdfPages)
    out[filePath] = {
      notCountedPdfPages,
      ...(hiddenPdfPages.length ? { hiddenPdfPages } : {}),
    }
  }
  return Object.keys(out).length ? out : null
}

async function fileExists(absPath: string): Promise<boolean> {
  try {
    await fs.access(absPath)
    return true
  } catch {
    return false
  }
}

async function loadManifestIfPresent(): Promise<BookLibraryPayload | null> {
  const manifestPath = path.resolve(BOOK_LIBRARY_ROOT, MANIFEST_FILE_NAME)
  if (!(await fileExists(manifestPath))) return null
  const raw = await fs.readFile(manifestPath, 'utf8')
  const parsed = JSON.parse(raw) as Partial<BookLibraryPayload>
  const books = Array.isArray(parsed.books) ? parsed.books : []
  const migrated: BookRecord[] = books.map((book, bi) => {
    const pageAlignmentByFile = normalizePageAlignmentByFile(book?.pageAlignmentByFile)
    return {
    id: typeof book?.id === 'string' && book.id ? book.id : `book-${bi + 1}`,
    title: typeof book?.title === 'string' && book.title ? book.title : `Book ${bi + 1}`,
    ...(typeof book?.description === 'string' ? { description: book.description } : {}),
    ...(pageAlignmentByFile ? { pageAlignmentByFile } : {}),
    units: Array.isArray(book?.units)
      ? book.units.map((unit, ui) => ({
          id: typeof unit?.id === 'string' && unit.id ? unit.id : `unit-${ui + 1}`,
          title: typeof unit?.title === 'string' && unit.title ? unit.title : `Unit ${ui + 1}`,
          filePath: typeof unit?.filePath === 'string' ? unit.filePath : '',
          ...(optionalStartPageHint(unit?.startPageHint) != null
            ? { startPageHint: optionalStartPageHint(unit?.startPageHint) as number }
            : {}),
          ...(optionalAnchorConfidence(unit?.anchorConfidence)
            ? { anchorConfidence: optionalAnchorConfidence(unit?.anchorConfidence) as 'high' | 'medium' | 'low' }
            : {}),
          ...(optionalAnchorSource(unit?.anchorSource)
            ? { anchorSource: optionalAnchorSource(unit?.anchorSource) as 'toc' | 'heading' | 'fallback' }
            : {}),
          ...(Array.isArray(unit?.lessons)
            ? {
                lessons: unit.lessons
                  .map((lesson, li) => ({
                    id: typeof lesson?.id === 'string' && lesson.id ? lesson.id : `lesson-${li + 1}`,
                    title: typeof lesson?.title === 'string' ? lesson.title : `Lesson ${li + 1}`,
                    ...(optionalStartPageHint(lesson?.startPageHint) != null
                      ? { startPageHint: optionalStartPageHint(lesson?.startPageHint) as number }
                      : {}),
                    ...(optionalAnchorConfidence(lesson?.anchorConfidence)
                      ? { anchorConfidence: optionalAnchorConfidence(lesson?.anchorConfidence) as 'high' | 'medium' | 'low' }
                      : {}),
                    ...(optionalAnchorSource(lesson?.anchorSource)
                      ? { anchorSource: optionalAnchorSource(lesson?.anchorSource) as 'toc' | 'heading' | 'fallback' }
                      : {}),
                    ...(Array.isArray(lesson?.parts)
                      ? {
                          parts: lesson.parts.map((part, pi) => ({
                            id: typeof part?.id === 'string' && part.id ? part.id : `part-${pi + 1}`,
                            title: typeof part?.title === 'string' ? part.title : `Part ${pi + 1}`,
                            ...(optionalStartPageHint(part?.startPageHint) != null
                              ? { startPageHint: optionalStartPageHint(part?.startPageHint) as number }
                              : {}),
                            ...(optionalAnchorConfidence(part?.anchorConfidence)
                              ? { anchorConfidence: optionalAnchorConfidence(part?.anchorConfidence) as 'high' | 'medium' | 'low' }
                              : {}),
                            ...(optionalAnchorSource(part?.anchorSource)
                              ? { anchorSource: optionalAnchorSource(part?.anchorSource) as 'toc' | 'heading' | 'fallback' }
                              : {}),
                          })),
                        }
                      : {}),
                  }))
                  .filter((lesson) => lesson.title.trim().length > 0),
              }
            : {}),
        }))
      : [],
    }
  })
  return { books: migrated }
}

async function autoDiscoverBooks(): Promise<BookLibraryPayload> {
  if (!(await fileExists(BOOK_LIBRARY_ROOT))) return { books: [] }
  const entries = await fs.readdir(BOOK_LIBRARY_ROOT, { withFileTypes: true })
  const books: BookRecord[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const dirName = entry.name
    const absDir = path.resolve(BOOK_LIBRARY_ROOT, dirName)
    const unitEntries = await fs.readdir(absDir, { withFileTypes: true })
    const pdfFiles = unitEntries
      .filter((unit) => unit.isFile() && isPdf(unit.name))
      .map((unit) => unit.name)
      .sort(compareNaturalFileNames)

    if (pdfFiles.length === 0) continue

    const bookId = toSlug(dirName) || `book-${books.length + 1}`
    books.push({
      id: bookId,
      title: dirName.replace(/[-_]+/g, ' ').trim(),
      units: pdfFiles.map((fileName, index) => ({
        id: toSlug(fileName) || `${bookId}-unit-${index + 1}`,
        title: titleFromFileName(fileName),
        filePath: `book-library/${dirName}/${fileName}`.replaceAll('\\', '/'),
      })),
    })
  }

  return { books }
}

export async function loadBookLibrary(): Promise<BookLibraryPayload> {
  const fromManifest = await loadManifestIfPresent()
  if (!fromManifest) return autoDiscoverBooks()

  const discovered = await autoDiscoverBooks()
  const mergedBooks = fromManifest.books.map((book) => ({
    ...book,
    units: [...book.units],
  }))

  for (const discoveredBook of discovered.books) {
    const discoveredSlug = toSlug(discoveredBook.title)
    const target = mergedBooks.find((book) => {
      if (toSlug(book.title) === discoveredSlug) return true
      return book.units.some((unit) => {
        const m = unit.filePath.match(/^book-library\/([^/]+)\//)
        return m?.[1] === discoveredBook.id
      })
    })

    if (!target) {
      mergedBooks.push(discoveredBook)
      continue
    }

    const knownFilePaths = new Set(target.units.map((unit) => unit.filePath))
    for (const unit of discoveredBook.units) {
      if (!knownFilePaths.has(unit.filePath)) {
        target.units.push(unit)
      }
    }
  }

  return { books: mergedBooks }
}

export function getBookLibraryRoot(): string {
  return BOOK_LIBRARY_ROOT
}

/** Absolute path to persisted manifest (`book-library/books.json`). */
export function getBookManifestPath(): string {
  return path.resolve(BOOK_LIBRARY_ROOT, MANIFEST_FILE_NAME)
}

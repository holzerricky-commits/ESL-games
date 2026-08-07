import path from 'node:path'
import { promises as fs } from 'node:fs'
import { isBookLessonPartTag } from '@/lib/books/part-structure-tag'
import { clampSpreadGutterPullRatio } from '@/lib/books/spread-gutter'
import type { BookLibraryPayload, BookRecord } from '@/lib/books/types'

/** Runtime cwd; marked so Turbopack does not treat tracing as “whole repo”. */
const PROJECT_ROOT = /* turbopackIgnore: true */ process.cwd()
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

/** Shared for startPageHint / endPageHint (positive printed page ints). */
function optionalPageHint(value: unknown): number | null {
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

function normalizeSpreadGutterByFile(value: unknown): Record<string, number> | null {
  if (value == null || typeof value !== 'object') return null
  const out: Record<string, number> = {}
  for (const [filePath, rawRatio] of Object.entries(value as Record<string, unknown>)) {
    if (!filePath || typeof filePath !== 'string') continue
    if (typeof rawRatio !== 'number' || !Number.isFinite(rawRatio)) continue
    out[filePath] = clampSpreadGutterPullRatio(rawRatio)
  }
  return Object.keys(out).length ? out : null
}

function normalizeSpreadGutterPullRatio(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return clampSpreadGutterPullRatio(value)
}

async function fileExists(absPath: string): Promise<boolean> {
  try {
    await fs.access(absPath)
    return true
  } catch {
    return false
  }
}

/**
 * Hydrate books.json rows into BookRecord shapes.
 * Must keep endPageHint / structureTag — save schema accepts them and TOC import writes them.
 */
export function normalizeManifestBooks(books: unknown[]): BookRecord[] {
  return books.map((bookRaw, bi) => {
    const book = (bookRaw ?? {}) as Partial<BookRecord> & {
      units?: Array<Partial<BookRecord['units'][number]> & {
        lessons?: Array<
          Partial<NonNullable<BookRecord['units'][number]['lessons']>[number]> & {
            parts?: Array<Partial<NonNullable<NonNullable<BookRecord['units'][number]['lessons']>[number]['parts']>[number]>>
          }
        >
      }>
    }
    const pageAlignmentByFile = normalizePageAlignmentByFile(book?.pageAlignmentByFile)
    const spreadGutterPullRatio = normalizeSpreadGutterPullRatio(book?.spreadGutterPullRatio)
    const spreadGutterByFile = normalizeSpreadGutterByFile(book?.spreadGutterByFile)
    return {
      id: typeof book?.id === 'string' && book.id ? book.id : `book-${bi + 1}`,
      title: typeof book?.title === 'string' && book.title ? book.title : `Book ${bi + 1}`,
      ...(typeof book?.description === 'string' ? { description: book.description } : {}),
      ...(pageAlignmentByFile ? { pageAlignmentByFile } : {}),
      ...(spreadGutterPullRatio != null ? { spreadGutterPullRatio } : {}),
      ...(spreadGutterByFile ? { spreadGutterByFile } : {}),
      units: Array.isArray(book?.units)
        ? book.units.map((unit, ui) => {
            const unitStart = optionalPageHint(unit?.startPageHint)
            const unitEnd = optionalPageHint(unit?.endPageHint)
            return {
              id: typeof unit?.id === 'string' && unit.id ? unit.id : `unit-${ui + 1}`,
              title: typeof unit?.title === 'string' && unit.title ? unit.title : `Unit ${ui + 1}`,
              filePath: typeof unit?.filePath === 'string' ? unit.filePath : '',
              ...(unitStart != null ? { startPageHint: unitStart } : {}),
              ...(unitEnd != null ? { endPageHint: unitEnd } : {}),
              ...(optionalAnchorConfidence(unit?.anchorConfidence)
                ? { anchorConfidence: optionalAnchorConfidence(unit?.anchorConfidence) as 'high' | 'medium' | 'low' }
                : {}),
              ...(optionalAnchorSource(unit?.anchorSource)
                ? { anchorSource: optionalAnchorSource(unit?.anchorSource) as 'toc' | 'heading' | 'fallback' }
                : {}),
              ...(Array.isArray(unit?.lessons)
                ? {
                    lessons: unit.lessons
                      .map((lesson, li) => {
                        const lessonStart = optionalPageHint(lesson?.startPageHint)
                        const lessonEnd = optionalPageHint(lesson?.endPageHint)
                        return {
                          id: typeof lesson?.id === 'string' && lesson.id ? lesson.id : `lesson-${li + 1}`,
                          title: typeof lesson?.title === 'string' ? lesson.title : `Lesson ${li + 1}`,
                          ...(lessonStart != null ? { startPageHint: lessonStart } : {}),
                          ...(lessonEnd != null ? { endPageHint: lessonEnd } : {}),
                          ...(optionalAnchorConfidence(lesson?.anchorConfidence)
                            ? {
                                anchorConfidence: optionalAnchorConfidence(lesson?.anchorConfidence) as
                                  | 'high'
                                  | 'medium'
                                  | 'low',
                              }
                            : {}),
                          ...(optionalAnchorSource(lesson?.anchorSource)
                            ? {
                                anchorSource: optionalAnchorSource(lesson?.anchorSource) as
                                  | 'toc'
                                  | 'heading'
                                  | 'fallback',
                              }
                            : {}),
                          ...(Array.isArray(lesson?.parts)
                            ? {
                                parts: lesson.parts.map((part, pi) => {
                                  const partStart = optionalPageHint(part?.startPageHint)
                                  const partEnd = optionalPageHint(part?.endPageHint)
                                  return {
                                    id: typeof part?.id === 'string' && part.id ? part.id : `part-${pi + 1}`,
                                    title: typeof part?.title === 'string' ? part.title : `Part ${pi + 1}`,
                                    ...(partStart != null ? { startPageHint: partStart } : {}),
                                    ...(partEnd != null ? { endPageHint: partEnd } : {}),
                                    ...(optionalAnchorConfidence(part?.anchorConfidence)
                                      ? {
                                          anchorConfidence: optionalAnchorConfidence(part?.anchorConfidence) as
                                            | 'high'
                                            | 'medium'
                                            | 'low',
                                        }
                                      : {}),
                                    ...(optionalAnchorSource(part?.anchorSource)
                                      ? {
                                          anchorSource: optionalAnchorSource(part?.anchorSource) as
                                            | 'toc'
                                            | 'heading'
                                            | 'fallback',
                                        }
                                      : {}),
                                    ...(isBookLessonPartTag(part?.structureTag)
                                      ? { structureTag: part.structureTag }
                                      : {}),
                                  }
                                }),
                              }
                            : {}),
                        }
                      })
                      .filter((lesson) => lesson.title.trim().length > 0),
                  }
                : {}),
            }
          })
        : [],
    }
  })
}

async function loadManifestIfPresent(): Promise<BookLibraryPayload | null> {
  const manifestPath = path.resolve(BOOK_LIBRARY_ROOT, MANIFEST_FILE_NAME)
  if (!(await fileExists(manifestPath))) return null
  const raw = await fs.readFile(manifestPath, 'utf8')
  const parsed = JSON.parse(raw) as Partial<BookLibraryPayload>
  const books = Array.isArray(parsed.books) ? parsed.books : []
  return { books: normalizeManifestBooks(books) }
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

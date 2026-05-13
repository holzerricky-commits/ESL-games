import path from 'node:path'
import { z } from 'zod'
import { BOOK_LESSON_PART_TAGS } from '@/lib/books/types'

const anchorConfidenceSchema = z.enum(['high', 'medium', 'low'])
const anchorSourceSchema = z.enum(['toc', 'heading', 'fallback'])

const bookLessonPartTagSchema = z.enum(BOOK_LESSON_PART_TAGS as unknown as [string, ...string[]])

const bookLessonPartSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  startPageHint: z.number().int().min(1).optional(),
  endPageHint: z.number().int().min(1).optional(),
  anchorConfidence: anchorConfidenceSchema.optional(),
  anchorSource: anchorSourceSchema.optional(),
  structureTag: bookLessonPartTagSchema.optional(),
}).strict()

const bookLessonSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  startPageHint: z.number().int().min(1).optional(),
  endPageHint: z.number().int().min(1).optional(),
  anchorConfidence: anchorConfidenceSchema.optional(),
  anchorSource: anchorSourceSchema.optional(),
  parts: z.array(bookLessonPartSchema).optional(),
}).strict()

const bookUnitSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  filePath: z.string().min(1),
  startPageHint: z.number().int().min(1).optional(),
  endPageHint: z.number().int().min(1).optional(),
  anchorConfidence: anchorConfidenceSchema.optional(),
  anchorSource: anchorSourceSchema.optional(),
  lessons: z.array(bookLessonSchema).optional(),
}).strict()

const bookFilePageAlignmentSchema = z.object({
  notCountedPdfPages: z.array(z.number().int().min(1)).max(500),
  hiddenPdfPages: z.array(z.number().int().min(1)).max(500).optional(),
}).strict()

const bookRecordSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  description: z.string().optional(),
  pageAlignmentByFile: z.record(z.string().min(1), bookFilePageAlignmentSchema).optional(),
  units: z.array(bookUnitSchema).min(1),
}).strict()

export const bookLibraryPayloadSchema = z.object({
  books: z.array(bookRecordSchema),
})

/**
 * True if resolved file path is inside book-library (same rules as /api/book-file).
 */
export function resolveBookLibraryFilePath(filePath: string, cwd: string, libraryRoot: string): string | null {
  const normalizedRelative = filePath.replaceAll('\\', '/').replace(/^\/+/, '')
  const absTarget = path.resolve(/* turbopackIgnore: true */ cwd, normalizedRelative)
  const root = path.resolve(libraryRoot)
  const prefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`
  return absTarget === root || absTarget.startsWith(prefix) ? absTarget : null
}

export function isBookLibraryFilePath(filePath: string, cwd: string, libraryRoot: string): boolean {
  return resolveBookLibraryFilePath(filePath, cwd, libraryRoot) !== null
}

export function resolveBookFolderFromLibraryFilePath(
  filePath: string,
  cwd: string,
  libraryRoot: string,
): string | null {
  const absTarget = resolveBookLibraryFilePath(filePath, cwd, libraryRoot)
  if (!absTarget) return null
  const relativeToRoot = path.relative(path.resolve(libraryRoot), absTarget)
  if (!relativeToRoot || relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) return null
  const [bookFolder] = relativeToRoot.split(path.sep).filter(Boolean)
  if (!bookFolder || bookFolder === '.' || bookFolder === '..') return null
  return bookFolder
}

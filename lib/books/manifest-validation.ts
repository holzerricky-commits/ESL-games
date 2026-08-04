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

const spreadGutterPullRatioSchema = z.number().min(0).max(0.2)

const bookRecordSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  description: z.string().optional(),
  pageAlignmentByFile: z.record(z.string().min(1), bookFilePageAlignmentSchema).optional(),
  spreadGutterPullRatio: spreadGutterPullRatioSchema.optional(),
  spreadGutterByFile: z.record(z.string().min(1), spreadGutterPullRatioSchema).optional(),
  units: z.array(bookUnitSchema).min(1),
}).strict()

export const bookLibraryPayloadSchema = z.object({
  books: z.array(bookRecordSchema),
})

/**
 * True if resolved file path is inside book-library (same rules as /api/book-file).
 */
export function isBookLibraryFilePath(filePath: string, cwd: string, libraryRoot: string): boolean {
  const normalizedRelative = filePath.replaceAll('\\', '/').replace(/^\/+/, '')
  const absTarget = path.resolve(/* turbopackIgnore: true */ cwd, normalizedRelative)
  const root = path.resolve(libraryRoot)
  const prefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`
  return absTarget === root || absTarget.startsWith(prefix)
}

/**
 * Book folder name under book-library for a unit file path.
 * Uses the resolved path (not raw `../` segments) so materials APIs cannot escape the library.
 */
export function resolveBookLibraryFolderName(
  filePath: string,
  cwd: string,
  libraryRoot: string,
): string | null {
  if (!isBookLibraryFilePath(filePath, cwd, libraryRoot)) return null
  const normalizedRelative = filePath.replaceAll('\\', '/').replace(/^\/+/, '')
  const absTarget = path.resolve(/* turbopackIgnore: true */ cwd, normalizedRelative)
  const root = path.resolve(libraryRoot)
  const rel = path.relative(root, absTarget).replaceAll('\\', '/')
  if (!rel || rel === '.' || rel.startsWith('..') || path.isAbsolute(rel)) return null
  const parts = rel.split('/').filter((segment) => segment.length > 0)
  // Need at least bookFolder/file (same shape the materials APIs historically required).
  if (parts.length < 2) return null
  const folder = parts[0]
  if (!folder || folder === '.' || folder === '..') return null
  return folder
}

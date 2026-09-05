import path from 'node:path'
import { z } from 'zod'
import { BOOK_CONTENT_FORMATS, BOOK_LESSON_PART_TAGS } from '@/lib/books/types'

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
  volumeId: z.string().min(1).optional(),
  startPageHint: z.number().int().min(1).optional(),
  endPageHint: z.number().int().min(1).optional(),
  anchorConfidence: anchorConfidenceSchema.optional(),
  anchorSource: anchorSourceSchema.optional(),
  lessons: z.array(bookLessonSchema).optional(),
}).strict()

const bookVolumeSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  filePath: z.string().min(1),
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
  series: z.string().optional(),
  grade: z.string().optional(),
  role: z.string().optional(),
  contentFormat: z.enum(BOOK_CONTENT_FORMATS).optional(),
  pageAlignmentByFile: z.record(z.string().min(1), bookFilePageAlignmentSchema).optional(),
  spreadGutterPullRatio: spreadGutterPullRatioSchema.optional(),
  spreadGutterByFile: z.record(z.string().min(1), spreadGutterPullRatioSchema).optional(),
  coverImagePath: z.string().min(1).optional(),
  volumes: z.array(bookVolumeSchema).min(1).optional(),
  units: z.array(bookUnitSchema).min(1),
}).strict()

export const bookLibraryPayloadSchema = z
  .object({
    books: z.array(bookRecordSchema),
  })
  .superRefine((payload, ctx) => {
    const seen = new Set<string>()
    for (let i = 0; i < payload.books.length; i += 1) {
      const id = payload.books[i]!.id
      if (seen.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate book id: ${id}`,
          path: ['books', i, 'id'],
        })
        continue
      }
      seen.add(id)
    }
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

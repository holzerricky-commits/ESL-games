import { z } from 'zod'

/** Metadata accepted by POST /api/student-work/upload (must match client capture payloads). */
export const studentWorkUploadMetaSchema = z
  .object({
    bookId: z.string().max(200).optional(),
    unitId: z.string().max(200).optional(),
    unitTitle: z.string().max(300).optional(),
    page: z.number().int().positive().optional(),
    pageFrom: z.number().int().positive().optional(),
    pageTo: z.number().int().positive().optional(),
    captureKind: z.string().max(64).optional(),
    format: z.string().max(32).optional(),
    watermarked: z.boolean().optional(),
    caption: z.string().max(2000).optional(),
    exportedAt: z.string().max(64).optional(),
    studentName: z.string().max(200).optional(),
    classSessionId: z.string().max(200).optional(),
  })
  .strict()

export type StudentWorkUploadMeta = z.infer<typeof studentWorkUploadMetaSchema>

export function parseStudentWorkUploadMeta(
  json: unknown,
): { ok: true; data: StudentWorkUploadMeta } | { ok: false; error: z.ZodError } {
  const parsed = studentWorkUploadMetaSchema.safeParse(json)
  if (!parsed.success) return { ok: false, error: parsed.error }
  return { ok: true, data: parsed.data }
}

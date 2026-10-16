import type { PartContextRecord } from '@/lib/context/types'

/**
 * Framework apply refreshes lesson metadata, but teacher-authored reader words
 * are edited in a separate flow and must survive metadata refreshes.
 */
export function preservePartContextTeacherFields(
  next: PartContextRecord,
  existing: PartContextRecord | null | undefined,
): PartContextRecord {
  if (!existing?.interactiveVocabulary?.length) return next
  return {
    ...next,
    interactiveVocabulary: existing.interactiveVocabulary,
  }
}

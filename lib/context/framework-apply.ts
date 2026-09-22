import type { UnitContextRecord } from '@/lib/context/types'

/**
 * Framework apply rebuilds unit rows from focus-note labels. Theme already falls
 * back to the existing unit; big ideas and cross-curricular links must do the same
 * when the notes did not include those labels — otherwise a normal apply wipes
 * previously saved unit research.
 */
export function preserveUnitContextResearchFields(
  next: UnitContextRecord,
  existing: UnitContextRecord | null | undefined,
): UnitContextRecord {
  if (!existing) return next
  return {
    ...next,
    bigIdeas: next.bigIdeas.length > 0 ? next.bigIdeas : existing.bigIdeas,
    crossCurricularLinks:
      next.crossCurricularLinks.length > 0 ? next.crossCurricularLinks : existing.crossCurricularLinks,
  }
}

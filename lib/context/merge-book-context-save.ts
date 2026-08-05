import type { BookContextRecord } from '@/lib/context/types'

/**
 * Client "Save focus areas" / "Save table progress" often posts a draft with
 * empty materials/evidence/goals when no in-memory AI draft is loaded.
 * Preserve those fields from the existing saved book context so a routine
 * focus-table save cannot wipe previously approved research.
 */
export function mergeBookContextSaveWithExisting(
  incoming: BookContextRecord,
  existing: BookContextRecord | null,
): BookContextRecord {
  if (!existing) return incoming

  return {
    ...incoming,
    createdAt: existing.createdAt,
    materials: incoming.materials.length > 0 ? incoming.materials : existing.materials,
    evidence: incoming.evidence.length > 0 ? incoming.evidence : existing.evidence,
    goals: incoming.goals.length > 0 ? incoming.goals : existing.goals,
    pacing: incoming.pacing.length > 0 ? incoming.pacing : existing.pacing,
    instructionalPriorities:
      incoming.instructionalPriorities.length > 0
        ? incoming.instructionalPriorities
        : existing.instructionalPriorities,
    sourcePageRange: incoming.sourcePageRange ?? existing.sourcePageRange,
  }
}

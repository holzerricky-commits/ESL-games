/** Prepare / next-class status line for reading checks (Phase 6). */

import {
  countUsableReadingCheckStops,
  getLiveEligibleReadingCheckPack,
  type ReadingCheckPack,
} from '@/lib/books/reading-check-pack'
import type { ReadingStoryMap } from '@/lib/books/reading-story-map'

export type ReadingCheckPrepareGlanceKind = 'none' | 'needs_review' | 'approved'

export interface ReadingCheckPrepareGlance {
  kind: ReadingCheckPrepareGlanceKind
  /** Short teacher-facing line, e.g. "Reading checks: approved (4)". */
  label: string
  stopCount: number
}

/** Status copy for Prepare / next-class (not a second editor). */
export function resolveReadingCheckPrepareGlance(
  pack: ReadingCheckPack | null | undefined,
): ReadingCheckPrepareGlance {
  const stopCount = countUsableReadingCheckStops(pack)
  if (!pack || stopCount === 0) {
    return { kind: 'none', label: 'Reading checks: None', stopCount: 0 }
  }
  if (getLiveEligibleReadingCheckPack(pack)) {
    return {
      kind: 'approved',
      label: `Reading checks: approved (${stopCount})`,
      stopCount,
    }
  }
  return {
    kind: 'needs_review',
    label: `Reading checks: Needs review (${stopCount})`,
    stopCount,
  }
}

/**
 * Pick the story that matches the upcoming lesson section.
 * Prefer exact part → lesson main story → unit main story → first in unit.
 */
export function pickReadingStoryForPrepareGlance(args: {
  stories: ReadingStoryMap[]
  bookId: string
  unitId: string
  lessonId?: string | null
  partId?: string | null
}): ReadingStoryMap | null {
  const bookId = args.bookId.trim()
  const unitId = args.unitId.trim()
  if (!bookId || !unitId) return null

  const inUnit = args.stories.filter((s) => s.bookId === bookId && s.unitId === unitId)
  if (inUnit.length === 0) return null

  const partId = args.partId?.trim() || null
  if (partId) {
    const byPart = inUnit.find((s) => s.partId === partId)
    if (byPart) return byPart
  }

  const lessonId = args.lessonId?.trim() || null
  if (lessonId) {
    const inLesson = inUnit.filter((s) => s.lessonId === lessonId)
    const main = inLesson.find((s) => s.kind === 'main_story')
    if (main) return main
    if (inLesson[0]) return inLesson[0]
  }

  const main = inUnit.find((s) => s.kind === 'main_story')
  return main ?? inUnit[0] ?? null
}

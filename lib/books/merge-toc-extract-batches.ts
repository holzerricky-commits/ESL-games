/**
 * Phase 3b — merge TOC extract batches across multi-page / multi-phase AI calls.
 * Matches units by unit number or normalized title (not only exact previous title).
 */

import type { BookLessonRecord } from '@/lib/books/types'
import type { TocUnitDraft } from '@/lib/books/toc-import'

export type TocExtractBatch = {
  drafts: TocUnitDraft[]
  lessonsByUnit: BookLessonRecord[][]
}

const FRONT_MATTER_TITLE =
  /^(table\s+of\s+contents|contents|scope\s+and\s+sequence|academic\s+skills|credits|acknowledg(?:e)?ments?|index)$/i

/** Collapse punctuation/whitespace for title equality. */
export function normalizeUnitTitleForMerge(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[_/\\|]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Pull Unit/Chapter/Theme/Module number when present.
 * "Unit 1: Amazing Animals" → 1
 */
export function extractUnitNumberFromTitle(title: string): number | null {
  const m = title.trim().match(/\b(?:unit|chapter|theme|module|part)\s*(\d{1,3})\b/i)
  if (!m?.[1]) return null
  const n = Number.parseInt(m[1], 10)
  return Number.isFinite(n) && n >= 1 ? n : null
}

/** Stable merge key: prefer unit number, else normalized full title. */
export function unitMergeKey(draft: Pick<TocUnitDraft, 'title'>): string {
  const num = extractUnitNumberFromTitle(draft.title)
  if (num != null) return `n:${num}`
  return `t:${normalizeUnitTitleForMerge(draft.title)}`
}

export function isFrontMatterOnlyUnitTitle(title: string): boolean {
  const norm = normalizeUnitTitleForMerge(title)
  return FRONT_MATTER_TITLE.test(norm)
}

function lessonDedupeKey(lesson: BookLessonRecord): string {
  const title = normalizeUnitTitleForMerge(lesson.title)
  const start =
    typeof lesson.startPageHint === 'number' && Number.isFinite(lesson.startPageHint)
      ? String(Math.round(lesson.startPageHint))
      : '_'
  return `${title}::${start}`
}

/** Sort by start page, drop duplicate title+page rows from later batches. */
export function mergeLessonLists(
  prev: BookLessonRecord[],
  next: BookLessonRecord[],
): BookLessonRecord[] {
  const combined = [...prev, ...next]
  combined.sort(
    (a, b) =>
      (typeof a.startPageHint === 'number' ? a.startPageHint : Number.MAX_SAFE_INTEGER) -
      (typeof b.startPageHint === 'number' ? b.startPageHint : Number.MAX_SAFE_INTEGER),
  )
  const seen = new Set<string>()
  const out: BookLessonRecord[] = []
  for (const lesson of combined) {
    const key = lessonDedupeKey(lesson)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(lesson)
  }
  return out
}

function preferEarlierStart(
  prev: TocUnitDraft,
  next: TocUnitDraft,
): TocUnitDraft {
  if (
    typeof next.startPageHint === 'number' &&
    (typeof prev.startPageHint !== 'number' || next.startPageHint < prev.startPageHint)
  ) {
    return { ...prev, startPageHint: next.startPageHint }
  }
  // Prefer richer title when numbers match ("Unit 1" → "Unit 1: Amazing Animals")
  const prevNum = extractUnitNumberFromTitle(prev.title)
  const nextNum = extractUnitNumberFromTitle(next.title)
  if (prevNum != null && prevNum === nextNum && next.title.trim().length > prev.title.trim().length) {
    return {
      ...prev,
      title: next.title.trim(),
      ...(typeof next.startPageHint === 'number' && typeof prev.startPageHint !== 'number'
        ? { startPageHint: next.startPageHint }
        : {}),
    }
  }
  return prev
}

function recomputeDraftEndHints(
  drafts: TocUnitDraft[],
  lessonsByUnit: BookLessonRecord[][],
): void {
  for (let i = 0; i < drafts.length; i++) {
    const current = drafts[i]
    if (!current) continue
    const next = drafts[i + 1]
    if (typeof current.startPageHint !== 'number') continue
    if (typeof next?.startPageHint === 'number') {
      current.endPageHint = Math.max(current.startPageHint, next.startPageHint - 1)
      continue
    }
    const lessons = lessonsByUnit[i] ?? []
    const last = lessons[lessons.length - 1]
    if (typeof last?.endPageHint === 'number') current.endPageHint = last.endPageHint
    else if (typeof last?.startPageHint === 'number') current.endPageHint = last.startPageHint
  }
}

/**
 * Merge sequential extract batches into one outline tree.
 * Units that continue across TOC page batches are combined; front-matter shells dropped.
 */
export function mergeExtractedStructureBatches(
  batches: TocExtractBatch[],
): TocExtractBatch {
  const mergedDrafts: TocUnitDraft[] = []
  const mergedLessons: BookLessonRecord[][] = []
  const indexByKey = new Map<string, number>()

  for (const batch of batches) {
    for (let i = 0; i < batch.drafts.length; i++) {
      const nextDraft = batch.drafts[i]!
      const nextLessons = batch.lessonsByUnit[i] ?? []

      // Skip empty Contents / Scope shells that have no mappable lessons.
      if (
        nextLessons.length === 0 &&
        isFrontMatterOnlyUnitTitle(nextDraft.title)
      ) {
        continue
      }

      const key = unitMergeKey(nextDraft)
      const existingIdx = indexByKey.get(key)

      if (existingIdx == null) {
        indexByKey.set(key, mergedDrafts.length)
        mergedDrafts.push(nextDraft)
        mergedLessons.push(nextLessons)
        continue
      }

      const prevDraft = mergedDrafts[existingIdx]!
      const prevLessons = mergedLessons[existingIdx] ?? []
      mergedLessons[existingIdx] = mergeLessonLists(prevLessons, nextLessons)
      mergedDrafts[existingIdx] = preferEarlierStart(prevDraft, nextDraft)
    }
  }

  recomputeDraftEndHints(mergedDrafts, mergedLessons)
  return { drafts: mergedDrafts, lessonsByUnit: mergedLessons }
}

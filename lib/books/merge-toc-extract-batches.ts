/**
 * Phase 3b — merge TOC extract batches across multi-page / multi-phase AI calls.
 * Matches units by unit number or normalized title (not only exact previous title).
 * Also stitches week/lesson continuations that the model mistitled as a new unit.
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

/** Prefer explicit draft.unitNumber, then number parsed from the title. */
export function resolveDraftUnitNumber(
  draft: Pick<TocUnitDraft, 'title' | 'unitNumber'>,
): number | null {
  if (typeof draft.unitNumber === 'number' && Number.isFinite(draft.unitNumber) && draft.unitNumber >= 1) {
    return Math.floor(draft.unitNumber)
  }
  return extractUnitNumberFromTitle(draft.title)
}

/** Stable merge key: prefer unit number, else normalized full title. */
export function unitMergeKey(draft: Pick<TocUnitDraft, 'title' | 'unitNumber'>): string {
  const num = resolveDraftUnitNumber(draft)
  if (num != null) return `n:${num}`
  return `t:${normalizeUnitTitleForMerge(draft.title)}`
}

/** "Week 3: Great Inventions" / "Lesson 2 …" → 3 / 2 */
export function extractChunkNumberFromLessonTitle(title: string): number | null {
  const m = title.trim().match(/\b(?:week|lesson)\s*(\d{1,3})\b/i)
  if (!m?.[1]) return null
  const n = Number.parseInt(m[1], 10)
  return Number.isFinite(n) && n >= 1 ? n : null
}

function lessonChunkNumbers(lessons: BookLessonRecord[]): number[] {
  const nums: number[] = []
  for (const lesson of lessons) {
    const n = extractChunkNumberFromLessonTitle(lesson.title)
    if (n != null) nums.push(n)
  }
  return nums
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

/** True for sparse labels like "Unit 5" (no theme yet). */
function isBareUnitLabel(title: string, unitNumber: number): boolean {
  const norm = normalizeUnitTitleForMerge(title)
  return new RegExp(`^(?:unit|chapter|theme|module|part)\\s*${unitNumber}$`, 'i').test(norm)
}

function preferEarlierStart(
  prev: TocUnitDraft,
  next: TocUnitDraft,
): TocUnitDraft {
  const prevNum = resolveDraftUnitNumber(prev)
  const nextNum = resolveDraftUnitNumber(next)
  const unitNumber =
    prevNum ?? nextNum ?? (typeof prev.unitNumber === 'number' ? prev.unitNumber : next.unitNumber)

  let title = prev.title.trim()
  // Upgrade only bare "Unit N" → "Unit N: Theme". Keep earlier theme over a mistitled week theme.
  if (
    prevNum != null &&
    nextNum != null &&
    prevNum === nextNum &&
    isBareUnitLabel(title, prevNum) &&
    next.title.trim().length > title.length
  ) {
    title = next.title.trim()
  }

  let startPageHint = prev.startPageHint
  if (
    typeof next.startPageHint === 'number' &&
    (typeof startPageHint !== 'number' || next.startPageHint < startPageHint)
  ) {
    startPageHint = next.startPageHint
  }

  return {
    ...prev,
    title,
    ...(unitNumber != null ? { unitNumber } : {}),
    ...(typeof startPageHint === 'number' ? { startPageHint } : {}),
  }
}

/**
 * True when `next` looks like weeks/lessons continuing the last open unit
 * (common Wonders TOC: page 2 starts at Week 3 with a theme heading, no Unit header).
 */
export function looksLikeUnitContinuation(
  prevLessons: BookLessonRecord[],
  nextDraft: Pick<TocUnitDraft, 'title' | 'unitNumber'>,
  nextLessons: BookLessonRecord[],
): boolean {
  if (nextLessons.length === 0) return false
  // If the next draft already claims a different unit number, do not stitch.
  const nextNum = resolveDraftUnitNumber(nextDraft)
  if (nextNum != null) return false

  const prevNums = lessonChunkNumbers(prevLessons)
  const nextNums = lessonChunkNumbers(nextLessons)
  if (prevNums.length === 0 || nextNums.length === 0) return false

  const prevMax = Math.max(...prevNums)
  const nextMin = Math.min(...nextNums)
  // Continuation typically resumes at prevMax+1 (Week 2 → Week 3).
  return nextMin === prevMax + 1
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
      let existingIdx = indexByKey.get(key)

      // Mistitled continuation (e.g. "Great Inventions" = Unit 5 Week 3+) → stitch to last unit.
      if (existingIdx == null && mergedDrafts.length > 0) {
        const lastIdx = mergedDrafts.length - 1
        const lastLessons = mergedLessons[lastIdx] ?? []
        if (looksLikeUnitContinuation(lastLessons, nextDraft, nextLessons)) {
          existingIdx = lastIdx
        }
      }

      if (existingIdx == null) {
        indexByKey.set(key, mergedDrafts.length)
        mergedDrafts.push({
          ...nextDraft,
          ...(resolveDraftUnitNumber(nextDraft) != null
            ? { unitNumber: resolveDraftUnitNumber(nextDraft)! }
            : {}),
        })
        mergedLessons.push(nextLessons)
        continue
      }

      const prevDraft = mergedDrafts[existingIdx]!
      const prevLessons = mergedLessons[existingIdx] ?? []
      mergedLessons[existingIdx] = mergeLessonLists(prevLessons, nextLessons)
      mergedDrafts[existingIdx] = preferEarlierStart(prevDraft, nextDraft)
      // Keep key map pointing at the surviving unit for later number-based merges.
      const resolvedNum = resolveDraftUnitNumber(mergedDrafts[existingIdx]!)
      if (resolvedNum != null) indexByKey.set(`n:${resolvedNum}`, existingIdx)
      indexByKey.set(unitMergeKey(mergedDrafts[existingIdx]!), existingIdx)
    }
  }

  recomputeDraftEndHints(mergedDrafts, mergedLessons)
  return { drafts: mergedDrafts, lessonsByUnit: mergedLessons }
}

/**
 * Split TOC images into batches with a 1-page overlap so unit headers on the
 * last page of a batch are also visible when extracting the continuation page.
 */
export function chunkTocImagesWithOverlap<T>(items: T[], size: number, overlap = 1): T[][] {
  if (items.length === 0) return []
  if (size <= 0) return [items]
  const step = Math.max(1, size - Math.max(0, overlap))
  const out: T[][] = []
  for (let i = 0; i < items.length; i += step) {
    const batch = items.slice(i, i + size)
    if (batch.length === 0) break
    // Avoid a tiny trailing batch that is fully contained in the previous one.
    if (out.length > 0 && batch.length <= overlap && i + batch.length >= items.length) {
      const prev = out[out.length - 1]!
      const merged = [...prev]
      for (const item of batch) {
        if (!merged.includes(item)) merged.push(item)
      }
      out[out.length - 1] = merged
      break
    }
    out.push(batch)
    if (i + size >= items.length) break
  }
  return out
}

/** Open unit at the end of a merged outline — passed into the next extract pass. */
export function openUnitContinuationHint(
  batch: TocExtractBatch,
): { unitNumber: number | null; title: string; lastLessonNumber: number | null } | null {
  if (!batch.drafts.length) return null
  const lastIdx = batch.drafts.length - 1
  const draft = batch.drafts[lastIdx]!
  const lessons = batch.lessonsByUnit[lastIdx] ?? []
  const nums = lessonChunkNumbers(lessons)
  return {
    unitNumber: resolveDraftUnitNumber(draft),
    title: draft.title.trim(),
    lastLessonNumber: nums.length ? Math.max(...nums) : null,
  }
}

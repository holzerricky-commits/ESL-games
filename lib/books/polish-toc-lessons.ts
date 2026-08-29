/**
 * Phase 3c — polish optional lesson nesting after TOC extract normalize.
 * Especially for generic / flat TOCs: drop empty chunks, merge dupes, fix useless titles.
 */

import type { BookLessonPartRecord, BookLessonRecord } from '@/lib/books/types'
import type { TocExtractProfileId } from '@/lib/books/toc-extract-profile'
import { normalizeUnitTitleForMerge } from '@/lib/books/merge-toc-extract-batches'

function partDedupeKey(part: BookLessonPartRecord): string {
  const title = normalizeUnitTitleForMerge(part.title)
  const start =
    typeof part.startPageHint === 'number' && Number.isFinite(part.startPageHint)
      ? String(Math.round(part.startPageHint))
      : '_'
  return `${title}::${start}`
}

/** Drop duplicate parts (same title + start) inside one lesson. */
export function dedupeLessonParts(parts: BookLessonPartRecord[] | undefined): BookLessonPartRecord[] {
  if (!parts?.length) return []
  const seen = new Set<string>()
  const out: BookLessonPartRecord[] = []
  for (const part of parts) {
    const key = partDedupeKey(part)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(part)
  }
  return out
}

/**
 * True when the mid-level chunk title adds no information beyond the unit
 * (flat TOC wrapper: "Contents", "Section 1", same as unit title, bare Lesson/Week N).
 */
export function isGenericLessonChunkTitle(lessonTitle: string, unitTitle: string): boolean {
  const lesson = normalizeUnitTitleForMerge(lessonTitle)
  const unit = normalizeUnitTitleForMerge(unitTitle)
  if (!lesson) return true
  if (lesson === unit) return true
  if (/^(contents|overview|sections?|readings?)$/i.test(lesson)) return true
  if (/^section\s+\d+$/i.test(lesson)) return true
  if (/^(lesson|week)\s+\d+$/i.test(lesson)) return true
  // "Lesson 1: Unit 1 Amazing Animals" echoing the unit
  if (unit && lesson.includes(unit) && lesson.length <= unit.length + 16) return true
  return false
}

function mergeParts(a: BookLessonPartRecord[] | undefined, b: BookLessonPartRecord[] | undefined): BookLessonPartRecord[] {
  return dedupeLessonParts([...(a ?? []), ...(b ?? [])]).sort(
    (x, y) =>
      (typeof x.startPageHint === 'number' ? x.startPageHint : Number.MAX_SAFE_INTEGER) -
      (typeof y.startPageHint === 'number' ? y.startPageHint : Number.MAX_SAFE_INTEGER),
  )
}

function lessonHasContent(lesson: BookLessonRecord): boolean {
  if (lesson.title.trim().length > 0) return true
  if (lesson.parts && lesson.parts.length > 0) return true
  return typeof lesson.startPageHint === 'number' && Number.isFinite(lesson.startPageHint)
}

function pickFlatChunkTitle(unitTitle: string, lesson: BookLessonRecord): string {
  const unit = unitTitle.trim()
  const firstPart = lesson.parts?.find((p) => p.title.trim())?.title.trim()
  // Prefer unit theme over a useless "Contents" / "Section 1"
  if (unit) return unit
  if (firstPart) return firstPart
  return lesson.title.trim() || 'Contents'
}

/**
 * Merge consecutive lessons that share the same normalized title (split across TOC pages).
 */
export function mergeAdjacentDuplicateLessons(lessons: BookLessonRecord[]): BookLessonRecord[] {
  const out: BookLessonRecord[] = []
  for (const lesson of lessons) {
    const prev = out[out.length - 1]
    if (
      prev &&
      normalizeUnitTitleForMerge(prev.title) === normalizeUnitTitleForMerge(lesson.title) &&
      normalizeUnitTitleForMerge(prev.title).length > 0
    ) {
      const parts = mergeParts(prev.parts, lesson.parts)
      const startPageHint =
        typeof prev.startPageHint === 'number' && typeof lesson.startPageHint === 'number'
          ? Math.min(prev.startPageHint, lesson.startPageHint)
          : (prev.startPageHint ?? lesson.startPageHint)
      out[out.length - 1] = {
        ...prev,
        ...(startPageHint != null ? { startPageHint } : {}),
        ...(parts.length ? { parts } : { parts: undefined }),
      }
      continue
    }
    out.push(lesson)
  }
  return out
}

/**
 * Polish lessons inside one unit after AI normalize.
 * Safe for all profiles; strongest effect on generic flat TOCs.
 */
export function polishTocLessonsForUnit(
  unitTitle: string,
  lessonsIn: BookLessonRecord[],
  profile: TocExtractProfileId = 'generic',
): BookLessonRecord[] {
  let lessons = lessonsIn
    .map((lesson) => {
      const parts = dedupeLessonParts(lesson.parts)
      const startPageHint =
        lesson.startPageHint ??
        parts.find((p) => typeof p.startPageHint === 'number')?.startPageHint
      return {
        ...lesson,
        ...(startPageHint != null ? { startPageHint } : {}),
        ...(parts.length ? { parts } : { parts: undefined }),
      }
    })
    .filter(lessonHasContent)

  lessons.sort(
    (a, b) =>
      (typeof a.startPageHint === 'number' ? a.startPageHint : Number.MAX_SAFE_INTEGER) -
      (typeof b.startPageHint === 'number' ? b.startPageHint : Number.MAX_SAFE_INTEGER),
  )

  lessons = mergeAdjacentDuplicateLessons(lessons)

  // Flat TOC: one wrapper chunk with parts → give it a meaningful title.
  if (profile === 'generic' && lessons.length === 1) {
    const only = lessons[0]!
    if (isGenericLessonChunkTitle(only.title, unitTitle) && (only.parts?.length ?? 0) > 0) {
      lessons = [{ ...only, title: pickFlatChunkTitle(unitTitle, only) }]
    }
  }

  // Recompute lesson end hints from neighbors after merges.
  for (let i = 0; i < lessons.length; i++) {
    const current = lessons[i]!
    const next = lessons[i + 1]
    if (typeof current.startPageHint !== 'number') continue
    if (/unit\s*wrap[\s-]*up/i.test(current.title)) {
      current.endPageHint = current.startPageHint
    } else if (typeof next?.startPageHint === 'number') {
      current.endPageHint = Math.max(current.startPageHint, next.startPageHint - 1)
    }
  }

  return lessons
}

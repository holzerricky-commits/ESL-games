import {
  resolveOutlineDisplayRange,
  resolveStoryDisplayRangeToPdfPages,
} from '@/lib/books/reading-story-map'
import { resolvePartStructureTag } from '@/lib/books/part-structure-tag'
import { resolveTocExtractProfile } from '@/lib/books/toc-extract-profile'
import type { BookLessonPartTag, BookRecord, BookUnitRecord } from '@/lib/books/types'

/** Parts that usually teach this week's skill / vocab / opener material. */
export const LESSON_FRAME_SOURCE_TAGS: readonly BookLessonPartTag[] = [
  'vocabulary_in_context',
  'vocabulary_background',
  'comprehension',
  'genre',
  'vocabulary_strategy',
  'literary_element',
] as const

/** Max display pages per discrete section (keeps OCR/AI calls small). */
export const LESSON_FRAME_SECTION_MAX_PAGES = 4

export type LessonFrameResolvedPages = {
  startPdfPage: number
  endPdfPage: number
  startDisplayPage: number
  endDisplayPage: number
  /** Part titles included in the scan window. */
  partTitles: string[]
  /** Why this range was chosen. */
  source: 'outline_parts' | 'lesson_span' | 'none'
}

export type LessonFrameSection = {
  partId: string
  partIndex: number
  title: string
  tag: BookLessonPartTag | 'fallback'
  startDisplayPage: number
  endDisplayPage: number
  startPdfPage: number
  endPdfPage: number
  source: 'outline_parts' | 'lesson_span'
}

function capDisplaySpan(start: number, end: number, maxPages: number): { start: number; end: number } {
  const s = Math.min(start, end)
  let e = Math.max(start, end)
  if (e - s + 1 > maxPages) {
    e = s + maxPages - 1
  }
  return { start: s, end: e }
}

function toPdfSection(
  book: BookRecord,
  unit: BookUnitRecord,
  totalPdfPages: number | null,
  startDisplay: number,
  endDisplay: number,
): { startPdfPage: number; endPdfPage: number } {
  return resolveStoryDisplayRangeToPdfPages(book, unit, totalPdfPages, startDisplay, endDisplay, {
    tocAnchored: true,
  })
}

/**
 * Discrete outline sections to scan for a lesson frame (skill / EQ / vocab).
 * Never includes main_story / paired_story. Does not min/max across parts.
 */
export function resolveLessonFrameSections(
  book: BookRecord,
  unit: BookUnitRecord,
  lessonId: string,
  totalPdfPages: number | null,
): LessonFrameSection[] {
  const lesson = (unit.lessons ?? []).find((l) => l.id === lessonId)
  if (!lesson) return []

  const profile = resolveTocExtractProfile(book)
  const parts = lesson.parts ?? []
  const sections: LessonFrameSection[] = []

  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i]!
    const tag = resolvePartStructureTag(part, i, profile)
    if (!LESSON_FRAME_SOURCE_TAGS.includes(tag)) continue
    const display = resolveOutlineDisplayRange(book, unit, lesson, part, i, totalPdfPages)
    if (!display) continue
    const capped = capDisplaySpan(display.start, display.end, LESSON_FRAME_SECTION_MAX_PAGES)
    const pdf = toPdfSection(book, unit, totalPdfPages, capped.start, capped.end)
    sections.push({
      partId: part.id,
      partIndex: i,
      title: part.title,
      tag,
      startDisplayPage: capped.start,
      endDisplayPage: capped.end,
      startPdfPage: pdf.startPdfPage,
      endPdfPage: pdf.endPdfPage,
      source: 'outline_parts',
    })
  }

  if (sections.length > 0) return sections

  // Fallback: pages before the first main/paired story as one synthetic section.
  let storyStartIndex = -1
  for (let i = 0; i < parts.length; i += 1) {
    const tag = resolvePartStructureTag(parts[i]!, i, profile)
    if (tag === 'main_story' || tag === 'paired_story') {
      storyStartIndex = i
      break
    }
  }

  if (storyStartIndex > 0) {
    const openerParts = parts.slice(0, storyStartIndex)
    const ranges: Array<{ start: number; end: number; title: string; partId: string; partIndex: number }> =
      []
    for (let i = 0; i < openerParts.length; i += 1) {
      const part = openerParts[i]!
      const display = resolveOutlineDisplayRange(book, unit, lesson, part, i, totalPdfPages)
      if (!display) continue
      ranges.push({
        start: display.start,
        end: display.end,
        title: part.title,
        partId: part.id,
        partIndex: i,
      })
    }
    if (ranges.length > 0) {
      const startDisplay = Math.min(...ranges.map((r) => r.start))
      const endDisplay = Math.max(...ranges.map((r) => r.end))
      const capped = capDisplaySpan(startDisplay, endDisplay, LESSON_FRAME_SECTION_MAX_PAGES)
      const pdf = toPdfSection(book, unit, totalPdfPages, capped.start, capped.end)
      const first = ranges[0]!
      return [
        {
          partId: first.partId,
          partIndex: first.partIndex,
          title: ranges.map((r) => r.title).join(' · '),
          tag: 'fallback',
          startDisplayPage: capped.start,
          endDisplayPage: capped.end,
          startPdfPage: pdf.startPdfPage,
          endPdfPage: pdf.endPdfPage,
          source: 'outline_parts',
        },
      ]
    }
  }

  const lessonDisplay = resolveLessonDisplaySpan(book, unit, lessonId, totalPdfPages)
  if (!lessonDisplay) return []

  // Cap lesson-span fallback (~8 pages) then section max.
  const MAX_LESSON_SPAN = 8
  let startDisplay = lessonDisplay.start
  let endDisplay = lessonDisplay.end
  if (endDisplay - startDisplay + 1 > MAX_LESSON_SPAN) {
    endDisplay = startDisplay + MAX_LESSON_SPAN - 1
  }
  const capped = capDisplaySpan(startDisplay, endDisplay, LESSON_FRAME_SECTION_MAX_PAGES)
  const pdf = toPdfSection(book, unit, totalPdfPages, capped.start, capped.end)
  return [
    {
      partId: `fallback:${lessonId}`,
      partIndex: -1,
      title: lesson.title,
      tag: 'fallback',
      startDisplayPage: capped.start,
      endDisplayPage: capped.end,
      startPdfPage: pdf.startPdfPage,
      endPdfPage: pdf.endPdfPage,
      source: 'lesson_span',
    },
  ]
}

/**
 * Union bounds across discrete sections (metadata / legacy callers).
 * Prefer {@link resolveLessonFrameSections} for scanning.
 */
export function resolveLessonFramePages(
  book: BookRecord,
  unit: BookUnitRecord,
  lessonId: string,
  totalPdfPages: number | null,
): LessonFrameResolvedPages | null {
  const sections = resolveLessonFrameSections(book, unit, lessonId, totalPdfPages)
  if (sections.length === 0) return null

  const startDisplay = Math.min(...sections.map((s) => s.startDisplayPage))
  const endDisplay = Math.max(...sections.map((s) => s.endDisplayPage))
  const startPdfPage = Math.min(...sections.map((s) => s.startPdfPage))
  const endPdfPage = Math.max(...sections.map((s) => s.endPdfPage))
  const source = sections.every((s) => s.source === 'lesson_span') ? 'lesson_span' : 'outline_parts'

  return {
    startPdfPage,
    endPdfPage,
    startDisplayPage: startDisplay,
    endDisplayPage: endDisplay,
    partTitles: sections.map((s) => s.title),
    source,
  }
}

function resolveLessonDisplaySpan(
  book: BookRecord,
  unit: BookUnitRecord,
  lessonId: string,
  totalPdfPages: number | null,
): { start: number; end: number } | null {
  const lessons = unit.lessons ?? []
  const lesson = lessons.find((l) => l.id === lessonId)
  if (!lesson) return null
  const parts = lesson.parts ?? []
  if (parts.length === 0) {
    if (typeof lesson.startPageHint === 'number' && lesson.startPageHint >= 1) {
      const start = Math.floor(lesson.startPageHint)
      const end =
        typeof lesson.endPageHint === 'number' && lesson.endPageHint >= start
          ? Math.floor(lesson.endPageHint)
          : start
      return { start, end }
    }
    return null
  }
  const first = resolveOutlineDisplayRange(book, unit, lesson, parts[0]!, 0, totalPdfPages)
  const last = resolveOutlineDisplayRange(
    book,
    unit,
    lesson,
    parts[parts.length - 1]!,
    parts.length - 1,
    totalPdfPages,
  )
  if (!first || !last) return first ?? last
  return {
    start: Math.min(first.start, last.start),
    end: Math.max(first.end, last.end),
  }
}

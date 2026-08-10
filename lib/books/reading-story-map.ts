import type { BookLessonPartRecord, BookLessonRecord, BookRecord, BookUnitRecord } from '@/lib/books/types'
import { buildPageAlignmentRuntime, resolveEffectiveAnchorToPdfPage } from '@/lib/books/page-alignment-runtime'
import { getFileAlignment, getUnitReaderBounds } from '@/lib/books/page-range'
import { resolvePartStructureTag } from '@/lib/books/part-structure-tag'
import { pageRangeForIndex } from '@/lib/books/toc-page-range'

/** Outline story kind for Stories tab labels. */
export type ReadingStoryKind = 'main_story' | 'paired_story' | 'manual'

/** Teacher-facing story identity for reading checks (Phase 1 = page range only). */
export interface ReadingStoryMap {
  /** Stable key: `${bookId}::${unitId}::${lessonId}::${partId}` or `manual::…` */
  id: string
  bookId: string
  unitId: string
  lessonId: string | null
  partId: string | null
  title: string
  kind?: ReadingStoryKind
  lessonTitle?: string
}

/** Saved / confirmed page span. Pages match outline hints (printed) when the story is outline-linked. */
export interface ReadingStoryRangeOverride {
  storyId: string
  startPage: number
  endPage: number
  rangeConfirmed: boolean
  updatedAt: string
  /** Present when this override defines a manual story (not only patching a seed). */
  title?: string
  bookId?: string
  unitId?: string
  lessonId?: string | null
  partId?: string | null
}

export interface ReadingStoryPdfRange {
  startPdfPage: number
  endPdfPage: number
  /** Same numbers shown in the outline / Stories UI (printed when TOC-aligned). */
  startDisplayPage: number
  endDisplayPage: number
  source: 'override' | 'outline' | 'none'
  rangeConfirmed: boolean
}

export function readingStoryPartKey(
  bookId: string,
  unitId: string,
  lessonId: string,
  partId: string,
): string {
  return `${bookId}::${unitId}::${lessonId}::${partId}`
}

/**
 * Outline story ids look like `bookId::unitId::lessonId::partId`.
 * Manual stories (`manual::…`) have no lesson.
 */
export function lessonIdFromReadingStoryId(storyId: string): string | null {
  const id = storyId.trim()
  if (!id || id.startsWith('manual::')) return null
  const parts = id.split('::')
  if (parts.length < 4) return null
  const lessonId = parts[2]?.trim()
  return lessonId || null
}

export function readingStoryManualKey(bookId: string, unitId: string, localId: string): string {
  return `manual::${bookId}::${unitId}::${localId}`
}

/**
 * First teachable story (same neighborhood as interactive vocab demo).
 * Outline part: Jump! · Lesson 11 · Unit 3 · Journeys G3.
 */
export const READING_STORY_SEEDS: ReadingStoryMap[] = [
  {
    id: readingStoryPartKey(
      'journeys-g3-book-1',
      'unit-3-3e7eaa87',
      'lesson-2d6f0fe0',
      'part-ab394f3e',
    ),
    bookId: 'journeys-g3-book-1',
    unitId: 'unit-3-3e7eaa87',
    lessonId: 'lesson-2d6f0fe0',
    partId: 'part-ab394f3e',
    title: 'Jump! from the Life of Michael Jordan',
  },
]

export function listSeedStoriesForBook(bookId: string): ReadingStoryMap[] {
  return READING_STORY_SEEDS.filter((s) => s.bookId === bookId)
}

/** Outline parts tagged main_story or paired_story across the book. */
export function discoverOutlineStories(book: BookRecord): ReadingStoryMap[] {
  const out: ReadingStoryMap[] = []
  for (const unit of book.units ?? []) {
    for (const lesson of unit.lessons ?? []) {
      const parts = lesson.parts ?? []
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        if (!part?.id) continue
        const tag = resolvePartStructureTag(part, i)
        if (tag !== 'main_story' && tag !== 'paired_story') continue
        out.push({
          id: readingStoryPartKey(book.id, unit.id, lesson.id, part.id),
          bookId: book.id,
          unitId: unit.id,
          lessonId: lesson.id,
          partId: part.id,
          title: part.title?.trim() || 'Story',
          kind: tag,
          lessonTitle: lesson.title,
        })
      }
    }
  }
  return out
}

export type ReadingStoryPageStatus = 'none' | 'guessed' | 'confirmed'

export function getReadingStoryPageStatus(range: ReadingStoryPdfRange): ReadingStoryPageStatus {
  if (range.source === 'none') return 'none'
  if (range.rangeConfirmed) return 'confirmed'
  return 'guessed'
}

/**
 * Outline discoveries ∪ seeds ∪ manual overrides (dedupe by id).
 * Pass `book` when available so outline stories appear without relying on seeds alone.
 */
export function mergeStoriesForBook(
  bookId: string,
  overrides: ReadingStoryRangeOverride[],
  book?: BookRecord | null,
): ReadingStoryMap[] {
  const byId = new Map<string, ReadingStoryMap>()

  if (book && book.id === bookId) {
    for (const discovered of discoverOutlineStories(book)) {
      byId.set(discovered.id, discovered)
    }
  }

  for (const seed of listSeedStoriesForBook(bookId)) {
    const existing = byId.get(seed.id)
    byId.set(seed.id, existing ? { ...seed, ...existing, title: existing.title || seed.title } : seed)
  }

  for (const o of overrides) {
    if (o.bookId && o.bookId !== bookId) continue
    if (!o.storyId.startsWith('manual::') && !byId.has(o.storyId)) {
      // Override for unknown seed id on this book — skip unless manual/custom fields exist
      if (!o.title || !o.unitId) continue
    }
    if (o.storyId.startsWith('manual::') || (o.title && o.unitId && !byId.has(o.storyId))) {
      const bid = o.bookId ?? bookId
      if (bid !== bookId) continue
      byId.set(o.storyId, {
        id: o.storyId,
        bookId: bid,
        unitId: o.unitId!,
        lessonId: o.lessonId ?? null,
        partId: o.partId ?? null,
        title: o.title ?? 'Story',
        kind: 'manual',
      })
    }
  }

  return Array.from(byId.values())
}

function findLessonAndPart(
  unit: BookUnitRecord,
  lessonId: string | null,
  partId: string | null,
): { lesson: BookLessonRecord; part: BookLessonPartRecord; partIndex: number } | null {
  if (!lessonId || !partId) return null
  const lesson = (unit.lessons ?? []).find((l) => l.id === lessonId)
  if (!lesson) return null
  const parts = lesson.parts ?? []
  const partIndex = parts.findIndex((p) => p.id === partId)
  if (partIndex < 0) return null
  const part = parts[partIndex]
  if (!part) return null
  return { lesson, part, partIndex }
}

/** Outline-inferred inclusive display (printed) page span for a part. */
export function resolveOutlineDisplayRange(
  book: BookRecord,
  unit: BookUnitRecord,
  lesson: BookLessonRecord,
  part: BookLessonPartRecord,
  partIndex: number,
  totalPdfPages: number | null,
): { start: number; end: number } | null {
  const bounds = getUnitReaderBounds(unit, totalPdfPages, book)
  const lessons = unit.lessons ?? []
  const lessonIdx = Math.max(0, lessons.findIndex((l) => l.id === lesson.id))
  const lessonRange = pageRangeForIndex(lessons, lessonIdx, bounds.min, bounds.max)
  const parts = lesson.parts ?? []
  const pr = pageRangeForIndex(parts, partIndex, lessonRange.start, lessonRange.end)
  const start = pr.start
  const end = pr.end ?? pr.start
  if (start == null || end == null) return null
  return { start: Math.min(start, end), end: Math.max(start, end) }
}

function displayRangeToPdfRange(
  book: BookRecord,
  unit: BookUnitRecord,
  totalPdfPages: number | null,
  startDisplay: number,
  endDisplay: number,
  /** When true, map printed/display pages through the book’s page-alignment table. */
  usePrintedAlignment: boolean,
): { startPdfPage: number; endPdfPage: number } {
  if (!usePrintedAlignment) {
    return {
      startPdfPage: Math.min(startDisplay, endDisplay),
      endPdfPage: Math.max(startDisplay, endDisplay),
    }
  }
  // Without a real PDF page count, alignment maps are empty and printed≠PDF.
  // Refuse identity fallback for TOC-anchored books — caller must supply totalPdfPages.
  if (totalPdfPages == null || totalPdfPages < 1) {
    return {
      startPdfPage: Math.min(startDisplay, endDisplay),
      endPdfPage: Math.max(startDisplay, endDisplay),
    }
  }
  const { notCountedPdfPages, hiddenPdfPages } = getFileAlignment(book, unit.filePath)
  const runtime = buildPageAlignmentRuntime(totalPdfPages, hiddenPdfPages, notCountedPdfPages)
  const toPdf = (n: number) => resolveEffectiveAnchorToPdfPage(Math.round(n), runtime) ?? n
  const a = toPdf(startDisplay)
  const b = toPdf(endDisplay)
  return { startPdfPage: Math.min(a, b), endPdfPage: Math.max(a, b) }
}

/**
 * Prefer printed→PDF alignment whenever we know the file’s page count.
 * Manual stories (no outline part) still use printed numbers when the book has alignment.
 */
function shouldUsePrintedPageAlignment(
  book: BookRecord,
  unit: BookUnitRecord,
  totalPdfPages: number | null,
  tocAnchored: boolean,
): boolean {
  if (totalPdfPages == null || totalPdfPages < 1) return false
  if (tocAnchored) return true
  const { notCountedPdfPages, hiddenPdfPages } = getFileAlignment(book, unit.filePath)
  return (notCountedPdfPages?.length ?? 0) > 0 || (hiddenPdfPages?.length ?? 0) > 0
}

/**
 * Convert printed story start/end to PDF indices using the same path as {@link resolveReadingStoryRange}.
 */
export function resolveStoryDisplayRangeToPdfPages(
  book: BookRecord,
  unit: BookUnitRecord,
  totalPdfPages: number | null,
  startDisplay: number,
  endDisplay: number,
  options?: { tocAnchored?: boolean },
): { startPdfPage: number; endPdfPage: number } {
  const tocAnchored = options?.tocAnchored ?? true
  const start = Math.min(startDisplay, endDisplay)
  const end = Math.max(startDisplay, endDisplay)
  return displayRangeToPdfRange(book, unit, totalPdfPages, start, end, tocAnchored)
}

export function resolveReadingStoryRange(
  story: ReadingStoryMap,
  book: BookRecord,
  unit: BookUnitRecord,
  totalPdfPages: number | null,
  override: ReadingStoryRangeOverride | null | undefined,
): ReadingStoryPdfRange {
  const hit = findLessonAndPart(unit, story.lessonId, story.partId)
  const tocAnchored = Boolean(
    hit &&
      (typeof hit.lesson.startPageHint === 'number' ||
        typeof hit.lesson.endPageHint === 'number' ||
        typeof hit.part.startPageHint === 'number' ||
        typeof hit.part.endPageHint === 'number'),
  )
  const useAlignment = shouldUsePrintedPageAlignment(book, unit, totalPdfPages, tocAnchored)

  // Confirmed teacher override wins. Outline is the source of truth until then.
  if (
    override?.rangeConfirmed &&
    Number.isFinite(override.startPage) &&
    Number.isFinite(override.endPage)
  ) {
    const startDisplay = Math.min(override.startPage, override.endPage)
    const endDisplay = Math.max(override.startPage, override.endPage)
    const pdf = displayRangeToPdfRange(
      book,
      unit,
      totalPdfPages,
      startDisplay,
      endDisplay,
      useAlignment,
    )
    return {
      ...pdf,
      startDisplayPage: startDisplay,
      endDisplayPage: endDisplay,
      source: 'override',
      rangeConfirmed: true,
    }
  }

  if (hit) {
    const outline = resolveOutlineDisplayRange(book, unit, hit.lesson, hit.part, hit.partIndex, totalPdfPages)
    if (outline) {
      const pdf = displayRangeToPdfRange(book, unit, totalPdfPages, outline.start, outline.end, useAlignment)
      return {
        ...pdf,
        startDisplayPage: outline.start,
        endDisplayPage: outline.end,
        source: 'outline',
        rangeConfirmed: false,
      }
    }
  }

  // Manual stories (no outline part): use saved range even before "confirm" if present.
  if (override && Number.isFinite(override.startPage) && Number.isFinite(override.endPage)) {
    const startDisplay = Math.min(override.startPage, override.endPage)
    const endDisplay = Math.max(override.startPage, override.endPage)
    const pdf = displayRangeToPdfRange(
      book,
      unit,
      totalPdfPages,
      startDisplay,
      endDisplay,
      useAlignment,
    )
    return {
      ...pdf,
      startDisplayPage: startDisplay,
      endDisplayPage: endDisplay,
      source: 'override',
      rangeConfirmed: Boolean(override.rangeConfirmed),
    }
  }

  return {
    startPdfPage: 1,
    endPdfPage: 1,
    startDisplayPage: 1,
    endDisplayPage: 1,
    source: 'none',
    rangeConfirmed: false,
  }
}

export function isPdfPageInReadingStory(
  pdfPage: number,
  range: ReadingStoryPdfRange,
): boolean {
  if (range.source === 'none') return false
  return pdfPage >= range.startPdfPage && pdfPage <= range.endPdfPage
}

export function findReadingStoryAtPdfPage(args: {
  book: BookRecord
  unit: BookUnitRecord
  pdfPage: number
  totalPdfPages: number | null
  stories: ReadingStoryMap[]
  overridesByStoryId: Record<string, ReadingStoryRangeOverride>
}): { story: ReadingStoryMap; range: ReadingStoryPdfRange } | null {
  const { book, unit, pdfPage, totalPdfPages, stories, overridesByStoryId } = args
  for (const story of stories) {
    if (story.unitId !== unit.id) continue
    const range = resolveReadingStoryRange(story, book, unit, totalPdfPages, overridesByStoryId[story.id])
    if (isPdfPageInReadingStory(pdfPage, range)) {
      return { story, range }
    }
  }
  return null
}

export function sanitizeReadingStoryRangeOverride(
  input: Partial<ReadingStoryRangeOverride> & { storyId: string },
): ReadingStoryRangeOverride | null {
  const storyId = String(input.storyId ?? '').trim()
  if (!storyId) return null
  const startPage = Math.max(1, Math.floor(Number(input.startPage)))
  const endPage = Math.max(1, Math.floor(Number(input.endPage)))
  if (!Number.isFinite(startPage) || !Number.isFinite(endPage)) return null
  const lo = Math.min(startPage, endPage)
  const hi = Math.max(startPage, endPage)
  const now = new Date().toISOString()
  const out: ReadingStoryRangeOverride = {
    storyId,
    startPage: lo,
    endPage: hi,
    rangeConfirmed: Boolean(input.rangeConfirmed),
    updatedAt: typeof input.updatedAt === 'string' && input.updatedAt ? input.updatedAt : now,
  }
  if (input.title?.trim()) out.title = input.title.trim().slice(0, 500)
  if (input.bookId?.trim()) out.bookId = input.bookId.trim()
  if (input.unitId?.trim()) out.unitId = input.unitId.trim()
  if (input.lessonId !== undefined) {
    out.lessonId = input.lessonId == null || input.lessonId === '' ? null : String(input.lessonId)
  }
  if (input.partId !== undefined) {
    out.partId = input.partId == null || input.partId === '' ? null : String(input.partId)
  }
  return out
}

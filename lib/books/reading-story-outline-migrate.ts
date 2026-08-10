import {
  discoverOutlineStories,
  type ReadingStoryMap,
  type ReadingStoryRangeOverride,
  readingStoryPartKey,
} from '@/lib/books/reading-story-map'
import type { BookLessonRecord, BookRecord, BookUnitRecord } from '@/lib/books/types'
import type { TocUnitDraft } from '@/lib/books/toc-import'

export type ManualStoryReconcileAction = 'merge' | 'keep' | 'delete'

export type ManualOutlineMatchConfidence = 'high' | 'medium' | 'none'

export interface ManualOutlineMatchCandidate {
  manual: ReadingStoryMap
  override: ReadingStoryRangeOverride
  outline: ReadingStoryMap | null
  confidence: ManualOutlineMatchConfidence
  /** Inclusive page overlap count when both sides have ranges; else 0. */
  pageOverlap: number
  titleScore: number
}

export interface ManualStoryReconcileDecision {
  manualStoryId: string
  action: ManualStoryReconcileAction
  /** Required when action is merge. */
  outlineStoryId?: string
}

function normalizeTitle(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Dice coefficient on word sets — good enough for short story titles. */
export function titleSimilarity(a: string, b: string): number {
  const wa = new Set(normalizeTitle(a).split(' ').filter(Boolean))
  const wb = new Set(normalizeTitle(b).split(' ').filter(Boolean))
  if (wa.size === 0 || wb.size === 0) return 0
  let inter = 0
  for (const w of wa) {
    if (wb.has(w)) inter += 1
  }
  return (2 * inter) / (wa.size + wb.size)
}

export function pageRangeOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): number {
  const loA = Math.min(aStart, aEnd)
  const hiA = Math.max(aStart, aEnd)
  const loB = Math.min(bStart, bEnd)
  const hiB = Math.max(bStart, bEnd)
  const lo = Math.max(loA, loB)
  const hi = Math.min(hiA, hiB)
  if (hi < lo) return 0
  return hi - lo + 1
}

function outlineDisplayRange(story: ReadingStoryMap, book: BookRecord): { start: number; end: number } | null {
  const unit = book.units.find((u) => u.id === story.unitId)
  if (!unit || !story.lessonId || !story.partId) return null
  const lesson = (unit.lessons ?? []).find((l) => l.id === story.lessonId)
  if (!lesson) return null
  const parts = lesson.parts ?? []
  const partIndex = parts.findIndex((p) => p.id === story.partId)
  const part = parts[partIndex]
  if (!part) return null
  const start = part.startPageHint ?? lesson.startPageHint
  if (typeof start !== 'number') return null
  let end = part.endPageHint
  if (typeof end !== 'number') {
    const next = parts[partIndex + 1]
    if (typeof next?.startPageHint === 'number') end = next.startPageHint - 1
    else if (typeof lesson.endPageHint === 'number') end = lesson.endPageHint
    else end = start
  }
  return { start: Math.min(start, end), end: Math.max(start, end) }
}

/**
 * Build a temporary book record from wizard drafts so outline stories can be discovered
 * before the manifest is saved.
 */
export function bookRecordFromOutlineDrafts(
  book: Pick<BookRecord, 'id' | 'title' | 'series' | 'grade' | 'role' | 'description'>,
  drafts: TocUnitDraft[],
  lessonsByUnit: BookLessonRecord[][],
  fallbackFilePath: string,
): BookRecord {
  const units: BookUnitRecord[] = drafts.map((d, i) => ({
    id: d.id,
    title: d.title,
    filePath: (d.filePath?.trim() || fallbackFilePath).trim() || fallbackFilePath,
    ...(typeof d.startPageHint === 'number' ? { startPageHint: d.startPageHint } : {}),
    ...(typeof d.endPageHint === 'number' ? { endPageHint: d.endPageHint } : {}),
    ...(d.anchorConfidence ? { anchorConfidence: d.anchorConfidence } : {}),
    ...(d.anchorSource ? { anchorSource: d.anchorSource } : {}),
    lessons: lessonsByUnit[i] ?? [],
  }))
  return {
    id: book.id,
    title: book.title,
    ...(book.description ? { description: book.description } : {}),
    ...(book.series != null ? { series: book.series } : {}),
    ...(book.grade != null ? { grade: book.grade } : {}),
    ...(book.role != null ? { role: book.role } : {}),
    units,
  }
}

export function listManualOverridesForBook(
  overrides: ReadingStoryRangeOverride[],
  bookId: string,
): ReadingStoryRangeOverride[] {
  return overrides.filter((o) => {
    if (!o.storyId.startsWith('manual::')) return false
    if (o.bookId) return o.bookId === bookId
    return o.storyId.startsWith(`manual::${bookId}::`)
  })
}

/**
 * Pair each manual story with the best unused outline story (title + page overlap).
 */
export function matchManualStoriesToOutline(args: {
  book: BookRecord
  manuals: ReadingStoryMap[]
  overridesById: Record<string, ReadingStoryRangeOverride>
  outlineStories?: ReadingStoryMap[]
}): ManualOutlineMatchCandidate[] {
  const outline = args.outlineStories ?? discoverOutlineStories(args.book)
  const usedOutline = new Set<string>()
  const results: ManualOutlineMatchCandidate[] = []

  const scored = args.manuals.map((manual) => {
    const override = args.overridesById[manual.id]
    const manualStart = override?.startPage
    const manualEnd = override?.endPage
    let best: {
      outline: ReadingStoryMap
      score: number
      titleScore: number
      pageOverlap: number
      confidence: ManualOutlineMatchConfidence
    } | null = null

    for (const candidate of outline) {
      const titleScore = titleSimilarity(manual.title, candidate.title)
      const range = outlineDisplayRange(candidate, args.book)
      let pageOverlap = 0
      if (
        range &&
        typeof manualStart === 'number' &&
        typeof manualEnd === 'number' &&
        Number.isFinite(manualStart) &&
        Number.isFinite(manualEnd)
      ) {
        pageOverlap = pageRangeOverlap(manualStart, manualEnd, range.start, range.end)
      }

      const hasTitle = titleScore >= 0.45
      const hasPages = pageOverlap > 0
      let confidence: ManualOutlineMatchConfidence = 'none'
      let score = 0
      if (hasTitle && hasPages) {
        confidence = 'high'
        score = 100 + titleScore * 20 + Math.min(pageOverlap, 40)
      } else if (hasPages && pageOverlap >= 3) {
        confidence = 'medium'
        score = 50 + Math.min(pageOverlap, 30)
      } else if (hasTitle && titleScore >= 0.7) {
        confidence = 'medium'
        score = 40 + titleScore * 20
      }

      if (confidence === 'none') continue
      if (!best || score > best.score) {
        best = { outline: candidate, score, titleScore, pageOverlap, confidence }
      }
    }

    return { manual, override, best }
  })

  // Greedy assign highest scores first so two manuals don't claim the same outline row.
  scored.sort((a, b) => (b.best?.score ?? 0) - (a.best?.score ?? 0))

  for (const row of scored) {
    const override = row.override ?? {
      storyId: row.manual.id,
      startPage: 1,
      endPage: 1,
      rangeConfirmed: false,
      updatedAt: '',
      title: row.manual.title,
      bookId: row.manual.bookId,
      unitId: row.manual.unitId,
    }
    if (row.best && !usedOutline.has(row.best.outline.id)) {
      usedOutline.add(row.best.outline.id)
      results.push({
        manual: row.manual,
        override,
        outline: row.best.outline,
        confidence: row.best.confidence,
        pageOverlap: row.best.pageOverlap,
        titleScore: row.best.titleScore,
      })
    } else {
      results.push({
        manual: row.manual,
        override,
        outline: null,
        confidence: 'none',
        pageOverlap: 0,
        titleScore: 0,
      })
    }
  }

  // Stable UI order: manuals in original order
  const order = new Map(args.manuals.map((m, i) => [m.id, i]))
  results.sort((a, b) => (order.get(a.manual.id) ?? 0) - (order.get(b.manual.id) ?? 0))
  return results
}

export function defaultReconcileAction(
  candidate: ManualOutlineMatchCandidate,
): ManualStoryReconcileAction {
  if (candidate.outline && (candidate.confidence === 'high' || candidate.confidence === 'medium')) {
    return 'merge'
  }
  return 'keep'
}

export function buildDefaultReconcileDecisions(
  candidates: ManualOutlineMatchCandidate[],
): ManualStoryReconcileDecision[] {
  return candidates.map((c) => {
    const action = defaultReconcileAction(c)
    return {
      manualStoryId: c.manual.id,
      action,
      ...(action === 'merge' && c.outline ? { outlineStoryId: c.outline.id } : {}),
    }
  })
}

/** Pick a draft unit whose page span covers the manual pages (for Keep re-home). */
export function suggestUnitIdForManualPages(
  book: BookRecord,
  startPage: number,
  endPage: number,
): string | null {
  const mid = (Math.min(startPage, endPage) + Math.max(startPage, endPage)) / 2
  let best: { id: string; dist: number } | null = null
  for (const unit of book.units) {
    const start = unit.startPageHint
    const end = unit.endPageHint ?? unit.startPageHint
    if (typeof start !== 'number') continue
    const hi = typeof end === 'number' ? end : start
    if (mid >= start && mid <= hi) {
      return unit.id
    }
    const dist = mid < start ? start - mid : mid - hi
    if (!best || dist < best.dist) best = { id: unit.id, dist }
  }
  return best?.id ?? book.units[0]?.id ?? null
}

export function parseOutlineStoryId(storyId: string): {
  bookId: string
  unitId: string
  lessonId: string
  partId: string
} | null {
  if (storyId.startsWith('manual::')) return null
  const parts = storyId.split('::')
  if (parts.length !== 4) return null
  const [bookId, unitId, lessonId, partId] = parts
  if (!bookId || !unitId || !lessonId || !partId) return null
  return { bookId, unitId, lessonId, partId }
}

export function outlineStoryIdFromParts(
  bookId: string,
  unitId: string,
  lessonId: string,
  partId: string,
): string {
  return readingStoryPartKey(bookId, unitId, lessonId, partId)
}

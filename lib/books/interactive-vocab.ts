import type { BookLessonPartRecord, BookLessonRecord, BookRecord, BookUnitRecord } from '@/lib/books/types'
import { buildPageAlignmentRuntime, resolveEffectiveAnchorToPdfPage } from '@/lib/books/page-alignment-runtime'
import { getFileAlignment, getUnitReaderBounds } from '@/lib/books/page-range'
import { pageRangeForIndex } from '@/lib/books/toc-page-range'

export interface InteractiveVocabWord {
  id: string
  word: string
  definition: string
  examples: string[]
}

export interface InteractiveVocabPack {
  /** Stable key: `${bookId}::${unitId}::${lessonId}::${partId}` */
  partKey: string
  sectionLabel: string
  words: InteractiveVocabWord[]
}

export function interactiveVocabPartKey(
  bookId: string,
  unitId: string,
  lessonId: string,
  partId: string,
): string {
  return `${bookId}::${unitId}::${lessonId}::${partId}`
}

/** Matches TOC label “Vocabulary in Context” (case-insensitive, normalized spaces). */
export function isVocabularyInContextPartTitle(title: string | undefined | null): boolean {
  const t = (title ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
  return t === 'vocabulary in context'
}

export function resolvePartContainingPdfPage(
  book: BookRecord,
  unit: BookUnitRecord,
  lesson: BookLessonRecord,
  pdfPage: number,
  totalPdfPages: number | null,
): BookLessonPartRecord | null {
  const parts = lesson.parts ?? []
  if (!parts.length) return null
  const bounds = getUnitReaderBounds(unit, totalPdfPages, book)
  const lessons = unit.lessons ?? []
  const lessonIdx = Math.max(0, lessons.findIndex((l) => l.id === lesson.id))
  const lessonRange = pageRangeForIndex(lessons, lessonIdx, bounds.min, bounds.max)

  const { notCountedPdfPages, hiddenPdfPages } = getFileAlignment(book, unit.filePath)
  const runtime = buildPageAlignmentRuntime(totalPdfPages, hiddenPdfPages, notCountedPdfPages)
  const effToPdf = (n: number) => resolveEffectiveAnchorToPdfPage(Math.round(n), runtime) ?? n

  for (let i = 0; i < parts.length; i++) {
    const pr = pageRangeForIndex(parts, i, lessonRange.start, lessonRange.end)
    const part = parts[i]
    const start = pr.start ?? bounds.min
    const end = pr.end ?? pr.start ?? start
    let lo = Math.min(start, end)
    let hi = Math.max(start, end)
    const tocAnchored =
      typeof lesson.startPageHint === 'number' ||
      typeof lesson.endPageHint === 'number' ||
      typeof part?.startPageHint === 'number' ||
      typeof part?.endPageHint === 'number'
    if (tocAnchored) {
      lo = effToPdf(lo)
      hi = effToPdf(hi)
    }
    if (pdfPage >= lo && pdfPage <= hi) return part ?? null
  }
  return null
}

export function resolveLessonAndPartAtPdfPage(
  book: BookRecord,
  unit: BookUnitRecord,
  preferredLessonId: string | null,
  pdfPage: number,
  totalPdfPages: number | null,
): { lesson: BookLessonRecord; part: BookLessonPartRecord } | null {
  const lessons = unit.lessons ?? []
  if (!lessons.length) return null

  const tryLesson = preferredLessonId ? lessons.find((l) => l.id === preferredLessonId) : null
  const ordered: BookLessonRecord[] = []
  if (tryLesson) ordered.push(tryLesson)
  for (const l of lessons) {
    if (!tryLesson || l.id !== tryLesson.id) ordered.push(l)
  }

  for (const lesson of ordered) {
    const part = resolvePartContainingPdfPage(book, unit, lesson, pdfPage, totalPdfPages)
    if (part) return { lesson, part }
  }
  return null
}

/** Hand-authored packs keyed by `interactiveVocabPartKey`. Add rows as you teach more sections. */
export const INTERACTIVE_VOCAB_PACKS: Record<string, InteractiveVocabPack> = {
  'journeys-g3-book-1::unit-3-3e7eaa87::lesson-2d6f0fe0::part-621e469f': {
    partKey: 'journeys-g3-book-1::unit-3-3e7eaa87::lesson-2d6f0fe0::part-621e469f',
    sectionLabel: 'Vocabulary in Context',
    words: [
      {
        id: 'athlete',
        word: 'athlete',
        definition: 'A person who trains and plays a sport.',
        examples: ['Cycling is the favorite sport of this athlete. He raced in the Olympics.'],
      },
      {
        id: 'competitor',
        word: 'competitor',
        definition: 'Someone who tries to win against others in a game or contest.',
        examples: ['Each competitor tries her best to help the team win the game.'],
      },
      {
        id: 'championship',
        word: 'championship',
        definition: 'A big contest to find the best team or player; winning it is a major honor.',
        examples: ['Each player got a medal for winning the championship, or competition.'],
      },
      {
        id: 'professional',
        word: 'professional',
        definition: 'Doing a sport or job for pay, not just for fun.',
        examples: ['Professional basketball players are paid for their work.'],
      },
      {
        id: 'power',
        word: 'power',
        definition: 'Strong force or strength.',
        examples: ['This player uses all his power, or strength, to hit the ball out of the park.'],
      },
      {
        id: 'court',
        word: 'court',
        definition: 'A special playing area for sports like basketball, tennis, or volleyball.',
        examples: ['Basketball, tennis, and volleyball are played on a court, not on a field.'],
      },
      {
        id: 'rooting',
        word: 'rooting',
        definition: 'Cheering loudly for your team so they know you want them to win.',
        examples: ['These students love rooting for their favorite team. They cheer loudly.'],
      },
      {
        id: 'entire',
        word: 'entire',
        definition: 'The whole thing from start to finish; all of it.',
        examples: ['The racer in front led the entire way, from start to finish.'],
      },
    ],
  },
}

export function getInteractiveVocabPackForPartKey(partKey: string): InteractiveVocabPack | null {
  return INTERACTIVE_VOCAB_PACKS[partKey] ?? null
}

/**
 * Saved part-context words override the demo pack when non-empty; otherwise use hardcoded pack.
 */
export function buildInteractiveVocabPack(
  partKey: string,
  sectionLabel: string,
  savedWords: InteractiveVocabWord[] | null | undefined,
  hardcoded: InteractiveVocabPack | null,
): InteractiveVocabPack | null {
  if (savedWords && savedWords.length > 0) {
    return {
      partKey,
      sectionLabel,
      words: savedWords.map((w) => ({
        id: w.id,
        word: w.word,
        definition: w.definition,
        examples: Array.isArray(w.examples) ? w.examples : [],
      })),
    }
  }
  return hardcoded
}

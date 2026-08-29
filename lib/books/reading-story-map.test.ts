import { describe, expect, it } from 'vitest'
import type { BookRecord, BookUnitRecord } from '@/lib/books/types'
import {
  discoverOutlineStories,
  findReadingStoryAtPdfPage,
  getReadingStoryPageStatus,
  isPdfPageInReadingStory,
  lessonIdFromReadingStoryId,
  mergeStoriesForBook,
  parseOutlineReadingStoryId,
  parseManualReadingStoryId,
  isManualReadingStoryId,
  readingStoryManualKey,
  readingStoryPartKey,
  resolveOutlineDisplayRange,
  resolveReadingStoryRange,
  resolveStoryDisplayRangeToPdfPages,
  READING_STORY_SEEDS,
  sanitizeReadingStoryRangeOverride,
} from '@/lib/books/reading-story-map'

const jumpSeed = READING_STORY_SEEDS[0]!

describe('lessonIdFromReadingStoryId', () => {
  it('parses outline story ids and ignores manual', () => {
    expect(lessonIdFromReadingStoryId(jumpSeed.id)).toBe('lesson-2d6f0fe0')
    expect(lessonIdFromReadingStoryId('manual::book::unit::x')).toBeNull()
  })
})

describe('parseOutlineReadingStoryId', () => {
  it('parses outline story keys', () => {
    expect(parseOutlineReadingStoryId(jumpSeed.id)).toEqual({
      bookId: 'journeys-g3-book-1',
      unitId: 'unit-3-3e7eaa87',
      lessonId: 'lesson-2d6f0fe0',
      partId: 'part-ab394f3e',
    })
  })

  it('returns null for manual or short ids', () => {
    expect(parseOutlineReadingStoryId('manual::book::unit::x')).toBeNull()
    expect(parseOutlineReadingStoryId('book::unit')).toBeNull()
  })
})

describe('parseManualReadingStoryId', () => {
  it('parses manual story keys', () => {
    const id = readingStoryManualKey('book-a', 'unit-b', 's123')
    expect(parseManualReadingStoryId(id)).toEqual({
      bookId: 'book-a',
      unitId: 'unit-b',
      localId: 's123',
    })
    expect(isManualReadingStoryId(id)).toBe(true)
  })

  it('returns null for outline ids', () => {
    expect(parseManualReadingStoryId(jumpSeed.id)).toBeNull()
    expect(isManualReadingStoryId(jumpSeed.id)).toBe(false)
  })
})

function makeJumpUnit(): BookUnitRecord {
  return {
    id: 'unit-3-3e7eaa87',
    title: 'Learning Lessons',
    filePath: 'book-library/journeys-g3-book-1/unit-3.pdf',
    startPageHint: 350,
    lessons: [
      {
        id: 'lesson-2d6f0fe0',
        title: 'Lesson 11',
        startPageHint: 362,
        parts: [
          { id: 'part-621e469f', title: 'Vocabulary in Context', startPageHint: 362 },
          { id: 'part-c10071f3', title: 'Comprehension', startPageHint: 365 },
          {
            id: 'part-ab394f3e',
            title: 'Jump! from the Life of Michael Jordan',
            startPageHint: 366,
          },
          { id: 'part-1df276c9', title: 'Your Turn.', startPageHint: 385 },
          {
            id: 'part-9bc3fc39',
            title: 'Science for Sports Fans',
            startPageHint: 386,
          },
          { id: 'part-fd620c10', title: 'Making Connections', startPageHint: 389 },
        ],
      },
    ],
  }
}

function makeBook(unit: BookUnitRecord): BookRecord {
  return {
    id: 'journeys-g3-book-1',
    title: 'Journeys G3',
    units: [unit],
  }
}

describe('reading-story-map', () => {
  it('seeds Jump! with a stable part key', () => {
    expect(jumpSeed.partId).toBe('part-ab394f3e')
    expect(jumpSeed.id).toBe(
      readingStoryPartKey(
        'journeys-g3-book-1',
        'unit-3-3e7eaa87',
        'lesson-2d6f0fe0',
        'part-ab394f3e',
      ),
    )
  })

  it('discoverOutlineStories finds main + paired stories', () => {
    const book = makeBook(makeJumpUnit())
    const found = discoverOutlineStories(book)
    expect(found.some((s) => s.partId === 'part-ab394f3e' && s.kind === 'main_story')).toBe(true)
    expect(found.some((s) => s.partId === 'part-9bc3fc39' && s.kind === 'paired_story')).toBe(true)
    expect(found.some((s) => s.partId === 'part-621e469f')).toBe(false)
  })

  it('mergeStoriesForBook with book does not duplicate Jump! seed', () => {
    const book = makeBook(makeJumpUnit())
    const merged = mergeStoriesForBook(book.id, [], book)
    const jumps = merged.filter((s) => s.id === jumpSeed.id)
    expect(jumps).toHaveLength(1)
    expect(merged.some((s) => s.partId === 'part-9bc3fc39')).toBe(true)
  })

  it('prefills outline display range from sibling starts (366–384)', () => {
    const unit = makeJumpUnit()
    const book = makeBook(unit)
    const lesson = unit.lessons![0]!
    const part = lesson.parts![2]!
    const outline = resolveOutlineDisplayRange(book, unit, lesson, part, 2, 500)
    expect(outline).toEqual({ start: 366, end: 384 })
  })

  it('resolveReadingStoryRange uses outline until override is saved', () => {
    const unit = makeJumpUnit()
    const book = makeBook(unit)
    const range = resolveReadingStoryRange(jumpSeed, book, unit, 500, null)
    expect(range.source).toBe('outline')
    expect(range.startDisplayPage).toBe(366)
    expect(range.endDisplayPage).toBe(384)
    expect(range.rangeConfirmed).toBe(false)
    expect(getReadingStoryPageStatus(range)).toBe('guessed')
    expect(isPdfPageInReadingStory(370, range)).toBe(true)
    expect(isPdfPageInReadingStory(385, range)).toBe(false)
  })

  it('manual override wins and can confirm the range', () => {
    const unit = makeJumpUnit()
    const book = makeBook(unit)
    const override = sanitizeReadingStoryRangeOverride({
      storyId: jumpSeed.id,
      startPage: 366,
      endPage: 380,
      rangeConfirmed: true,
    })
    expect(override).not.toBeNull()
    const range = resolveReadingStoryRange(jumpSeed, book, unit, 500, override)
    expect(range.source).toBe('override')
    expect(range.endDisplayPage).toBe(380)
    expect(range.rangeConfirmed).toBe(true)
    expect(getReadingStoryPageStatus(range)).toBe('confirmed')
    expect(isPdfPageInReadingStory(381, range)).toBe(false)
  })

  it('unconfirmed override does not beat live outline', () => {
    const unit = makeJumpUnit()
    const book = makeBook(unit)
    const override = sanitizeReadingStoryRangeOverride({
      storyId: jumpSeed.id,
      startPage: 1,
      endPage: 2,
      rangeConfirmed: false,
    })
    const range = resolveReadingStoryRange(jumpSeed, book, unit, 500, override)
    expect(range.source).toBe('outline')
    expect(range.startDisplayPage).toBe(366)
    expect(range.endDisplayPage).toBe(384)
  })

  it('findReadingStoryAtPdfPage hits Jump! inside the span', () => {
    const unit = makeJumpUnit()
    const book = makeBook(unit)
    const hit = findReadingStoryAtPdfPage({
      book,
      unit,
      pdfPage: 370,
      totalPdfPages: 500,
      stories: mergeStoriesForBook(book.id, [], book),
      overridesByStoryId: {},
    })
    expect(hit?.story.id).toBe(jumpSeed.id)
    expect(hit?.range.startDisplayPage).toBe(366)
  })

  it('findReadingStoryAtPdfPage hits a story on a sibling unit that shares the PDF', () => {
    const filePath = 'book-library/wonders-g2-workshop/wonders-g2-workshop.pdf'
    const unit1: BookUnitRecord = {
      id: 'unit-1',
      title: 'Friends and Family',
      filePath,
      startPageHint: 16,
      lessons: [],
    }
    const unit2: BookUnitRecord = {
      id: 'unit-2',
      title: 'How on Earth?',
      filePath,
      startPageHint: 400,
      lessons: [],
    }
    const book: BookRecord = {
      id: 'readingwriting-workshop-g2',
      title: 'Workshop',
      units: [unit1, unit2],
    }
    const storyId = readingStoryPartKey(book.id, unit2.id, 'lesson-dive', 'part-dive')
    const story = {
      id: storyId,
      bookId: book.id,
      unitId: unit2.id,
      lessonId: 'lesson-dive',
      partId: 'part-dive',
      title: 'Shared Read Dive Teams',
      kind: 'main_story' as const,
    }
    const hit = findReadingStoryAtPdfPage({
      book,
      unit: unit1,
      pdfPage: 434,
      totalPdfPages: 500,
      stories: [story],
      overridesByStoryId: {
        [storyId]: {
          storyId,
          startPage: 434,
          endPage: 437,
          rangeConfirmed: true,
          updatedAt: '2026-08-19T00:00:00.000Z',
        },
      },
    })
    expect(hit?.story.id).toBe(storyId)
    expect(hit?.range.startDisplayPage).toBe(434)
  })

  it('mergeStoriesForBook adds manual stories from overrides', () => {
    const manualId = 'manual::journeys-g3-book-1::unit-3-3e7eaa87::lit-1'
    const merged = mergeStoriesForBook('journeys-g3-book-1', [
      {
        storyId: manualId,
        bookId: 'journeys-g3-book-1',
        unitId: 'unit-3-3e7eaa87',
        lessonId: null,
        partId: null,
        title: 'Manual anthology story',
        startPage: 10,
        endPage: 20,
        rangeConfirmed: true,
        updatedAt: '2026-08-03T00:00:00.000Z',
      },
    ])
    expect(merged.some((s) => s.id === jumpSeed.id)).toBe(true)
    expect(merged.some((s) => s.id === manualId && s.title === 'Manual anthology story')).toBe(true)
  })

  it('manual story with alignment maps printed pages to PDF (not identity)', () => {
    const unit: BookUnitRecord = {
      id: 'u1',
      title: 'Unit 1',
      filePath: 'book-library/lit/lit.pdf',
      startPageHint: 1,
      lessons: [],
    }
    const book: BookRecord = {
      id: 'lit-book',
      title: 'Literature',
      pageAlignmentByFile: {
        [unit.filePath]: {
          notCountedPdfPages: [2, 3, 4, 5],
          hiddenPdfPages: [1],
        },
      },
      units: [unit],
    }
    const manualId = 'manual::lit-book::u1::s1'
    const override = sanitizeReadingStoryRangeOverride({
      storyId: manualId,
      bookId: book.id,
      unitId: unit.id,
      title: 'Anthology story',
      startPage: 2,
      endPage: 3,
      rangeConfirmed: true,
    })!
    const story = {
      id: manualId,
      bookId: book.id,
      unitId: unit.id,
      lessonId: null,
      partId: null,
      title: 'Anthology story',
      kind: 'manual' as const,
    }
    const range = resolveReadingStoryRange(story, book, unit, 200, override)
    expect(range.source).toBe('override')
    expect(range.startDisplayPage).toBe(2)
    expect(range.endDisplayPage).toBe(3)
    // Printed 2 skips ghost PDF pages 2–5 → lands on PDF 6 (same idea as Journeys).
    expect(range.startPdfPage).toBe(6)
    expect(range.startPdfPage).not.toBe(2)
  })

  it('maps printed story start 14 to PDF 18 with Journeys-style ghosts (not vocab PDF 14)', () => {
    const unit: BookUnitRecord = {
      id: 'u1',
      title: 'Unit 1',
      filePath: 'book-library/journeys-g3-book-1/journeys-g3-book-1.pdf',
      startPageHint: 11,
      lessons: [
        {
          id: 'l1',
          title: 'Lesson 1',
          startPageHint: 10,
          parts: [
            { id: 'pv', title: 'Vocabulary', startPageHint: 10 },
            { id: 'pc', title: 'Comprehension', startPageHint: 13 },
            { id: 'ps', title: 'A Fine, Fine School', startPageHint: 14 },
            { id: 'py', title: 'Your Turn', startPageHint: 33 },
          ],
        },
      ],
    }
    const book: BookRecord = {
      id: 'journeys-g3-book-1',
      title: 'Journeys',
      pageAlignmentByFile: {
        [unit.filePath]: {
          notCountedPdfPages: [2, 3, 10, 11],
          hiddenPdfPages: [1],
        },
      },
      units: [unit],
    }
    const pdf = resolveStoryDisplayRangeToPdfPages(book, unit, 500, 14, 32, { tocAnchored: true })
    expect(pdf.startPdfPage).toBe(18)
    expect(pdf.startPdfPage).not.toBe(14)

    const story = {
      id: readingStoryPartKey(book.id, unit.id, 'l1', 'ps'),
      bookId: book.id,
      unitId: unit.id,
      lessonId: 'l1',
      partId: 'ps',
      title: 'A Fine, Fine School',
    }
    const range = resolveReadingStoryRange(story, book, unit, 500, null)
    expect(range.startDisplayPage).toBe(14)
    expect(range.startPdfPage).toBe(18)
  })
})

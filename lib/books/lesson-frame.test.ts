import { describe, expect, it } from 'vitest'
import {
  formatLessonFrameForPrompt,
  isLessonFrameReady,
  joinLessonFrameTeachingNotes,
  lessonFrameId,
  lessonFrameScannedSectionsLine,
  lessonFrameStatusLabel,
  mergeLessonFrameSection,
  sanitizeLessonFrameRecord,
  seedLessonFramePatchFromSectionTitle,
  splitLessonFrameTeachingNotes,
} from '@/lib/books/lesson-frame'
import {
  LESSON_FRAME_SOURCE_TAGS,
  resolveLessonFramePages,
  resolveLessonFrameSections,
} from '@/lib/books/lesson-frame-pages'
import type { BookRecord, BookUnitRecord } from '@/lib/books/types'

describe('lesson-frame sanitize', () => {
  it('builds a stable id and trims fields', () => {
    const frame = sanitizeLessonFrameRecord({
      bookId: 'journeys-g3-book-1',
      unitId: 'u1',
      lessonId: 'l1',
      comprehensionSkill: '  Cause and Effect  ',
      readingStrategy: 'Ask Questions',
      essentialQuestion: 'Why do people take risks?',
      lessonGoals: ['Practice cause and effect', '', '  '],
      targetVocabulary: ['soar', 'ambition', ''],
      teachingNotes: 'Look for why events happen.',
      sourcePageRange: { startPdfPage: 10, endPdfPage: 12 },
      status: 'draft',
      source: 'gemini',
    })
    expect(frame).not.toBeNull()
    expect(frame!.id).toBe(lessonFrameId('journeys-g3-book-1', 'u1', 'l1'))
    expect(frame!.comprehensionSkill).toBe('Cause and Effect')
    expect(frame!.lessonGoals).toEqual(['Practice cause and effect'])
    expect(frame!.targetVocabulary).toEqual(['soar', 'ambition'])
    expect(isLessonFrameReady(frame)).toBe(false)
    expect(lessonFrameStatusLabel(frame)).toBe('Frame draft')
  })

  it('formats prompt block', () => {
    const frame = sanitizeLessonFrameRecord({
      bookId: 'b',
      unitId: 'u',
      lessonId: 'l',
      comprehensionSkill: 'Cause and Effect',
      readingStrategy: 'Ask Questions',
      essentialQuestion: 'Why?',
      targetVocabulary: ['jump'],
      teachingNotes: 'Note',
      status: 'ready',
    })!
    const block = formatLessonFrameForPrompt(frame)
    expect(block).toContain('Cause and Effect')
    expect(block).toContain('jump')
    expect(isLessonFrameReady(frame)).toBe(true)
    expect(lessonFrameStatusLabel(frame)).toContain('Cause and Effect')
  })
})

describe('resolveLessonFramePages', () => {
  it('unions comprehension and vocab outline parts', () => {
    const book = {
      id: 'journeys-g3-book-1',
      title: 'Journeys G3',
      series: 'Journeys',
      units: [],
    } as BookRecord

    const unit: BookUnitRecord = {
      id: 'u1',
      title: 'Unit 1',
      filePath: 'unit-1.pdf',
      lessons: [
        {
          id: 'l1',
          title: 'Lesson 1',
          startPageHint: 10,
          endPageHint: 40,
          parts: [
            {
              id: 'p-vocab',
              title: 'Vocabulary in Context',
              structureTag: 'vocabulary_in_context',
              startPageHint: 10,
              endPageHint: 12,
            },
            {
              id: 'p-comp',
              title: 'Comprehension',
              structureTag: 'comprehension',
              startPageHint: 13,
              endPageHint: 15,
            },
            {
              id: 'p-story',
              title: 'Jump!',
              structureTag: 'main_story',
              startPageHint: 16,
              endPageHint: 30,
            },
          ],
        },
      ],
    }

    const pages = resolveLessonFramePages(book, unit, 'l1', 500)
    expect(pages).not.toBeNull()
    expect(pages!.source).toBe('outline_parts')
    expect(pages!.startDisplayPage).toBe(10)
    expect(pages!.endDisplayPage).toBe(15)
    expect(pages!.partTitles).toContain('Vocabulary in Context')
    expect(pages!.partTitles).toContain('Comprehension')
    expect(LESSON_FRAME_SOURCE_TAGS).toContain('comprehension')
  })
})

describe('resolveLessonFrameSections', () => {
  it('returns discrete Workshop sections and skips Shared Read pages', () => {
    const book = {
      id: 'readingwriting-workshop-g2',
      title: 'Wonders Grade 2 — Workshop',
      series: 'Wonders',
      role: 'Workshop',
      units: [],
    } as BookRecord

    const unit: BookUnitRecord = {
      id: 'u1',
      title: 'Friends and Family',
      filePath: 'workshop.pdf',
      lessons: [
        {
          id: 'l1',
          title: 'Lesson 1: Friends Help Friends',
          startPageHint: 20,
          parts: [
            {
              id: 'p-vocab',
              title: 'Vocabulary',
              startPageHint: 20,
            },
            {
              id: 'p-story',
              title: 'Shared Read Little Flap Learns to Fly',
              startPageHint: 22,
            },
            {
              id: 'p-strategy',
              title: 'Comprehension Strategy: Visualize',
              startPageHint: 28,
            },
            {
              id: 'p-skill',
              title: 'Comprehension Skill: Key Details.',
              startPageHint: 29,
            },
            {
              id: 'p-genre',
              title: 'Genre: Fantasy',
              startPageHint: 30,
            },
            {
              id: 'p-vstrat',
              title: 'Vocabulary Strategy: Inflectional Endings',
              startPageHint: 31,
            },
            {
              id: 'p-write',
              title: 'Writing: Ideas',
              startPageHint: 32,
            },
          ],
        },
      ],
    }

    const sections = resolveLessonFrameSections(book, unit, 'l1', 500)
    expect(sections.length).toBeGreaterThanOrEqual(4)
    expect(sections.every((s) => s.tag !== 'main_story')).toBe(true)
    expect(sections.some((s) => /shared read/i.test(s.title))).toBe(false)

    for (const s of sections) {
      // Story is display 22–27; no section range may cover those pages.
      const overlapsStory = s.startDisplayPage <= 27 && s.endDisplayPage >= 22
      expect(overlapsStory).toBe(false)
    }

    const titles = sections.map((s) => s.title)
    expect(titles.some((t) => /vocabulary/i.test(t) && !/strategy/i.test(t))).toBe(true)
    expect(titles.some((t) => /comprehension/i.test(t))).toBe(true)
  })

  it('returns one section per tagged Journeys part', () => {
    const book = {
      id: 'journeys-g3-book-1',
      title: 'Journeys G3',
      series: 'Journeys',
      units: [],
    } as BookRecord

    const unit: BookUnitRecord = {
      id: 'u1',
      title: 'Unit 1',
      filePath: 'unit-1.pdf',
      lessons: [
        {
          id: 'l1',
          title: 'Lesson 1',
          startPageHint: 10,
          endPageHint: 40,
          parts: [
            {
              id: 'p-vocab',
              title: 'Vocabulary in Context',
              structureTag: 'vocabulary_in_context',
              startPageHint: 10,
              endPageHint: 12,
            },
            {
              id: 'p-comp',
              title: 'Comprehension',
              structureTag: 'comprehension',
              startPageHint: 13,
              endPageHint: 15,
            },
            {
              id: 'p-story',
              title: 'Jump!',
              structureTag: 'main_story',
              startPageHint: 16,
              endPageHint: 30,
            },
          ],
        },
      ],
    }

    const sections = resolveLessonFrameSections(book, unit, 'l1', 500)
    expect(sections).toHaveLength(2)
    expect(sections[0]!.startDisplayPage).toBe(10)
    expect(sections[0]!.endDisplayPage).toBe(12)
    expect(sections[1]!.startDisplayPage).toBe(13)
    expect(sections[1]!.endDisplayPage).toBe(15)
  })
})

describe('mergeLessonFrameSection', () => {
  it('fills empty fields and unions vocabulary without wiping prior data', () => {
    const first = mergeLessonFrameSection(
      null,
      { targetVocabulary: ['soar', 'ambition'] },
      {
        bookId: 'b',
        unitId: 'u',
        lessonId: 'l',
        startPdfPage: 20,
        endPdfPage: 21,
        startDisplayPage: 20,
        endDisplayPage: 21,
        source: 'pdf',
        sectionTitle: 'Vocabulary',
        sectionTag: 'vocabulary_in_context',
      },
    )!
    expect(first.targetVocabulary).toEqual(['soar', 'ambition'])
    expect(first.comprehensionSkill).toBe('')

    const second = mergeLessonFrameSection(
      first,
      {
        comprehensionSkill: 'Key Details',
        readingStrategy: 'Visualize',
        targetVocabulary: ['ambition', 'peer'],
      },
      {
        bookId: 'b',
        unitId: 'u',
        lessonId: 'l',
        startPdfPage: 28,
        endPdfPage: 29,
        startDisplayPage: 28,
        endDisplayPage: 29,
        source: 'gemini',
        sectionTitle: 'Comprehension Skill: Key Details.',
        sectionTag: 'comprehension',
      },
    )!
    expect(second.comprehensionSkill).toBe('Key Details')
    expect(second.readingStrategy).toBe('Visualize')
    expect(second.targetVocabulary).toEqual(['soar', 'ambition', 'peer'])
    expect(second.sourcePageRange.startPdfPage).toBe(20)
    expect(second.sourcePageRange.endPdfPage).toBe(29)
    expect(second.startDisplayPage).toBe(20)
    expect(second.endDisplayPage).toBe(29)
    expect(second.scannedSections?.map((s) => s.title)).toEqual([
      'Vocabulary',
      'Comprehension Skill: Key Details.',
    ])

    const third = mergeLessonFrameSection(
      second,
      { comprehensionSkill: 'Main Idea' },
      {
        bookId: 'b',
        unitId: 'u',
        lessonId: 'l',
        startPdfPage: 30,
        endPdfPage: 30,
        startDisplayPage: 30,
        endDisplayPage: 30,
      },
    )!
    expect(third.comprehensionSkill).toBe('Key Details')
  })
})

describe('seedLessonFramePatchFromSectionTitle', () => {
  it('parses Workshop skill and strategy titles', () => {
    expect(seedLessonFramePatchFromSectionTitle('Comprehension Skill: Key Details.')).toEqual({
      comprehensionSkill: 'Key Details',
    })
    expect(seedLessonFramePatchFromSectionTitle('Comprehension Strategy: Visualize')).toEqual({
      readingStrategy: 'Visualize',
    })
    expect(seedLessonFramePatchFromSectionTitle('Genre: Fantasy').teachingNotes).toContain('Fantasy')
  })
})

describe('lessonFrameScannedSectionsLine', () => {
  it('formats discrete section labels', () => {
    const frame = sanitizeLessonFrameRecord({
      bookId: 'b',
      unitId: 'u',
      lessonId: 'l',
      comprehensionSkill: 'Key Details',
      scannedSections: [
        {
          title: 'Vocabulary',
          tag: 'vocabulary_in_context',
          startDisplayPage: 20,
          endDisplayPage: 21,
        },
        {
          title: 'Comprehension Skill: Key Details.',
          tag: 'comprehension',
          startDisplayPage: 29,
          endDisplayPage: 29,
        },
      ],
    })!
    expect(lessonFrameScannedSectionsLine(frame)).toBe('Vocab p20–21 · Skill p29')
  })
})

describe('splitLessonFrameTeachingNotes', () => {
  it('pulls Genre and Vocab strategy out of notes', () => {
    const split = splitLessonFrameTeachingNotes(
      'Vocabulary strategy: Inflectional Endings\n\nGenre: Fantasy\n\nExtra tip.',
    )
    expect(split.vocabularyStrategy).toBe('Inflectional Endings')
    expect(split.genre).toBe('Fantasy')
    expect(split.other).toBe('Extra tip.')
    expect(
      joinLessonFrameTeachingNotes({
        genre: 'Fantasy',
        vocabularyStrategy: 'Inflectional Endings',
        other: 'Extra tip.',
      }),
    ).toContain('Genre: Fantasy')
  })
})

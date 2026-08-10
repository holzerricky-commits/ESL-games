import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/gemini', () => ({
  resolveGeminiApiKey: vi.fn(async () => null),
}))

import { normalizeTocV2ToDrafts } from '@/lib/books/gemini-toc-v2'

describe('normalizeTocV2ToDrafts', () => {
  it('maps lessons and unit ranges from printed pages', () => {
    const parsed = {
      units: [
        {
          unitNumber: 1,
          title: 'Good Citizens',
          lessons: [
            {
              lessonNumber: 1,
              title: 'Lesson 1',
              entries: [
                { title: 'Vocabulary in Context', startPrintedPage: 10 },
                { title: 'Comprehension', startPrintedPage: 13 },
              ],
            },
          ],
          specialSections: [
            { title: 'READING POWER', startPrintedPage: 182 },
            { title: 'Unit Wrap-Up', startPrintedPage: 184 },
          ],
        },
        {
          unitNumber: 2,
          title: 'Express Yourself',
          lessons: [
            {
              lessonNumber: 6,
              title: 'Lesson 6',
              entries: [{ title: 'Vocabulary in Context', startPrintedPage: 186 }],
            },
          ],
          specialSections: [],
        },
      ],
    }
    const out = normalizeTocV2ToDrafts(parsed)
    expect(out.drafts).toHaveLength(2)
    expect(out.drafts[0]?.title).toBe('Good Citizens')
    expect(out.drafts[0]?.startPageHint).toBe(10)
    expect(out.drafts[0]?.endPageHint).toBe(185)
    expect(out.lessonsByUnit[0]?.[0]?.startPageHint).toBe(10)
    expect(out.lessonsByUnit[0]?.[1]?.title).toBe('READING POWER')
    expect(out.lessonsByUnit[0]?.[2]?.title).toBe('Unit Wrap-Up')
    expect(out.lessonsByUnit[0]?.[2]?.endPageHint).toBe(out.lessonsByUnit[0]?.[2]?.startPageHint)
  })

  it('infers glossary start from final wrap-up when missing', () => {
    const parsed = {
      units: [
        {
          title: 'Learning Lessons',
          lessons: [
            {
              lessonNumber: 15,
              title: 'Lesson 15',
              entries: [{ title: 'Vocabulary in Context', startPrintedPage: 486 }],
            },
          ],
          specialSections: [
            { title: 'Unit Wrap-Up', startPrintedPage: 520 },
            { title: 'Glossary', startPrintedPage: null },
          ],
        },
      ],
    }
    const out = normalizeTocV2ToDrafts(parsed)
    const specialLessons = out.lessonsByUnit[0] ?? []
    const wrap = specialLessons.find((lesson) => /wrap/i.test(lesson.title))
    const glossary = specialLessons.find((lesson) => /glossary/i.test(lesson.title))
    expect(wrap?.startPageHint).toBeTruthy()
    expect(glossary?.startPageHint).toBe((wrap?.startPageHint ?? 0) + 1)
  })

  it('labels Wonders Workshop weeks and tags Pedal Power-style parts', () => {
    const parsed = {
      units: [
        {
          unitNumber: 6,
          title: 'How on Earth?',
          lessons: [
            {
              lessonNumber: 2,
              title: 'Pedal Power',
              entries: [
                { title: 'Vocabulary', startPrintedPage: 418 },
                { title: 'Pedal Power', startPrintedPage: 420 },
                { title: 'Comprehension Strategy: Reread', startPrintedPage: 424 },
                { title: "Comprehension Skill: Author's Purpose", startPrintedPage: 425 },
                { title: 'Genre: Expository Text', startPrintedPage: 426 },
                { title: 'Vocabulary Strategy: Paragraph Clues', startPrintedPage: 427 },
                { title: 'Writing: Word Choice', startPrintedPage: 428 },
              ],
            },
          ],
          specialSections: [{ title: 'Grammar Handbook', startPrintedPage: 472 }],
        },
      ],
    }
    const out = normalizeTocV2ToDrafts(parsed, 'wonders_workshop')
    const week = out.lessonsByUnit[0]?.[0]
    expect(week?.title).toBe('Week 2: Pedal Power')
    expect(week?.parts?.map((p) => p.structureTag)).toEqual([
      'vocabulary_in_context',
      'main_story',
      'comprehension',
      'comprehension',
      'genre',
      'vocabulary_strategy',
      'writing_narrate',
    ])
    expect(out.lessonsByUnit[0]?.[1]?.title).toBe('Grammar Handbook')
  })

  it('labels Wonders Literature weeks with anchor + paired tags', () => {
    const parsed = {
      units: [
        {
          unitNumber: 6,
          title: 'How on Earth?',
          lessons: [
            {
              lessonNumber: 2,
              title: 'Pedal Power',
              entries: [
                { title: 'My Light', startPrintedPage: 514 },
                { title: 'The Power of Water', startPrintedPage: 534 },
              ],
            },
            {
              lessonNumber: 3,
              title: 'Next Week',
              entries: [
                { title: 'Story Three', startPrintedPage: 548 },
                { title: 'Story Four', startPrintedPage: 560 },
              ],
            },
          ],
          specialSections: [],
        },
      ],
    }
    const out = normalizeTocV2ToDrafts(parsed, 'wonders_literature')
    const week = out.lessonsByUnit[0]?.[0]
    expect(week?.title).toBe('Week 2: Pedal Power')
    // Only between stories: Story → Respond → Story (paired runs to week end).
    expect(week?.parts?.map((p) => ({ tag: p.structureTag, start: p.startPageHint, end: p.endPageHint }))).toEqual([
      { tag: 'main_story', start: 514, end: 531 },
      { tag: 'your_turn', start: 532, end: 533 },
      { tag: 'paired_story', start: 534, end: 547 },
    ])
    expect(week?.parts?.[1]?.title).toBe('Respond to the Text')
  })

  it('does not add Respond after the paired story when the next page is a new week', () => {
    const parsed = {
      units: [
        {
          unitNumber: 1,
          title: 'Unit One',
          lessons: [
            {
              lessonNumber: 1,
              title: 'Week Theme',
              entries: [
                { title: 'Anchor Tale', startPrintedPage: 10 },
                { title: 'Paired Tale', startPrintedPage: 20 },
              ],
            },
          ],
          specialSections: [],
        },
        {
          unitNumber: 2,
          title: 'Unit Two',
          lessons: [
            {
              lessonNumber: 1,
              title: 'Later',
              entries: [{ title: 'Later Story', startPrintedPage: 40 }],
            },
          ],
          specialSections: [],
        },
      ],
    }
    const out = normalizeTocV2ToDrafts(parsed, 'wonders_literature')
    const week = out.lessonsByUnit[0]?.[0]
    expect(week?.parts?.map((p) => p.structureTag)).toEqual([
      'main_story',
      'your_turn',
      'paired_story',
    ])
    expect(week?.parts?.[2]?.startPageHint).toBe(20)
    expect(week?.parts?.[2]?.endPageHint).toBe(39)
  })

  it('does not double-trim Literature story when Respond already bounds the range', () => {
    const parsed = {
      units: [
        {
          unitNumber: 6,
          title: 'How on Earth?',
          lessons: [
            {
              lessonNumber: 2,
              title: 'Pedal Power',
              entries: [
                { title: 'My Light', startPrintedPage: 514 },
                { title: 'Respond to the Text', startPrintedPage: 533 },
                { title: 'The Power of Water', startPrintedPage: 534 },
              ],
            },
            {
              lessonNumber: 3,
              title: 'Next Week',
              entries: [{ title: 'Later', startPrintedPage: 548 }],
            },
          ],
          specialSections: [],
        },
      ],
    }
    const out = normalizeTocV2ToDrafts(parsed, 'wonders_literature')
    const week = out.lessonsByUnit[0]?.[0]
    expect(week?.parts?.map((p) => p.structureTag)).toEqual([
      'main_story',
      'your_turn',
      'paired_story',
    ])
    expect(week?.parts?.[0]?.endPageHint).toBe(532)
    expect(week?.parts?.[1]?.startPageHint).toBe(533)
    expect(week?.parts?.[2]?.endPageHint).toBe(547)
  })
})

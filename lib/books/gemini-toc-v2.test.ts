import { describe, expect, it } from 'vitest'
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
})

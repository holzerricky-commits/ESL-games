import { describe, expect, it } from 'vitest'
import {
  analyzeStoryForCheckDraft,
  buildTaggedStoryExcerpt,
  formatReadingCheckDraftPlanForPrompt,
  targetCheckRangeForTextPageCount,
} from '@/lib/books/reading-check-draft-plan'
import { READING_STORY_ILLUSTRATION_ONLY_PLACEHOLDER } from '@/lib/books/reading-story-page-markers'

describe('targetCheckRangeForTextPageCount', () => {
  it('scales check budget with story length', () => {
    expect(targetCheckRangeForTextPageCount(4)).toEqual({ min: 2, max: 4 })
    expect(targetCheckRangeForTextPageCount(10)).toEqual({ min: 4, max: 8 })
    expect(targetCheckRangeForTextPageCount(18)).toEqual({ min: 6, max: 12 })
  })
})

describe('analyzeStoryForCheckDraft', () => {
  const denseParagraph =
    'Mr. Keene was a principal who loved his school. Every morning he strolled down the hallway and saw the children in their classes. He saw them learning shapes and colors and numbers and letters. He saw them reading and writing and drawing and painting. He saw them making dinosaurs and forts and pyramids. Oh he would say. Arent these fine children? Arent these fine teachers? Isnt this a fine fine school?'

  it('counts text vs illustration pages and flags dense spreads', () => {
    const story = buildTaggedStoryExcerpt([
      { displayPage: 18, pdfPage: 20, text: 'A FINE, FINE SCHOOL by Sharon Creech' },
      { displayPage: 20, pdfPage: 22, text: denseParagraph },
      { displayPage: 22, pdfPage: 24, text: READING_STORY_ILLUSTRATION_ONLY_PLACEHOLDER },
      { displayPage: 23, pdfPage: 25, text: 'Tillie lived with her parents and her dog Beans.' },
    ])

    const plan = analyzeStoryForCheckDraft(story, { denseWordThreshold: 50 })
    expect(plan.textPageCount).toBe(3)
    expect(plan.illustrationPageCount).toBe(1)
    expect(plan.densePages).toHaveLength(1)
    expect(plan.densePages[0]?.displayPage).toBe(20)
    expect(plan.targetMinChecks).toBe(2)
    expect(plan.targetMaxChecks).toBe(4)
    expect(plan.pageBriefs.some((b) => b.includes('illustration only'))).toBe(true)
    expect(plan.pageBriefs.some((b) => b.includes('dense'))).toBe(true)
  })

  it('formats a prompt block with dense page labels', () => {
    const story = buildTaggedStoryExcerpt([
      { displayPage: 20, pdfPage: 22, text: denseParagraph },
    ])
    const plan = analyzeStoryForCheckDraft(story, { denseWordThreshold: 50 })
    const block = formatReadingCheckDraftPlanForPrompt(plan)
    expect(block).toContain('target')
    expect(block).toContain('Dense pages: p20')
    expect(block).toContain('Page briefs:')
  })

  it('treats paste-only text as one page when no markers', () => {
    const plan = analyzeStoryForCheckDraft('Once upon a time there was a fox.')
    expect(plan.textPageCount).toBe(1)
    expect(plan.targetMinChecks).toBe(2)
  })
})

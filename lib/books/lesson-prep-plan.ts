import { readingCheckPackCanApprove, type ReadingCheckPack } from '@/lib/books/reading-check-pack'
import type { ReadingStoryPdfRange } from '@/lib/books/reading-story-map'
import { storyTextScanCanContinue } from '@/lib/books/reading-story-page-markers'
import { readingStoryTextStatus, type ReadingStoryTextRecord } from '@/lib/books/reading-story-text'

export type LessonPrepPagesAction = 'confirm' | 'skip' | 'missing'
export type LessonPrepTextAction = 'full' | 'continue' | 'skip'
export type LessonPrepChecksAction = 'generate' | 'skip-approved' | 'skip-draft' | 'blocked'

export interface LessonPrepPartInput {
  range: ReadingStoryPdfRange
  text: ReadingStoryTextRecord | null
}

export interface LessonPrepPartPlan {
  pages: LessonPrepPagesAction
  /** Null when pages are missing (nothing else runs for this part). */
  text: LessonPrepTextAction | null
}

export function storyTextIsComplete(text: ReadingStoryTextRecord | null | undefined): boolean {
  if (!text || readingStoryTextStatus(text.text) !== 'ready') return false
  return !storyTextScanCanContinue({
    text: text.text,
    startPdfPage: text.startPdfPage,
    endPdfPage: text.endPdfPage,
  })
}

/** What the pages and text steps should do for one story part before anything runs. */
export function planLessonPrepPart(input: LessonPrepPartInput): LessonPrepPartPlan {
  if (input.range.source === 'none') return { pages: 'missing', text: null }
  const pages: LessonPrepPagesAction = input.range.rangeConfirmed ? 'skip' : 'confirm'
  const { text } = input
  if (storyTextIsComplete(text)) return { pages, text: 'skip' }
  if (text && readingStoryTextStatus(text.text) === 'ready') return { pages, text: 'continue' }
  return { pages, text: 'full' }
}

/**
 * Checks step, decided after the text step. Never overwrites an approved pack
 * or a draft that already has questions.
 */
export function decideLessonPrepChecks(args: {
  pack: ReadingCheckPack | null | undefined
  textComplete: boolean
}): LessonPrepChecksAction {
  const { pack, textComplete } = args
  if (pack?.status === 'approved') return 'skip-approved'
  if (pack && readingCheckPackCanApprove(pack)) return 'skip-draft'
  if (!textComplete) return 'blocked'
  return 'generate'
}

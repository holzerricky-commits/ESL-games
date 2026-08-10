import { describe, expect, it } from 'vitest'
import {
  approveReadingCheckPack,
  createEmptyReadingCheckPack,
  createEmptyReadingCheckStop,
} from '@/lib/books/reading-check-pack'
import type { ReadingStoryMap } from '@/lib/books/reading-story-map'
import {
  pickReadingStoryForPrepareGlance,
  resolveReadingCheckPrepareGlance,
} from '@/lib/books/reading-check-prepare-glance'

describe('reading-check-prepare-glance', () => {
  it('formats None / Needs review / approved', () => {
    expect(resolveReadingCheckPrepareGlance(null).label).toBe('Reading checks: None')

    const empty = createEmptyReadingCheckPack({ storyId: 's', bookId: 'b', unitId: 'u' })
    expect(resolveReadingCheckPrepareGlance(empty).kind).toBe('none')

    const draft: typeof empty = {
      ...empty,
      stops: [
        {
          ...createEmptyReadingCheckStop(1),
          label: 'Beat 1',
          questions: [
            {
              id: 'q1',
              kind: 'true_false',
              prompt: 'Did they jump?',
              choices: [],
              correctIndex: null,
              correctTrue: true,
              evidenceSnippet: null,
              evidenceHighlight: null,
            },
          ],
        },
      ],
    }
    expect(resolveReadingCheckPrepareGlance(draft)).toEqual({
      kind: 'needs_review',
      label: 'Reading checks: Needs review (1)',
      stopCount: 1,
    })

    const approved = approveReadingCheckPack(draft)!
    expect(resolveReadingCheckPrepareGlance(approved)).toEqual({
      kind: 'approved',
      label: 'Reading checks: approved (1)',
      stopCount: 1,
    })
  })

  it('picks story by part, then lesson main, then unit main', () => {
    const stories: ReadingStoryMap[] = [
      {
        id: 'a',
        bookId: 'b',
        unitId: 'u',
        lessonId: 'l1',
        partId: 'p1',
        title: 'Paired',
        kind: 'paired_story',
      },
      {
        id: 'b-main',
        bookId: 'b',
        unitId: 'u',
        lessonId: 'l1',
        partId: 'p2',
        title: 'Main',
        kind: 'main_story',
      },
      {
        id: 'other',
        bookId: 'b',
        unitId: 'u2',
        lessonId: 'l9',
        partId: 'p9',
        title: 'Elsewhere',
        kind: 'main_story',
      },
    ]

    expect(
      pickReadingStoryForPrepareGlance({
        stories,
        bookId: 'b',
        unitId: 'u',
        partId: 'p1',
      })?.id,
    ).toBe('a')

    expect(
      pickReadingStoryForPrepareGlance({
        stories,
        bookId: 'b',
        unitId: 'u',
        lessonId: 'l1',
      })?.id,
    ).toBe('b-main')

    expect(
      pickReadingStoryForPrepareGlance({
        stories,
        bookId: 'b',
        unitId: 'u',
      })?.id,
    ).toBe('b-main')

    expect(
      pickReadingStoryForPrepareGlance({
        stories,
        bookId: 'b',
        unitId: 'missing',
      }),
    ).toBeNull()
  })
})

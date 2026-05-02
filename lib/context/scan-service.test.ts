import { afterEach, describe, expect, it, vi } from 'vitest'
import { scanLessonContext, scanUnitContext } from '@/lib/context/scan-service'

describe('context scan service', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.GEMINI_API_KEY
  })

  it('returns fallback unit context when model unavailable', async () => {
    const result = await scanUnitContext({
      bookId: 'book-1',
      unitId: 'unit-1',
      sourcePageRange: { startPage: 1, endPage: 3 },
      sectionSummary: 'community helpers and good citizens',
    })
    expect(result.kind).toBe('unit')
    expect(result.theme.length).toBeGreaterThan(0)
  })

  it('parses lesson context json from model', async () => {
    process.env.GEMINI_API_KEY = 'fake-key'
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      textType: 'story',
                      lessonGoals: ['identify setting', 'describe characters'],
                      comprehensionSkill: 'story structure',
                      strategy: 'compare and contrast',
                      essentialQuestions: ['What makes a strong community?'],
                      languageFocus: {
                        grammarNotes: ['subjects and predicates'],
                        writingNotes: ['narrative details'],
                      },
                    }),
                  },
                ],
              },
            },
          ],
        }),
      })),
    )

    const result = await scanLessonContext({
      bookId: 'book-1',
      unitId: 'unit-1',
      lessonId: 'lesson-1',
      sourcePageRange: { startPage: 4, endPage: 10 },
    })
    expect(result.comprehensionSkill).toBe('story structure')
    expect(result.languageFocus.grammarNotes[0]).toBe('subjects and predicates')
  })
})

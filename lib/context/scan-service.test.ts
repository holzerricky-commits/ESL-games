import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveGeminiApiKey } from '@/lib/gemini'
import { scanLessonContext, scanUnitContext } from '@/lib/context/scan-service'

vi.mock('@/lib/gemini', () => ({
  resolveGeminiApiKey: vi.fn(),
}))

describe('context scan service', () => {
  beforeEach(() => {
    vi.mocked(resolveGeminiApiKey).mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.GEMINI_API_KEY
  })

  it('marks unit context as fallback when model unavailable', async () => {
    vi.mocked(resolveGeminiApiKey).mockResolvedValue(null)
    const result = await scanUnitContext({
      bookId: 'book-1',
      unitId: 'unit-1',
      sourcePageRange: { startPage: 1, endPage: 3 },
      sectionSummary: 'community helpers and good citizens',
    })
    expect(result.source).toBe('fallback')
    expect(result.record.kind).toBe('unit')
    expect(result.record.theme.length).toBeGreaterThan(0)
  })

  it('marks empty model JSON as fallback so it is not saved', async () => {
    vi.mocked(resolveGeminiApiKey).mockResolvedValue('fake-key')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '{}' }] } }],
        }),
      })),
    )

    const result = await scanUnitContext({
      bookId: 'book-1',
      unitId: 'unit-1',
      sourcePageRange: { startPage: 1, endPage: 3 },
    })
    expect(result.source).toBe('fallback')
  })

  it('parses lesson context json from model', async () => {
    vi.mocked(resolveGeminiApiKey).mockResolvedValue('fake-key')
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
    expect(result.source).toBe('model')
    expect(result.record.comprehensionSkill).toBe('story structure')
    expect(result.record.languageFocus.grammarNotes[0]).toBe('subjects and predicates')
  })
})

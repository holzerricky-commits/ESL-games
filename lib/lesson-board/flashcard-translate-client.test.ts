import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  fetchFlashcardTranslation,
  fetchFlashcardTranslationWithAlternatives,
  flashcardMeaningLabel,
  flashcardMeaningOptions,
  formatFlashcardChineseLine,
  parseFlashcardChineseLineParts,
} from '@/lib/lesson-board/flashcard-translate-client'

describe('flashcard-translate-client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('formatFlashcardChineseLine includes pinyin when present', () => {
    expect(formatFlashcardChineseLine({ chinese: '苍蝇', pinyin: 'cāng yíng' })).toBe(
      '苍蝇 (cāng yíng)',
    )
    expect(formatFlashcardChineseLine({ chinese: '苹果', pinyin: '' })).toBe('苹果')
  })

  it('formatFlashcardChineseLine hides pinyin when showPinyin is false', () => {
    expect(
      formatFlashcardChineseLine({ chinese: '苍蝇', pinyin: 'cāng yíng' }, { showPinyin: false }),
    ).toBe('苍蝇')
  })

  it('flashcardMeaningLabel appends part of speech when present', () => {
    expect(
      flashcardMeaningLabel({ chinese: '飞', pinyin: 'fēi', partOfSpeech: 'verb' }),
    ).toBe('飞 (fēi) — verb')
  })

  it('fetchFlashcardTranslation returns null on failure', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ ok: false, error: 'nope' }),
    } as Response)
    await expect(fetchFlashcardTranslation('fly')).resolves.toBeNull()
  })

  it('fetchFlashcardTranslation maps a successful response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        chinese: '苍蝇',
        pinyin: 'cāng yíng',
        alternatives: [],
      }),
    } as Response)

    await expect(fetchFlashcardTranslation('fly')).resolves.toEqual({
      chinese: '苍蝇',
      pinyin: 'cāng yíng',
    })
    expect(fetch).toHaveBeenCalledWith(
      '/api/translate',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ text: 'fly' }),
      }),
    )
  })

  it('fetchFlashcardTranslationWithAlternatives passes context hint', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        chinese: '银行',
        pinyin: 'yín háng',
        alternatives: [],
      }),
    } as Response)

    await fetchFlashcardTranslationWithAlternatives('bank', 'river water')
    expect(fetch).toHaveBeenCalledWith(
      '/api/translate',
      expect.objectContaining({
        body: JSON.stringify({ text: 'bank', context: 'river water' }),
      }),
    )
  })

  it('flashcardMeaningOptions dedupes primary and alternatives', () => {
    const options = flashcardMeaningOptions({
      primary: { chinese: '苍蝇', pinyin: 'cāng yíng' },
      alternatives: [
        { chinese: '苍蝇', pinyin: 'cāng yíng' },
        { chinese: '飞', pinyin: 'fēi', partOfSpeech: 'verb' },
      ],
    })
    expect(options).toHaveLength(2)
    expect(options[1]?.chinese).toBe('飞')
  })

  it('parseFlashcardChineseLineParts splits chinese and pinyin', () => {
    expect(parseFlashcardChineseLineParts('苍蝇 (cāng yíng)')).toEqual({
      chinese: '苍蝇',
      pinyin: 'cāng yíng',
    })
    expect(parseFlashcardChineseLineParts('苹果')).toEqual({ chinese: '苹果', pinyin: '' })
    expect(parseFlashcardChineseLineParts('…')).toBeNull()
  })
})

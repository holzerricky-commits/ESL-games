import { describe, expect, it } from 'vitest'
import {
  buildStaticSearchQuery,
  buildGifSearchQuery,
  buildTranslateImagePhraseContexts,
  buildTranslateImageSearchHint,
} from '@/lib/quiz-image-queries'

describe('buildTranslateImageSearchHint', () => {
  it('keeps river sense words for bank', () => {
    const hint = buildTranslateImageSearchHint(
      'bank',
      'The children played by the river bank.',
    )
    expect(hint).toContain('bank')
    expect(hint).toContain('river')
    expect(hint).not.toContain('the')
  })

  it('returns undefined when the example adds no extra words', () => {
    expect(buildTranslateImageSearchHint('happy', 'He is happy.')).toBeUndefined()
  })
})

describe('buildTranslateImagePhraseContexts', () => {
  it('passes the thin example so the phrase API can use word + sentence', () => {
    expect(buildTranslateImagePhraseContexts('happy', 'He is happy.')).toEqual({
      happy: 'He is happy.',
    })
  })

  it('skips empty or tiny examples', () => {
    expect(buildTranslateImagePhraseContexts('happy', '')).toBeUndefined()
    expect(buildTranslateImagePhraseContexts('happy', 'ok')).toBeUndefined()
  })
})

describe('buildStaticSearchQuery', () => {
  it('lets an explicit hint beat the curated bank building phrase', () => {
    const withHint = buildStaticSearchQuery('bank', {
      imageSearchQuery: 'bank river isolated stock photo',
    })
    expect(withHint).toContain('river')
    expect(withHint).not.toContain('finance')
  })

  it('uses the curated bank phrase when no hint is passed', () => {
    expect(buildStaticSearchQuery('bank')).toContain('finance')
  })

  it('keeps the lemma when a hint omits it', () => {
    const q = buildStaticSearchQuery('bank', {
      imageSearchQuery: 'river water',
    })
    expect(q.toLowerCase()).toContain('bank')
    expect(q.toLowerCase()).toContain('river')
  })

  it('does not map underwater to a glass of water', () => {
    const q = buildStaticSearchQuery('underwater')
    expect(q.toLowerCase()).toContain('underwater')
    expect(q.toLowerCase()).not.toContain('glass of water')
  })
})

describe('buildGifSearchQuery', () => {
  it('prefers a hint that includes the lemma over the curated map', () => {
    const q = buildGifSearchQuery('apple', {
      imageSearchQuery: 'apple dancing cartoon',
    })
    expect(q.toLowerCase()).toContain('apple')
    expect(q.toLowerCase()).toContain('dancing')
  })

  it('prepends the lemma when a hint omits it', () => {
    const q = buildGifSearchQuery('apple', {
      imageSearchQuery: 'dancing cartoon',
    })
    expect(q.toLowerCase()).toContain('apple')
    expect(q.toLowerCase()).toContain('dancing')
  })
})

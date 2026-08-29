import { describe, expect, it } from 'vitest'
import {
  buildStaticSearchQuery,
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
})

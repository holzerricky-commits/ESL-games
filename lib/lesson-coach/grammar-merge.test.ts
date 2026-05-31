import { describe, expect, it } from 'vitest'
import { deepDraftsToIssues, locateMatchInText, mergeGrammarIssues } from '@/lib/lesson-coach/grammar-merge'
import { analyzeText } from '@/lib/lesson-coach/grammar-lite'

describe('grammar-merge', () => {
  it('locates article mistake in text', () => {
    const text = 'I saw a elephant yesterday'
    const loc = locateMatchInText(text, 'a elephant')
    expect(loc).toEqual({ start: 6, end: 16 })
  })

  it('merges lite and deep without duplicate spans', () => {
    const text = 'I saw a elephant'
    const lite = analyzeText(text)
    const deep = deepDraftsToIssues(text, [
      {
        match: 'a elephant',
        type: 'article',
        message: 'Use an before vowel sounds',
        suggestion: 'an elephant',
      },
    ])
    const merged = mergeGrammarIssues(lite, deep)
    const articleIssues = merged.filter((i) => i.type.includes('article'))
    expect(articleIssues.length).toBe(1)
  })

  it('flags an before consonant in lite', () => {
    const issues = analyzeText('I have an book')
    expect(issues.some((i) => i.type === 'article-a')).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { analyzeText, grammarCheckPatch } from '@/lib/lesson-coach/grammar-lite'

describe('grammar-lite', () => {
  it('flags third-person verb: he go to school', () => {
    const issues = analyzeText('he go to school')
    expect(issues.length).toBeGreaterThanOrEqual(1)
    expect(issues.some((i) => i.type === 'third-person-verb')).toBe(true)
  })

  it('flags lone i', () => {
    const issues = analyzeText('well i like cats')
    expect(issues.some((i) => i.type === 'pronoun-i')).toBe(true)
  })

  it('flags missing space after period', () => {
    const issues = analyzeText('Hello.World')
    expect(issues.some((i) => i.type === 'punctuation-space')).toBe(true)
  })

  it('flags uncapitalized sentence starts', () => {
    const issues = analyzeText('hello. world')
    expect(issues.some((i) => i.type === 'capitalization')).toBe(true)
  })

  it('flags a before vowel', () => {
    const issues = analyzeText('I saw a elephant')
    expect(issues.some((i) => i.type === 'article-an')).toBe(true)
  })

  it('flags double spaces', () => {
    const issues = analyzeText('too  many')
    expect(issues.some((i) => i.type === 'double-space')).toBe(true)
  })

  it('returns empty for blank text', () => {
    expect(analyzeText('   ')).toEqual([])
  })

  it('grammarCheckPatch sets issueCount', () => {
    const patch = grammarCheckPatch('he go to school')
    expect(patch.issueCount).toBe(patch.issues.length)
    expect(patch.issueCount).toBeGreaterThanOrEqual(1)
    expect(patch.revealedCount).toBe(0)
  })
})

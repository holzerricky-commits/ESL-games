import { describe, expect, it } from 'vitest'
import { analyzeText } from '@/lib/lesson-coach/grammar-lite'
import {
  applyActiveFix,
  applySuggestionToText,
  getActiveRevealIssue,
  highlightNextIssue,
  showFixForActive,
} from '@/lib/lesson-coach/issue-reveal'

describe('issue-reveal', () => {
  it('highlights one issue at a time', () => {
    const issues = analyzeText('he go to school')
    const first = highlightNextIssue(issues)
    const firstActive = getActiveRevealIssue(first)!
    expect(firstActive.status).toBe('highlighted')
    const firstIdx = first.findIndex((i) => i.id === firstActive.id)
    const second = highlightNextIssue(first, firstIdx)
    const secondActive = getActiveRevealIssue(second)!
    expect(secondActive.id).not.toBe(firstActive.id)
  })

  it('reveals fix for highlighted issue', () => {
    const issues = analyzeText('he go to school')
    const highlighted = highlightNextIssue(issues)
    const revealed = showFixForActive(highlighted)
    expect(getActiveRevealIssue(revealed)?.status).toBe('revealed')
  })

  it('applies suggestion to text', () => {
    const text = 'he go to school'
    const analyzed = analyzeText(text)
    const verb = analyzed.find((i) => i.type === 'third-person-verb')!
    const issues = analyzed.map((i) =>
      i.id === verb.id ? { ...i, status: 'revealed' as const } : i,
    )
    const next = applySuggestionToText(text, verb)
    expect(next).toContain('gos')
    expect(next).not.toBe(text)
  })

  it('applyActiveFix marks issue applied and updates text', () => {
    const text = 'he go to school'
    const analyzed = analyzeText(text)
    const verb = analyzed.find((i) => i.type === 'third-person-verb')!
    const issues = analyzed.map((i) =>
      i.id === verb.id ? { ...i, status: 'revealed' as const } : i,
    )
    const result = applyActiveFix(text, issues)
    expect(result).not.toBeNull()
    expect(result!.sharedText).toContain('gos')
    expect(result!.issues.some((i) => i.status === 'applied')).toBe(true)
  })
})

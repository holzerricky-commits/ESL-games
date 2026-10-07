import { describe, expect, it } from 'vitest'
import { applyStyleToStaticBaseQuery } from '@/lib/quiz-image-style'

describe('applyStyleToStaticBaseQuery subjectWord', () => {
  it('uses the typed subject instead of the first curated token', () => {
    const curated = 'red apple fruit isolated on white background stock photo'
    const q = applyStyleToStaticBaseQuery(curated, 'photo', '0', 0, 'apple')
    expect(q.toLowerCase()).toContain('apple')
    // Without subjectWord this used to start as "red …"
    expect(q.toLowerCase().startsWith('red ')).toBe(false)
  })

  it('keeps fun as the subject instead of children from the curated phrase', () => {
    const curated =
      'children playground happy playing outdoors simple stock photo'
    const q = applyStyleToStaticBaseQuery(curated, 'photo', '0', 0, 'fun')
    expect(q.toLowerCase()).toContain('fun')
    expect(q.toLowerCase().startsWith('children')).toBe(false)
  })
})

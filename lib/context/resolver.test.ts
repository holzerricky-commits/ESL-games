import { describe, expect, it } from 'vitest'
import { createLessonRangeKey, deriveAutoLessonRange, resolveCanonicalLessonRange } from '@/lib/context/resolver'

const options = [
  { bookId: 'b1', unitId: 'u1', lessonId: 'l1', id: 'p1', startPageHint: 10, endPageHint: 12 },
  { bookId: 'b1', unitId: 'u1', lessonId: 'l1', id: 'p2', startPageHint: 13, endPageHint: 15 },
  { bookId: 'b1', unitId: 'u1', lessonId: 'l2', id: 'p3', startPageHint: 20, endPageHint: 22 },
]

describe('context resolver', () => {
  it('derives lesson-wide auto range from lesson parts', () => {
    const selected = options[0]
    const resolved = deriveAutoLessonRange(options, selected)
    expect(resolved.source).toBe('auto')
    expect(resolved.startPage).toBe(10)
    expect(resolved.endPage).toBe(15)
  })

  it('prefers saved override over auto range', () => {
    const selected = options[0]
    const resolved = resolveCanonicalLessonRange(options, selected, { startPage: 7, endPage: 9 })
    expect(resolved.source).toBe('saved')
    expect(resolved.startPage).toBe(7)
    expect(resolved.endPage).toBe(9)
  })

  it('falls back to selected section when lesson metadata is missing', () => {
    const selected = { bookId: 'b1', unitId: 'u1', id: 'custom', startPageHint: 30, endPageHint: 31 }
    const resolved = deriveAutoLessonRange(options, selected)
    expect(resolved.source).toBe('fallback')
    expect(resolved.startPage).toBe(30)
    expect(resolved.endPage).toBe(31)
  })

  it('creates stable lesson key when selecting a part', () => {
    const keyFromPart = createLessonRangeKey({ bookId: 'b1', unitId: 'u1', lessonId: 'l1', id: 'p2' })
    const keyFromLesson = createLessonRangeKey({ bookId: 'b1', unitId: 'u1', lessonId: 'l1', id: 'l1' })
    expect(keyFromPart).toBe(keyFromLesson)
  })

  it('updates auto range when lesson key changes', () => {
    const lessonOne = deriveAutoLessonRange(options, options[0])
    const lessonTwo = deriveAutoLessonRange(options, options[2]!)
    expect(lessonOne.key).not.toBe(lessonTwo.key)
    expect(lessonOne.startPage).toBe(10)
    expect(lessonTwo.startPage).toBe(20)
  })
})

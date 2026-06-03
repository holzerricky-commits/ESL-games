import { describe, expect, it } from 'vitest'
import { annotationTargetPageIfChanged } from '@/lib/books/annotation-target-page'

describe('annotationTargetPageIfChanged', () => {
  it('returns next when page changes', () => {
    expect(annotationTargetPageIfChanged(4, 5)).toBe(5)
  })

  it('returns prev when page is unchanged', () => {
    expect(annotationTargetPageIfChanged(4, 4)).toBe(4)
  })
})

import { describe, expect, it } from 'vitest'
import {
  isLessonBoardLinksDiskPayloadEmpty,
  normalizeLessonBoardLinksDiskPayload,
} from '@/lib/local-data/lesson-board-links-disk-types'

describe('lesson-board-links-disk-types', () => {
  it('normalizes legacy bare scope map', () => {
    const payload = normalizeLessonBoardLinksDiskPayload({
      'stu-1::book-a::unit-b': [{ id: 'link-1' }],
    })
    expect(payload.links['stu-1::book-a::unit-b']).toHaveLength(1)
  })

  it('normalizes { links } payload', () => {
    const payload = normalizeLessonBoardLinksDiskPayload({
      links: { 'stu-1::book-a::unit-b': [{ id: 'link-1' }] },
    })
    expect(payload.links['stu-1::book-a::unit-b']).toHaveLength(1)
  })

  it('detects empty payload', () => {
    expect(isLessonBoardLinksDiskPayloadEmpty({ links: {} })).toBe(true)
    expect(isLessonBoardLinksDiskPayloadEmpty({ links: { a: [] } })).toBe(true)
    expect(isLessonBoardLinksDiskPayloadEmpty({ links: { a: [{}] } })).toBe(false)
  })
})

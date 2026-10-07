import { describe, expect, it } from 'vitest'
import {
  cardsForLesson,
  normalizeLessonVaultDiskPayload,
  upsertLessonVaultCard,
  type LessonVaultSaveInput,
} from '@/lib/lesson-vault/types'

const base: LessonVaultSaveInput = {
  bookId: 'b1',
  unitId: 'u1',
  lessonId: 'l1',
  lessonTitle: 'Turtles',
  partId: 'p2',
  partTitle: 'Main story',
  word: 'seastar',
  sentence: 'The seastar lives in the tide pool.',
  pdfPage: 12,
}

let n = 0
const opts = () => ({ now: '2026-10-07T12:00:00.000Z', createId: () => `id-${++n}` })

describe('lesson vault store', () => {
  it('drops invalid cards when normalizing', () => {
    const payload = normalizeLessonVaultDiskPayload({
      byStudent: {
        s1: [{ id: 'a', word: 'shell', bookId: 'b1', unitId: 'u1', lessonId: 'l1' }, { id: 'b' }],
        '': [],
      },
    })
    expect(payload.byStudent.s1).toHaveLength(1)
    expect(payload.byStudent.s1![0]!.sentence).toBe('')
    expect(Object.keys(payload.byStudent)).toEqual(['s1'])
  })

  it('returns empty payload for junk', () => {
    expect(normalizeLessonVaultDiskPayload(null)).toEqual({ byStudent: {} })
    expect(normalizeLessonVaultDiskPayload([1, 2])).toEqual({ byStudent: {} })
  })

  it('updates the same word in the same lesson instead of adding', () => {
    const first = upsertLessonVaultCard([], base, opts())
    expect(first.mode).toBe('added')
    const second = upsertLessonVaultCard(
      first.cards,
      { ...base, word: 'Seastar', sentence: 'A seastar has five arms.' },
      opts(),
    )
    expect(second.mode).toBe('updated')
    expect(second.cards).toHaveLength(1)
    expect(second.cards[0]!.sentence).toBe('A seastar has five arms.')
  })

  it('keeps the old sentence when the new save has none', () => {
    const first = upsertLessonVaultCard([], base, opts())
    const second = upsertLessonVaultCard(first.cards, { ...base, sentence: '' }, opts())
    expect(second.cards[0]!.sentence).toBe(base.sentence)
  })

  it('keeps the same word in another lesson as a separate card', () => {
    const first = upsertLessonVaultCard([], base, opts())
    const second = upsertLessonVaultCard(first.cards, { ...base, lessonId: 'l2' }, opts())
    expect(second.mode).toBe('added')
    expect(cardsForLesson(second.cards, { bookId: 'b1', unitId: 'u1', lessonId: 'l1' })).toHaveLength(1)
    expect(cardsForLesson(second.cards, { bookId: 'b1', unitId: 'u1', lessonId: 'l2' })).toHaveLength(1)
  })
})

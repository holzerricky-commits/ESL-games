import { describe, expect, it } from 'vitest'
import {
  cardsForLesson,
  cardsForLessons,
  cardsMissingPicture,
  cardsNeedingAutoPicture,
  moveLessonVaultCardToLesson,
  normalizeLessonVaultDiskPayload,
  patchLessonVaultCardPictureMeta,
  pictureWordKey,
  removeLessonVaultCard,
  restoreLessonVaultCard,
  setLessonVaultCardImage,
  fillLessonVaultCardChineseIfEmpty,
  fillLessonVaultCardMeaningIfEmpty,
  updateLessonVaultCardText,
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

  it('saves the dictionary form and keeps the sentence from the page', () => {
    const first = upsertLessonVaultCard(
      [],
      { ...base, word: 'feathers', sentence: 'The bird has soft feathers.' },
      opts(),
    )
    expect(first.card.word).toBe('feather')
    expect(first.card.sentence).toBe('The bird has soft feathers.')
    const again = upsertLessonVaultCard(first.cards, { ...base, word: 'feather', sentence: 'A feather fell.' }, opts())
    expect(again.mode).toBe('updated')
    expect(again.cards).toHaveLength(1)
    expect(again.card.word).toBe('feather')
    expect(again.card.sentence).toBe('A feather fell.')
    const edited = updateLessonVaultCardText(
      again.cards,
      again.card.id,
      { sentence: again.card.sentence, meaning: '', word: 'feathers' },
      'x',
    )
    expect(edited?.card.word).toBe('feathers')
    const restored = upsertLessonVaultCard(
      edited!.cards,
      { ...base, word: 'feathers', sentence: 'Soft feathers fell.' },
      opts(),
    )
    expect(restored.mode).toBe('updated')
    expect(restored.card.word).toBe('feather')
  })

  it('saves flew as fly, and keeps a mid-sentence name apart from that word', () => {
    const flew = upsertLessonVaultCard([], { ...base, word: 'flew', sentence: 'The owl flew away.' }, opts())
    expect(flew.card.word).toBe('fly')
    expect(flew.card.sentence).toBe('The owl flew away.')
    const name = upsertLessonVaultCard(
      [],
      { ...base, word: 'Feathers', sentence: 'The parrot Feathers sat still.' },
      opts(),
    )
    expect(name.card.word).toBe('Feathers')
    const both = upsertLessonVaultCard(
      name.cards,
      { ...base, word: 'feathers', sentence: 'Soft feathers fell.' },
      opts(),
    )
    expect(both.mode).toBe('added')
    expect(both.cards.map((card) => card.word).sort()).toEqual(['Feathers', 'feather'])
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

  it('edits sentence and meaning on one card only', () => {
    const first = upsertLessonVaultCard([], base, opts())
    const second = upsertLessonVaultCard(first.cards, { ...base, word: 'shell' }, opts())
    const edited = updateLessonVaultCardText(
      second.cards,
      first.card.id,
      { sentence: '  A seastar  has five arms. ', meaning: 'a star-shaped sea animal' },
      '2026-10-08T09:00:00.000Z',
    )
    expect(edited?.card.sentence).toBe('A seastar has five arms.')
    expect(edited?.card.meaning).toBe('a star-shaped sea animal')
    expect(edited?.cards[1]!.meaning).toBe('')
    expect(updateLessonVaultCardText(second.cards, 'missing', { sentence: '', meaning: '' }, 'x')).toBeNull()
  })

  it('fills an empty meaning and leaves one the teacher already wrote', () => {
    const first = upsertLessonVaultCard([], base, opts())
    const filled = fillLessonVaultCardMeaningIfEmpty(first.cards, first.card.id, '  a star-shaped sea animal ', 'now')
    expect(filled?.card.meaning).toBe('a star-shaped sea animal')
    expect(fillLessonVaultCardMeaningIfEmpty(filled!.cards, first.card.id, 'something else', 'later')).toBeNull()
    expect(filled!.cards[0]!.meaning).toBe('a star-shaped sea animal')
    expect(fillLessonVaultCardMeaningIfEmpty(first.cards, first.card.id, '   ', 'now')).toBeNull()
  })

  it('fills empty chinese and leaves a saved translation', () => {
    const first = upsertLessonVaultCard([], base, opts())
    expect(first.card.chinese).toBe('')
    const filled = fillLessonVaultCardChineseIfEmpty(first.cards, first.card.id, '  海星 ', 'now')
    expect(filled?.card.chinese).toBe('海星')
    expect(fillLessonVaultCardChineseIfEmpty(filled!.cards, first.card.id, '别的', 'later')).toBeNull()
    expect(fillLessonVaultCardChineseIfEmpty(first.cards, first.card.id, '   ', 'now')).toBeNull()
  })

  it('keeps the meaning when the same word is saved again', () => {
    const first = upsertLessonVaultCard([], base, opts())
    const edited = updateLessonVaultCardText(first.cards, first.card.id, { sentence: base.sentence, meaning: 'sea animal' }, 'x')
    const again = upsertLessonVaultCard(edited!.cards, base, opts())
    expect(again.cards[0]!.meaning).toBe('sea animal')
  })

  it('stores a picture given on save and never replaces an existing one on re-save', () => {
    const first = upsertLessonVaultCard([], { ...base, imageUrl: 'https://img/a.jpg' }, opts())
    expect(first.card.imageUrl).toBe('https://img/a.jpg')
    const again = upsertLessonVaultCard(first.cards, { ...base, imageUrl: 'https://img/b.jpg' }, opts())
    expect(again.cards[0]!.imageUrl).toBe('https://img/a.jpg')
    const plain = upsertLessonVaultCard([], base, opts())
    expect(plain.card.imageUrl).toBe('')
  })

  it('sets and replaces the picture on one card', () => {
    const first = upsertLessonVaultCard([], base, opts())
    const set = setLessonVaultCardImage(first.cards, first.card.id, ' https://img/c.jpg ', 'x')
    expect(set?.card.imageUrl).toBe('https://img/c.jpg')
    expect(setLessonVaultCardImage(first.cards, 'missing', 'u', 'x')).toBeNull()
  })

  it('records where a picture came from', () => {
    const plain = upsertLessonVaultCard([], base, opts())
    expect(plain.card.pictureSource).toBe('')
    expect(upsertLessonVaultCard([], { ...base, imageUrl: 'https://img/a.jpg' }, opts()).card.pictureSource).toBe(
      'search',
    )
    expect(setLessonVaultCardImage(plain.cards, plain.card.id, '/p.png', 'x')?.card.pictureSource).toBe('own')
    expect(setLessonVaultCardImage(plain.cards, plain.card.id, '/p.png', 'x', 'auto')?.card.pictureSource).toBe('auto')
    expect(setLessonVaultCardImage(plain.cards, plain.card.id, '', 'x', 'auto')?.card.pictureSource).toBe('')
  })

  it('defaults automatic-picture fields on old cards and drops bad choices', () => {
    const payload = normalizeLessonVaultDiskPayload({
      byStudent: {
        s1: [
          { id: 'a', word: 'shell', bookId: 'b1', unitId: 'u1', lessonId: 'l1', imageUrl: '/x.png' },
          {
            id: 'b',
            word: 'crab',
            bookId: 'b1',
            unitId: 'u1',
            lessonId: 'l1',
            autoPicture: 'weird',
            pictureChoices: [{ full: 'https://a' }, { thumb: 'only-thumb' }, 5],
            pictureChoiceIndex: 9,
          },
        ],
      },
    })
    const [a, b] = payload.byStudent.s1!
    expect(a).toMatchObject({ pictureSource: 'search', autoPicture: '', pictureChoices: [], pictureChoiceIndex: 0 })
    expect(b).toMatchObject({
      pictureSource: '',
      autoPicture: '',
      pictureChoices: [{ thumb: 'https://a', full: 'https://a' }],
      pictureChoiceIndex: 0,
    })
  })

  it('patches automatic-picture state and picks which cards need a search', () => {
    const one = upsertLessonVaultCard([], base, opts())
    const two = upsertLessonVaultCard(one.cards, { ...base, word: 'crab' }, opts())
    const three = upsertLessonVaultCard(two.cards, { ...base, word: 'however', imageUrl: '/h.png' }, opts())
    expect(cardsNeedingAutoPicture(three.cards).map((c) => c.word)).toEqual(['seastar', 'crab'])
    const patched = patchLessonVaultCardPictureMeta(three.cards, two.card.id, {
      autoPicture: 'abstract',
      pictureChoices: [{ thumb: 't', full: 'f' }],
      pictureChoiceIndex: 3,
    })!
    expect(patched.card.pictureChoiceIndex).toBe(0)
    expect(cardsNeedingAutoPicture(patched.cards).map((c) => c.word)).toEqual(['seastar'])
    expect(cardsMissingPicture(patched.cards).map((c) => c.word)).toEqual(['seastar'])
  })

  it('matches picture searches to saved words loosely', () => {
    expect(pictureWordKey('Seastars')).toBe(pictureWordKey('seastar'))
    expect(pictureWordKey('boxes')).toBe('box')
    expect(pictureWordKey('glass')).toBe('glass')
    expect(pictureWordKey('tide pool!')).toBe('tide pool')
  })

  it('keeps the same word in another lesson as a separate card', () => {
    const first = upsertLessonVaultCard([], base, opts())
    const second = upsertLessonVaultCard(first.cards, { ...base, lessonId: 'l2' }, opts())
    expect(second.mode).toBe('added')
    expect(cardsForLesson(second.cards, { bookId: 'b1', unitId: 'u1', lessonId: 'l1' })).toHaveLength(1)
    expect(cardsForLesson(second.cards, { bookId: 'b1', unitId: 'u1', lessonId: 'l2' })).toHaveLength(1)
  })

  it('unions a teaching week and keeps the open book first', () => {
    const workshop = upsertLessonVaultCard([], { ...base, word: 'friend', bookId: 'ws', lessonId: 'ws-1' }, opts())
    const literature = upsertLessonVaultCard(
      workshop.cards,
      { ...base, word: 'river', bookId: 'lit', unitId: 'lit-u', lessonId: 'lit-1' },
      opts(),
    )
    const both = upsertLessonVaultCard(literature.cards, { ...base, word: 'friend', bookId: 'lit', unitId: 'lit-u', lessonId: 'lit-1' }, opts())
    expect(
      cardsForLessons(both.cards, [
        { bookId: 'lit', unitId: 'lit-u', lessonId: 'lit-1' },
        { bookId: 'ws', unitId: 'u1', lessonId: 'ws-1' },
      ]).map((card) => card.word),
    ).toEqual(['river', 'friend', 'friend'])
    expect(cardsForLessons(both.cards, [])).toEqual([])
  })

  it('fixes the word spelling but keeps it when the fix is empty', () => {
    const { cards, card } = upsertLessonVaultCard([], { ...base, word: 'seastar,' }, opts())
    const fixed = updateLessonVaultCardText(cards, card.id, { sentence: card.sentence, meaning: '', word: ' seastar ' }, 'now')
    expect(fixed!.card.word).toBe('seastar')
    const kept = updateLessonVaultCardText(fixed!.cards, card.id, { sentence: '', meaning: '', word: '  ' }, 'now')
    expect(kept!.card.word).toBe('seastar')
  })

  it('removes a card and undo puts it back in the same place', () => {
    const a = upsertLessonVaultCard([], base, opts())
    const b = upsertLessonVaultCard(a.cards, { ...base, word: 'shell' }, opts())
    const c = upsertLessonVaultCard(b.cards, { ...base, word: 'turtle' }, opts())
    const removed = removeLessonVaultCard(c.cards, b.card.id)!
    expect(removed.cards.map((x) => x.word)).toEqual(['seastar', 'turtle'])
    const restored = restoreLessonVaultCard(removed.cards, removed.removed, removed.index)
    expect(restored.map((x) => x.word)).toEqual(['seastar', 'shell', 'turtle'])
    expect(restoreLessonVaultCard(restored, removed.removed, removed.index)).toHaveLength(3)
  })

  it('moves a card to another lesson and refuses a duplicate word there', () => {
    const a = upsertLessonVaultCard([], base, opts())
    const moved = moveLessonVaultCardToLesson(a.cards, a.card.id, { lessonId: 'l2', lessonTitle: 'Whales' }, 'now')
    expect(moved.ok).toBe(true)
    if (!moved.ok) return
    expect(moved.card).toMatchObject({ lessonId: 'l2', lessonTitle: 'Whales', partTitle: '' })
    const again = upsertLessonVaultCard(moved.cards, base, opts())
    const blocked = moveLessonVaultCardToLesson(again.cards, again.card.id, { lessonId: 'l2', lessonTitle: 'Whales' }, 'now')
    expect(blocked).toEqual({ ok: false, reason: 'duplicate' })
  })
})

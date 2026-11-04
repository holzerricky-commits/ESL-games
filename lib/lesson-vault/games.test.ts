import { describe, expect, it } from 'vitest'
import {
  buildGameRound,
  buildMeaningBoard,
  buildMemoryDeck,
  gameAvailability,
  gapSentence,
  isMemoryMatch,
  MEMORY_MAX_PAIRS,
  memoryStars,
  scrambleLetters,
  spellCheck,
} from './games'
import type { LessonVaultCard } from './types'

function card(id: string, word: string, extra: Partial<LessonVaultCard> = {}): LessonVaultCard {
  return {
    id,
    bookId: 'b',
    unitId: 'u',
    lessonId: 'l',
    lessonTitle: 'L',
    partId: '',
    partTitle: '',
    word,
    sentence: '',
    meaning: '',
    chinese: '',
    imageUrl: '',
    pictureSource: '',
    pictureChoices: [],
    pictureChoiceIndex: 0,
    autoPicture: '',
    reviewStatus: 'unchecked',
    pdfPage: 1,
    createdAt: '',
    updatedAt: '',
    ...extra,
  }
}

const pic = { imageUrl: '/p.png' }

describe('gapSentence', () => {
  it('blanks the word with its ending, case-insensitive', () => {
    expect(gapSentence(card('a', 'shell', { sentence: 'She found two Shells on the beach.' }))).toEqual({
      before: 'She found two ',
      gap: 'Shells',
      after: ' on the beach.',
    })
  })

  it('does not match inside another word, and needs a sentence', () => {
    expect(gapSentence(card('a', 'cat', { sentence: 'A scattered pile.' }))).toBeNull()
    expect(gapSentence(card('a', 'cat', { sentence: 'A shellfish.' }))).toBeNull()
    expect(gapSentence(card('a', 'cat'))).toBeNull()
  })

  it('blanks irregular and spelling-change forms of the dictionary word', () => {
    expect(gapSentence(card('a', 'fly', { sentence: 'The owl flew away.' }))).toEqual({
      before: 'The owl ',
      gap: 'flew',
      after: ' away.',
    })
    expect(gapSentence(card('a', 'city', { sentence: 'We visited two cities.' }))).toMatchObject({ gap: 'cities' })
    expect(gapSentence(card('a', 'happy', { sentence: 'She is happier now.' }))).toMatchObject({ gap: 'happier' })
  })
})

describe('gameAvailability', () => {
  it('needs three words first', () => {
    expect(gameAvailability('picture-word', [card('a', 'sea', pic)])).toEqual({
      ok: false,
      reason: 'Save 2 more words to play',
    })
  })

  it('names what is missing for each game', () => {
    const cards = [card('a', 'sea', pic), card('b', 'sand'), card('c', 'shell', { sentence: 'A shell.' })]
    expect(gameAvailability('picture-word', cards)).toEqual({ ok: false, reason: 'Add pictures to 2 more cards' })
    expect(gameAvailability('fill-gap', cards)).toEqual({
      ok: false,
      reason: 'Add a sentence with the word to 2 more cards',
    })
  })

  it('counts a repeated word once', () => {
    const cards = [card('a', 'sea', pic), card('b', 'Sea', pic), card('c', 'sand', pic)]
    expect(gameAvailability('picture-word', cards).ok).toBe(false)
  })

  it('counts a dictionary form and its plural once', () => {
    const cards = [card('a', 'feather', pic), card('b', 'feathers', pic), card('c', 'sand', pic)]
    expect(gameAvailability('picture-word', cards)).toEqual({ ok: false, reason: 'Save 1 more word to play' })
  })
})

describe('buildGameRound', () => {
  const cards = [
    card('a', 'sea', pic),
    card('b', 'sand', pic),
    card('c', 'shell', pic),
    card('d', 'wave', pic),
    card('e', 'crab'),
  ]

  it('asks every pictured card once with up to four distinct answers including the right one', () => {
    const round = buildGameRound('picture-word', cards)
    expect(round.map((q) => q.card.id).sort()).toEqual(['a', 'b', 'c', 'd'])
    for (const q of round) {
      expect(q.choiceIds).toHaveLength(4)
      expect(new Set(q.choiceIds).size).toBe(4)
      expect(q.choiceIds).toContain(q.card.id)
    }
  })

  it('limits questions to the practise-again pile but keeps all words as answers', () => {
    const round = buildGameRound('picture-word', cards, { onlyIds: ['b'] })
    expect(round).toHaveLength(1)
    expect(round[0]!.choiceIds).toHaveLength(4)
  })
})

describe('memory pairs', () => {
  const many = Array.from({ length: 9 }, (_, i) => card(`c${i}`, `word${i}`, pic))

  it('needs pictures like Picture → word', () => {
    const cards = [card('a', 'sea', pic), card('b', 'sand'), card('c', 'shell')]
    expect(gameAvailability('memory-pairs', cards)).toEqual({ ok: false, reason: 'Add pictures to 2 more cards' })
  })

  it('deals a picture and a word tile per card, at most 6 pairs, only pictured cards', () => {
    const deck = buildMemoryDeck([...many, card('x', 'blank')])
    expect(deck).toHaveLength(MEMORY_MAX_PAIRS * 2)
    expect(new Set(deck.map((t) => t.key)).size).toBe(deck.length)
    const ids = new Set(deck.map((t) => t.cardId))
    expect(ids.size).toBe(MEMORY_MAX_PAIRS)
    expect(ids.has('x')).toBe(false)
    for (const id of ids) {
      expect(deck.filter((t) => t.cardId === id).map((t) => t.face).sort()).toEqual(['picture', 'word'])
    }
    expect(buildMemoryDeck(many.slice(0, 3))).toHaveLength(6)
  })

  it('matches a picture with its own word only', () => {
    const p = { key: 'a:picture', cardId: 'a', face: 'picture' as const }
    expect(isMemoryMatch(p, { key: 'a:word', cardId: 'a', face: 'word' })).toBe(true)
    expect(isMemoryMatch(p, { key: 'b:word', cardId: 'b', face: 'word' })).toBe(false)
    expect(isMemoryMatch(p, p)).toBe(false)
  })

  it('gives stars for few wasted turns', () => {
    expect(memoryStars(6, 6)).toBe(3)
    expect(memoryStars(6, 11)).toBe(3)
    expect(memoryStars(6, 18)).toBe(2)
    expect(memoryStars(6, 19)).toBe(1)
  })
})

describe('spell it', () => {
  it('takes one-word cards with a picture or a sentence', () => {
    const cards = [
      card('a', 'sea', pic),
      card('b', 'sand', { sentence: 'The sand is hot.' }),
      card('c', 'shell', pic),
      card('d', 'ice cream', pic),
      card('e', 'wave'),
    ]
    expect(gameAvailability('spell-it', cards)).toEqual({ ok: true })
    const round = buildGameRound('spell-it', cards)
    expect(round.map((q) => q.card.word).sort()).toEqual(['sand', 'sea', 'shell'])
    for (const q of round) expect([...q.letters].sort().join('')).toBe([...q.card.word].sort().join(''))
  })

  it('never leaves the letters in the right order', () => {
    for (let i = 0; i < 30; i++) expect(scrambleLetters('ab').join('')).toBe('ba')
    expect(scrambleLetters('aa')).toEqual(['a', 'a'])
    expect(scrambleLetters('sea', () => 0.999).join('')).not.toBe('sea')
  })

  it('checks each slot, ignoring case', () => {
    expect(spellCheck('Sea', ['s', 'a', null])).toEqual([true, false, false])
    expect(spellCheck('sea', ['s', 'e', 'a'])).toEqual([true, true, true])
  })
})

describe('word meaning', () => {
  const m = (meaning: string) => ({ meaning })
  const cards = Array.from({ length: 8 }, (_, i) => card(`c${i}`, `word${i}`, m(`meaning ${i}`)))

  it('needs three cards with different meanings', () => {
    const few = [card('a', 'sea', m('salt water')), card('b', 'ocean', m('Salt  water')), card('c', 'sand')]
    expect(gameAvailability('word-meaning', [...few, card('d', 'shell')])).toEqual({
      ok: false,
      reason: 'Add a meaning to 2 more cards',
    })
    expect(gameAvailability('word-meaning', cards)).toEqual({ ok: true })
  })

  it('deals up to 5 pairs, meanings in a different order', () => {
    for (let i = 0; i < 20; i++) {
      const board = buildMeaningBoard(cards)
      expect(board.wordIds).toHaveLength(5)
      expect([...board.meaningIds].sort()).toEqual([...board.wordIds].sort())
      expect(board.meaningIds).not.toEqual(board.wordIds)
    }
  })

  it('practise again keeps the missed words and tops up to 3', () => {
    const board = buildMeaningBoard(cards, { onlyIds: ['c2'] })
    expect(board.wordIds).toHaveLength(3)
    expect(board.wordIds).toContain('c2')
  })
})

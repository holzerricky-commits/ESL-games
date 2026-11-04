import { dictionaryForm, vaultWordKey } from '@/lib/lesson-vault/dictionary-form'
import type { LessonVaultCard } from '@/lib/lesson-vault/types'

export type LessonVaultGameKind = 'picture-word' | 'fill-gap' | 'memory-pairs' | 'spell-it' | 'word-meaning'

/** Playable games plus any shown as "Coming soon". */
export type LessonVaultGameCatalogKind = LessonVaultGameKind

/** Games that need a picture on each card. */
const needsPicture = (kind: LessonVaultGameKind) => kind === 'picture-word' || kind === 'memory-pairs'

/** Cards a round needs so it is worth playing (and has enough wrong answers). */
export const MIN_GAME_CARDS = 3
const MAX_CHOICES = 4

export type GameAvailability = { ok: true } | { ok: false; reason: string }

export type GapSentence = { before: string; gap: string; after: string }

export type GameQuestion = {
  card: LessonVaultCard
  /** Card ids shown as answers, in display order; one is `card.id`. */
  choiceIds: string[]
  gap: GapSentence | null
  /** Spell it: the word's letters, shuffled. */
  letters: string[]
}

type Rng = () => number

function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const wordKey = (card: LessonVaultCard) => vaultWordKey(card.word)
const meaningKey = (card: LessonVaultCard) => card.meaning.trim().toLowerCase().replace(/\s+/g, ' ')

/** First use of the dictionary word in the card's sentence, blanked (feather blanks feathers, fly blanks flew). */
export function gapSentence(card: LessonVaultCard): GapSentence | null {
  const word = card.word.trim()
  const sentence = card.sentence.trim()
  if (!word || !sentence) return null
  if (/\s/.test(word)) {
    const phrase = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(word)}(?![\\p{L}\\p{N}])`, 'iu').exec(sentence)
    if (!phrase) return null
    return {
      before: sentence.slice(0, phrase.index),
      gap: phrase[0],
      after: sentence.slice(phrase.index + phrase[0].length),
    }
  }
  const head = dictionaryForm(word, sentence, { names: false }).toLowerCase()
  if (!head) return null
  const tokens = sentence.matchAll(/[\p{L}\p{N}'’-]+/gu)
  for (const token of tokens) {
    if (dictionaryForm(token[0], sentence, { names: false }).toLowerCase() !== head) continue
    const index = token.index ?? 0
    return {
      before: sentence.slice(0, index),
      gap: token[0],
      after: sentence.slice(index + token[0].length),
    }
  }
  return null
}

/** One card per distinct word (newest kept), so answers never repeat. */
function distinctByWord(cards: readonly LessonVaultCard[]): LessonVaultCard[] {
  const seen = new Set<string>()
  const out: LessonVaultCard[] = []
  for (const card of cards) {
    const key = wordKey(card)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(card)
  }
  return out
}

/** Spell it takes single words of 2–12 letters (no spaces, digits or hyphens). */
export function isSpellableWord(word: string): boolean {
  return /^\p{L}{2,12}$/u.test(word.trim())
}

export function gameQuestionCards(kind: LessonVaultGameKind, cards: readonly LessonVaultCard[]): LessonVaultCard[] {
  const distinct = distinctByWord(cards)
  if (needsPicture(kind)) return distinct.filter((c) => c.imageUrl.trim() !== '')
  if (kind === 'spell-it') {
    return distinct.filter(
      (c) => isSpellableWord(c.word) && (c.imageUrl.trim() !== '' || gapSentence(c) != null),
    )
  }
  if (kind === 'word-meaning') {
    const seenMeanings = new Set<string>()
    return distinct.filter((c) => {
      const key = meaningKey(c)
      if (!key || seenMeanings.has(key)) return false
      seenMeanings.add(key)
      return true
    })
  }
  return distinct.filter((c) => gapSentence(c) != null)
}

/** The word's letters shuffled, never left in the right order when another order exists. */
export function scrambleLetters(word: string, rng: Rng = Math.random): string[] {
  const letters = [...word.trim()]
  if (new Set(letters.map((l) => l.toLowerCase())).size < 2) return letters
  for (let i = 0; i < 12; i++) {
    const out = shuffle(letters, rng)
    if (out.join('').toLowerCase() !== letters.join('').toLowerCase()) return out
  }
  return [...letters.slice(1), letters[0]!]
}

/** Per slot: is the placed letter right? Case does not matter; empty slots are wrong. */
export function spellCheck(word: string, placed: readonly (string | null)[]): boolean[] {
  const target = [...word.trim()]
  return target.map((ch, i) => (placed[i] ?? '').toLowerCase() === ch.toLowerCase())
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

export function gameAvailability(kind: LessonVaultGameKind, cards: readonly LessonVaultCard[]): GameAvailability {
  const words = distinctByWord(cards).length
  if (words < MIN_GAME_CARDS) {
    return { ok: false, reason: `Save ${plural(MIN_GAME_CARDS - words, 'more word', 'more words')} to play` }
  }
  const missing = MIN_GAME_CARDS - gameQuestionCards(kind, cards).length
  if (missing <= 0) return { ok: true }
  return {
    ok: false,
    reason: needsPicture(kind)
      ? `Add pictures to ${plural(missing, 'more card', 'more cards')}`
      : kind === 'spell-it'
        ? `Needs ${plural(missing, 'more one-word card', 'more one-word cards')} with a picture or sentence`
        : kind === 'word-meaning'
          ? `Add a meaning to ${plural(missing, 'more card', 'more cards')}`
          : `Add a sentence with the word to ${plural(missing, 'more card', 'more cards')}`,
  }
}

/**
 * Questions for a round. `onlyIds` limits questions (practise-again pile);
 * wrong answers always come from all of the lesson's words.
 */
export function buildGameRound(
  kind: LessonVaultGameKind,
  cards: readonly LessonVaultCard[],
  opts: { onlyIds?: readonly string[]; rng?: Rng } = {},
): GameQuestion[] {
  const rng = opts.rng ?? Math.random
  const pool = distinctByWord(cards)
  let questionCards = gameQuestionCards(kind, cards)
  if (opts.onlyIds) {
    const only = new Set(opts.onlyIds)
    questionCards = questionCards.filter((c) => only.has(c.id))
  }
  return shuffle(questionCards, rng).map((card) => {
    if (kind === 'spell-it') {
      return { card, choiceIds: [], gap: gapSentence(card), letters: scrambleLetters(card.word, rng) }
    }
    const others = shuffle(
      pool.filter((c) => c.id !== card.id),
      rng,
    ).slice(0, MAX_CHOICES - 1)
    return {
      card,
      choiceIds: shuffle([card.id, ...others.map((c) => c.id)], rng),
      gap: kind === 'fill-gap' ? gapSentence(card) : null,
      letters: [],
    }
  })
}

/** 5 rows of word + meaning fit a classroom screen without scrolling. */
export const MEANING_MAX_PAIRS = 5

/** Card ids: words in one order, meanings in another (never the same order). */
export type MeaningBoard = { wordIds: string[]; meaningIds: string[] }

/**
 * A matching board. `onlyIds` (practise again) go first; the board is topped up
 * with other cards to at least MIN_GAME_CARDS so matching still means choosing.
 */
export function buildMeaningBoard(
  cards: readonly LessonVaultCard[],
  opts: { onlyIds?: readonly string[]; maxPairs?: number; rng?: Rng } = {},
): MeaningBoard {
  const rng = opts.rng ?? Math.random
  const max = opts.maxPairs ?? MEANING_MAX_PAIRS
  const pool = shuffle(gameQuestionCards('word-meaning', cards), rng)
  const only = new Set(opts.onlyIds ?? [])
  const first = pool.filter((c) => only.has(c.id)).slice(0, max)
  const fill = opts.onlyIds ? Math.max(0, MIN_GAME_CARDS - first.length) : max - first.length
  const picked = [...first, ...pool.filter((c) => !only.has(c.id)).slice(0, fill)]
  const wordIds = shuffle(
    picked.map((c) => c.id),
    rng,
  )
  let meaningIds = shuffle(wordIds, rng)
  if (wordIds.length > 1 && meaningIds.every((id, i) => id === wordIds[i])) {
    meaningIds = [...wordIds.slice(1), wordIds[0]!]
  }
  return { wordIds, meaningIds }
}

/** 6 pairs = 12 tiles, a 4 × 3 grid that fits a classroom screen. */
export const MEMORY_MAX_PAIRS = 6

export type MemoryTile = { key: string; cardId: string; face: 'picture' | 'word' }

/** Shuffled face-down tiles: a picture and its word for up to `maxPairs` picture cards. */
export function buildMemoryDeck(
  cards: readonly LessonVaultCard[],
  opts: { maxPairs?: number; rng?: Rng } = {},
): MemoryTile[] {
  const rng = opts.rng ?? Math.random
  const picked = shuffle(gameQuestionCards('memory-pairs', cards), rng).slice(0, opts.maxPairs ?? MEMORY_MAX_PAIRS)
  const tiles = picked.flatMap((card): MemoryTile[] => [
    { key: `${card.id}:picture`, cardId: card.id, face: 'picture' },
    { key: `${card.id}:word`, cardId: card.id, face: 'word' },
  ])
  return shuffle(tiles, rng)
}

/** Two turned tiles match when they are the picture and word of the same card. */
export function isMemoryMatch(a: MemoryTile, b: MemoryTile): boolean {
  return a.cardId === b.cardId && a.face !== b.face
}

/** 3 stars for few wasted turns, 1 for many. A perfect game takes one turn per pair. */
export function memoryStars(pairs: number, turns: number): 1 | 2 | 3 {
  if (pairs <= 0) return 3
  const extra = turns - pairs
  if (extra <= Math.ceil(pairs * 0.75)) return 3
  if (extra <= pairs * 2) return 2
  return 1
}

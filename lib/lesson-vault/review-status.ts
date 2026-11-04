import { gameAvailability, gameQuestionCards, type LessonVaultGameKind } from '@/lib/lesson-vault/games'
import {
  lessonVaultReviewStatus,
  type LessonVaultCard,
  type LessonVaultReviewStatus,
} from '@/lib/lesson-vault/types'

/** One check round stays short enough to finish in class. */
export const REVIEW_ROUND_CAP = 8

export type ReviewAttempt = 'hit' | 'miss'

export type ReviewProposal = {
  cardId: string
  result: ReviewAttempt
  status: LessonVaultReviewStatus
}

export type RecommendedReviewRound =
  | {
      mode: 'check' | 'practice'
      kind: 'picture-word' | 'fill-gap'
      cardIds: string[]
      title: string
    }
  | { mode: 'done'; mastered: number }
  | { mode: 'blocked'; reason: string }

export function cardReviewStatus(card: LessonVaultCard): LessonVaultReviewStatus {
  return lessonVaultReviewStatus(card.reviewStatus)
}

/**
 * A miss goes to Practising.
 * A first-try hit climbs one step: unchecked → practising → learned.
 * Mastered is not granted by recognition games (reserved for a later check).
 */
export function nextReviewStatus(current: LessonVaultReviewStatus, result: ReviewAttempt): LessonVaultReviewStatus {
  if (result === 'miss') return 'practising'
  if (current === 'mastered') return 'mastered'
  if (current === 'learned') return 'learned'
  if (current === 'practising') return 'learned'
  return 'practising'
}

/** Teacher flip on the end-of-round list: Practising → Learned → Mastered → Practising. */
export function cycleReviewStatus(current: LessonVaultReviewStatus): LessonVaultReviewStatus {
  if (current === 'practising') return 'learned'
  if (current === 'learned') return 'mastered'
  if (current === 'mastered') return 'practising'
  return 'practising'
}

export function proposeReviewStatuses(
  cards: readonly LessonVaultCard[],
  results: readonly { cardId: string; result: ReviewAttempt }[],
): ReviewProposal[] {
  const byId = new Map(cards.map((card) => [card.id, card]))
  const out: ReviewProposal[] = []
  for (const result of results) {
    const card = byId.get(result.cardId)
    if (!card) continue
    out.push({
      cardId: card.id,
      result: result.result,
      status: nextReviewStatus(cardReviewStatus(card), result.result),
    })
  }
  return out
}

export function groupCardsByReviewStatus(cards: readonly LessonVaultCard[]): {
  unchecked: LessonVaultCard[]
  practising: LessonVaultCard[]
  learned: LessonVaultCard[]
  mastered: LessonVaultCard[]
} {
  const unchecked: LessonVaultCard[] = []
  const practising: LessonVaultCard[] = []
  const learned: LessonVaultCard[] = []
  const mastered: LessonVaultCard[] = []
  for (const card of cards) {
    const status = cardReviewStatus(card)
    if (status === 'mastered') mastered.push(card)
    else if (status === 'learned') learned.push(card)
    else if (status === 'practising') practising.push(card)
    else unchecked.push(card)
  }
  return { unchecked, practising, learned, mastered }
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

/**
 * The round to offer on the review overview.
 * Unchecked words come first (Picture → word, then Fill the gap).
 * Practising words use Fill the gap, then Picture → word.
 */
export function recommendedReviewRound(cards: readonly LessonVaultCard[]): RecommendedReviewRound {
  const groups = groupCardsByReviewStatus(cards)
  if (groups.unchecked.length === 0 && groups.practising.length === 0) {
    return { mode: 'done', mastered: groups.mastered.length + groups.learned.length }
  }
  const checking = groups.unchecked.length > 0
  const pile = checking ? groups.unchecked : groups.practising
  const kinds: readonly ('picture-word' | 'fill-gap')[] = checking
    ? ['picture-word', 'fill-gap']
    : ['fill-gap', 'picture-word']
  let blocked: string | null = null
  for (const kind of kinds) {
    const availability = gameAvailability(kind, cards)
    if (!availability.ok) {
      blocked = availability.reason
      continue
    }
    const eligible = new Set(gameQuestionCards(kind, cards).map((card) => card.id))
    const cardIds = pile.filter((card) => eligible.has(card.id)).slice(0, REVIEW_ROUND_CAP).map((card) => card.id)
    if (cardIds.length === 0) {
      blocked = checking
        ? 'Add a picture or a sentence to the words still to check.'
        : 'Add a sentence or a picture to the words still practising.'
      continue
    }
    const n = cardIds.length
    return {
      mode: checking ? 'check' : 'practice',
      kind,
      cardIds,
      title: checking ? `Check ${plural(n, 'word', 'words')}` : `Practice ${plural(n, 'word', 'words')}`,
    }
  }
  return { mode: 'blocked', reason: blocked ?? 'Save more words to play' }
}

export function reviewGameCounts(kind: LessonVaultGameKind): boolean {
  return kind !== 'memory-pairs'
}

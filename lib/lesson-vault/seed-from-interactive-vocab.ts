import type { PartContextVocabularyWord } from '@/lib/context/types'
import { vaultWordKey } from '@/lib/lesson-vault/dictionary-form'
import {
  isCardInLesson,
  upsertLessonVaultCard,
  type LessonVaultCard,
  type LessonVaultLessonRef,
} from '@/lib/lesson-vault/types'

export type SeedInteractiveVocabPart = {
  partId: string
  partTitle: string
  /** Fallback PDF page when a word has no tap spot. */
  pdfPage: number
  words: readonly PartContextVocabularyWord[]
}

export type SeedInteractiveVocabInput = LessonVaultLessonRef & {
  lessonTitle: string
  parts: readonly SeedInteractiveVocabPart[]
}

function findLessonCard(
  cards: readonly LessonVaultCard[],
  ref: LessonVaultLessonRef,
  word: string,
): LessonVaultCard | undefined {
  const key = vaultWordKey(word)
  return cards.find((card) => isCardInLesson(card, ref) && vaultWordKey(card.word) === key)
}

/**
 * Prefills a student's lesson vault from shared Vocabulary-part interactiveVocabulary.
 * Adds missing words; fills empty sentence/meaning on existing matches; never overwrites filled fields.
 */
export function seedVaultCardsFromInteractiveVocab(
  cards: readonly LessonVaultCard[],
  input: SeedInteractiveVocabInput,
  options: { now: string; createId: () => string },
): { cards: LessonVaultCard[]; added: LessonVaultCard[] } {
  let next = [...cards]
  const added: LessonVaultCard[] = []
  const ref: LessonVaultLessonRef = {
    bookId: input.bookId,
    unitId: input.unitId,
    lessonId: input.lessonId,
  }

  for (const part of input.parts) {
    for (const entry of part.words) {
      const word = entry.word.trim()
      if (!word) continue
      const sentence = (entry.examples[0] ?? '').trim()
      const meaning = entry.definition.trim()
      const existing = findLessonCard(next, ref, word)
      if (existing && existing.meaning.trim() && existing.sentence.trim()) continue
      if (existing && !meaning && !sentence) continue
      const pdfPage =
        entry.tapSpot && Number.isFinite(entry.tapSpot.pdfPage) && entry.tapSpot.pdfPage > 0
          ? Math.floor(entry.tapSpot.pdfPage)
          : part.pdfPage > 0
            ? Math.floor(part.pdfPage)
            : 1
      const result = upsertLessonVaultCard(
        next,
        {
          ...ref,
          lessonTitle: input.lessonTitle,
          partId: part.partId,
          partTitle: part.partTitle,
          word,
          sentence,
          meaning,
          pdfPage,
        },
        options,
      )
      next = result.cards
      if (!existing && result.mode === 'added') added.push(result.card)
    }
  }

  return { cards: next, added }
}

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { AutoPictureResult } from '@/lib/lesson-vault/auto-picture-server'
import {
  fillLessonVaultCardMeaning,
  getLessonVaultCardsForStudent,
  patchLessonVaultCardPicture,
  setLessonVaultCardPicture,
} from '@/lib/lesson-vault/disk-client'
import { deleteLessonVaultPicture, uploadLessonVaultPicture } from '@/lib/lesson-vault/picture-client'
import { isLocalVaultPictureUrl } from '@/lib/lesson-vault/picture-paths'
import { pictureWordKey, type LessonVaultCard } from '@/lib/lesson-vault/types'

const WORKERS = 2
const AUTO_ROUTE = '/api/lesson-vault/auto-picture'

/** `forceSearch`: you asked again for a word judged hard to picture, so search anyway. */
type Job = { studentId: string; cardId: string; forceSearch?: boolean; meaningOnly?: boolean }

function meaningAttemptKey(cardId: string, sentence: string): string {
  return `${cardId}\n${sentence.trim()}`
}

function lessonFields(card: LessonVaultCard): Record<string, string> {
  return { bookId: card.bookId, unitId: card.unitId, lessonId: card.lessonId, partId: card.partId }
}

function findCard(studentId: string, cardId: string): LessonVaultCard | null {
  return getLessonVaultCardsForStudent(studentId).find((c) => c.id === cardId) ?? null
}

async function postAuto<T>(body: Record<string, unknown>): Promise<T | null> {
  try {
    const res = await fetch(AUTO_ROUTE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return res.ok ? ((await res.json()) as T) : null
  } catch {
    return null
  }
}

/**
 * Background picture finder for vault cards: reuse the student's picture for the same word,
 * else the server finds one (ARASAAC pictogram → Fluent emoji → Pixabay cartoon) and stores it.
 */
export function useVaultAutoPictures() {
  const [findingIds, setFindingIds] = useState<ReadonlySet<string>>(() => new Set())
  const queueRef = useRef<Job[]>([])
  const busyRef = useRef(new Set<string>())
  const activeRef = useRef(0)
  const aliveRef = useRef(true)
  /** Cards already asked for a gloss for this sentence, so opening the vault does not ask again. */
  const meaningTriedRef = useRef(new Set<string>())

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

  const markFinding = useCallback((cardId: string, on: boolean) => {
    if (!aliveRef.current) return
    setFindingIds((prev) => {
      if (prev.has(cardId) === on) return prev
      const next = new Set(prev)
      if (on) next.add(cardId)
      else next.delete(cardId)
      return next
    })
  }, [])

  /** Picture already on another card of this student for the same word. */
  const reuseExisting = useCallback(async (job: Job, card: LessonVaultCard): Promise<boolean> => {
    const key = pictureWordKey(card.word)
    const donor = getLessonVaultCardsForStudent(job.studentId).find(
      (c) => c.id !== card.id && isLocalVaultPictureUrl(c.imageUrl) && pictureWordKey(c.word) === key,
    )
    if (!donor) return false
    try {
      const res = await fetch(donor.imageUrl)
      if (!res.ok) return false
      if (findCard(job.studentId, job.cardId)?.imageUrl) return true
      const url = await uploadLessonVaultPicture(job.studentId, job.cardId, await res.blob())
      if (!setLessonVaultCardPicture(job.studentId, job.cardId, url, undefined, 'auto')) {
        void deleteLessonVaultPicture(job.studentId, job.cardId)
        return true
      }
      patchLessonVaultCardPicture(job.studentId, job.cardId, {
        autoPicture: 'found',
        pictureChoices: donor.pictureChoices,
        pictureChoiceIndex: donor.pictureChoiceIndex,
      })
      return true
    } catch {
      return false
    }
  }, [])

  const applyGloss = useCallback((job: Job, gloss: string, sentenceAtStart: string) => {
    const text = gloss.trim()
    if (!text) return
    const current = findCard(job.studentId, job.cardId)
    if (!current || current.meaning.trim() || current.sentence.trim() !== sentenceAtStart) return
    fillLessonVaultCardMeaning(job.studentId, job.cardId, text)
  }, [])

  const findPicture = useCallback(
    async (job: Job) => {
      const card = findCard(job.studentId, job.cardId)
      if (!card) return
      const sentenceAtStart = card.sentence.trim()
      const needsMeaning = !card.meaning.trim()
      let gloss = ''
      let meaningSettled = false

      if (!card.imageUrl && !job.meaningOnly) {
        if (!(await reuseExisting(job, card))) {
          const result = await postAuto<AutoPictureResult>({
            studentId: job.studentId,
            cardId: job.cardId,
            word: card.word,
            sentence: card.sentence,
            forceSearch: Boolean(job.forceSearch),
            ...lessonFields(card),
          })
          const now = findCard(job.studentId, job.cardId)
          if (!now) {
            if (result?.status === 'found') void deleteLessonVaultPicture(job.studentId, job.cardId)
            return
          }
          if (result) {
            gloss = result.gloss ?? ''
            meaningSettled = true
          }
          if (!now.imageUrl) {
            if (!result || result.status === 'skipped') {
              if (!result) patchLessonVaultCardPicture(job.studentId, job.cardId, { autoPicture: 'not-found' })
            } else if (result.status === 'found' && result.url) {
              setLessonVaultCardPicture(job.studentId, job.cardId, result.url, undefined, 'auto')
              patchLessonVaultCardPicture(job.studentId, job.cardId, {
                autoPicture: 'found',
                pictureChoices: result.choices,
                pictureChoiceIndex: result.choiceIndex,
              })
            } else {
              patchLessonVaultCardPicture(job.studentId, job.cardId, { autoPicture: result.status, pictureChoices: [] })
            }
          }
        }
      }

      const afterPicture = findCard(job.studentId, job.cardId)
      if (needsMeaning && afterPicture && !afterPicture.meaning.trim() && !meaningSettled) {
        const result = await postAuto<{ gloss?: string }>({
          studentId: job.studentId,
          cardId: job.cardId,
          word: afterPicture.word,
          sentence: afterPicture.sentence,
          meaningOnly: true,
          ...lessonFields(afterPicture),
        })
        if (result) {
          gloss = result.gloss ?? ''
          meaningSettled = true
        }
      }

      if (meaningSettled) meaningTriedRef.current.add(meaningAttemptKey(job.cardId, sentenceAtStart))
      applyGloss(job, gloss, sentenceAtStart)
    },
    [applyGloss, reuseExisting],
  )

  const pump = useCallback(() => {
    while (activeRef.current < WORKERS && queueRef.current.length > 0) {
      const job = queueRef.current.shift()!
      activeRef.current += 1
      if (!job.meaningOnly) markFinding(job.cardId, true)
      void findPicture(job)
        .catch(() => {
          if (!job.meaningOnly) patchLessonVaultCardPicture(job.studentId, job.cardId, { autoPicture: 'not-found' })
        })
        .finally(() => {
          activeRef.current -= 1
          busyRef.current.delete(job.cardId)
          if (!job.meaningOnly) markFinding(job.cardId, false)
          pump()
        })
    }
  }, [findPicture, markFinding])

  /** Queues blank cards. `retry` also re-tries cards that found nothing before. */
  const queueAutoPictures = useCallback(
    (studentId: string, cards: readonly LessonVaultCard[], opts: { retry?: boolean } = {}) => {
      const sid = studentId.trim()
      if (!sid) return
      for (const card of cards) {
        if (card.imageUrl || busyRef.current.has(card.id)) continue
        if (card.autoPicture !== '' && !opts.retry) continue
        const forceSearch = card.autoPicture === 'abstract'
        if (card.autoPicture !== '') patchLessonVaultCardPicture(sid, card.id, { autoPicture: '' })
        busyRef.current.add(card.id)
        queueRef.current.push({ studentId: sid, cardId: card.id, forceSearch })
        markFinding(card.id, true)
      }
      pump()
    },
    [markFinding, pump],
  )

  /** Fills an empty meaning from the lesson's definition, or a short gloss of the sentence. */
  const queueAutoMeanings = useCallback(
    (studentId: string, cards: readonly LessonVaultCard[]) => {
      const sid = studentId.trim()
      if (!sid) return
      for (const card of cards) {
        if (card.meaning.trim() || busyRef.current.has(card.id)) continue
        if (meaningTriedRef.current.has(meaningAttemptKey(card.id, card.sentence))) continue
        busyRef.current.add(card.id)
        queueRef.current.push({ studentId: sid, cardId: card.id, meaningOnly: true })
      }
      pump()
    },
    [pump],
  )

  /** Swaps the card's picture to another automatic choice. */
  const chooseAutoPicture = useCallback(
    async (studentId: string, cardId: string, index: number): Promise<boolean> => {
      const sid = studentId.trim()
      const card = findCard(sid, cardId)
      const choice = card?.pictureChoices[index]
      if (!card || !choice || busyRef.current.has(cardId)) return false
      busyRef.current.add(cardId)
      markFinding(cardId, true)
      try {
        const result = await postAuto<{ url?: string }>({ studentId: sid, cardId, choiceUrl: choice.full })
        if (!result?.url) {
          toast.error('That picture could not be downloaded. Try another one.')
          return false
        }
        if (!setLessonVaultCardPicture(sid, cardId, result.url, (m) => toast.error(m), 'auto')) return false
        patchLessonVaultCardPicture(sid, cardId, { autoPicture: 'found', pictureChoiceIndex: index })
        return true
      } finally {
        busyRef.current.delete(cardId)
        markFinding(cardId, false)
      }
    },
    [markFinding],
  )

  return { findingIds, queueAutoPictures, queueAutoMeanings, chooseAutoPicture }
}

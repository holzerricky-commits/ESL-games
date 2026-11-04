'use client'

import { useCallback, useRef } from 'react'
import {
  fillLessonVaultCardChinese,
  getLessonVaultCardsForStudent,
} from '@/lib/lesson-vault/disk-client'
import type { LessonVaultCard } from '@/lib/lesson-vault/types'
import { fetchTranslation } from '@/lib/translate/translate-client'

/** Stay above the translate API's per-client cooldown. */
const TRANSLATE_GAP_MS = 450

type ChineseJob = { studentId: string; cardId: string; word: string; sentence: string }

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

/**
 * Fills empty `card.chinese` via the ESL translate API (word + sentence for sense).
 * Queued with a gap so classroom bulk-fill does not hit rate limits.
 */
export function useVaultChinese() {
  const busyRef = useRef(new Set<string>())
  const triedRef = useRef(new Set<string>())
  const queueRef = useRef<ChineseJob[]>([])
  const pumpingRef = useRef(false)

  const pump = useCallback(async () => {
    if (pumpingRef.current) return
    pumpingRef.current = true
    try {
      while (queueRef.current.length > 0) {
        const job = queueRef.current.shift()!
        const attemptKey = `${job.cardId}:${job.word}:${job.sentence}`
        try {
          const live = getLessonVaultCardsForStudent(job.studentId).find((c) => c.id === job.cardId)
          if (!live || live.chinese.trim()) continue

          const outcome = await fetchTranslation(job.word, job.sentence, {
            retryWithoutContext: true,
          })
          if (outcome.ok) {
            fillLessonVaultCardChinese(job.studentId, job.cardId, outcome.result.chinese)
          }
          triedRef.current.add(attemptKey)
        } finally {
          busyRef.current.delete(job.cardId)
        }
        if (queueRef.current.length > 0) await sleep(TRANSLATE_GAP_MS)
      }
    } finally {
      pumpingRef.current = false
    }
  }, [])

  const queueAutoChinese = useCallback(
    (studentId: string, cards: readonly LessonVaultCard[]) => {
      const sid = studentId.trim()
      if (!sid) return
      let added = false
      for (const card of cards) {
        if (card.chinese.trim() || busyRef.current.has(card.id)) continue
        const attemptKey = `${card.id}:${card.word}:${card.sentence}`
        if (triedRef.current.has(attemptKey)) continue
        busyRef.current.add(card.id)
        queueRef.current.push({
          studentId: sid,
          cardId: card.id,
          word: card.word,
          sentence: card.sentence,
        })
        added = true
      }
      if (added) void pump()
    },
    [pump],
  )

  return { queueAutoChinese }
}

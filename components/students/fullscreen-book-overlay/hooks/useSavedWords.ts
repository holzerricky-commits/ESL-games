'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getSavedWordsForStudent,
  hydrateSavedWordsFromDisk,
  isSavedWordsDiskActive,
  SAVED_WORDS_HYDRATED_EVENT,
  setSavedWordsForStudent,
} from '@/lib/local-data/saved-words-disk-client'

export type SavedWordStatus = 'new' | 'learning' | 'mastered'

export type SavedWordEntry = {
  id: string
  source: string
  chinese: string
  pinyin: string
  exampleEn: string
  exampleZh: string
  imageUrl: string
  status: SavedWordStatus
  createdAt: string
  updatedAt: string
  reviewCount: number
  lastReviewedAt: string | null
  nextReviewAt: string | null
}

/** @deprecated Use disk-backed saved words via studentId; kept for older call sites. */
export const SAVED_WORDS_STORAGE_KEY = 'translate-dock-vocab-notebook-v1'

function sanitizeSavedWordEntry(entry: unknown): SavedWordEntry | null {
  if (!entry || typeof entry !== 'object') return null
  const raw = entry as Partial<SavedWordEntry>
  if (typeof raw.id !== 'string' || typeof raw.source !== 'string' || typeof raw.chinese !== 'string') return null
  const status: SavedWordStatus =
    raw.status === 'learning' || raw.status === 'mastered' ? raw.status : 'new'
  const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString()
  return {
    id: raw.id,
    source: raw.source,
    chinese: raw.chinese,
    pinyin: typeof raw.pinyin === 'string' ? raw.pinyin : '',
    exampleEn: typeof raw.exampleEn === 'string' ? raw.exampleEn : '',
    exampleZh: typeof raw.exampleZh === 'string' ? raw.exampleZh : '',
    imageUrl: typeof raw.imageUrl === 'string' ? raw.imageUrl : '',
    status,
    createdAt,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : createdAt,
    reviewCount: Number.isFinite(raw.reviewCount) ? (raw.reviewCount as number) : 0,
    lastReviewedAt: typeof raw.lastReviewedAt === 'string' ? raw.lastReviewedAt : null,
    nextReviewAt: typeof raw.nextReviewAt === 'string' ? raw.nextReviewAt : null,
  }
}

function loadEntriesForStudent(studentId: string): SavedWordEntry[] {
  const sid = studentId.trim()
  if (!sid) return []
  return getSavedWordsForStudent(sid)
    .map((entry) => sanitizeSavedWordEntry(entry))
    .filter((entry): entry is SavedWordEntry => entry != null)
}

function addDays(isoNow: string, days: number): string {
  const base = new Date(isoNow)
  base.setUTCDate(base.getUTCDate() + days)
  return base.toISOString()
}

function computeNextReviewAt(status: SavedWordStatus, nowIso: string, reviewCount: number): string | null {
  if (status === 'mastered') return null
  if (status === 'new') return addDays(nowIso, 1)
  if (reviewCount >= 6) return addDays(nowIso, 5)
  if (reviewCount >= 3) return addDays(nowIso, 3)
  return addDays(nowIso, 2)
}

interface UseSavedWordsOptions {
  studentId: string
  onPersistenceError?: (message: string) => void
}

interface SaveWordInput {
  source: string
  chinese: string
  pinyin?: string
  exampleEn?: string
  exampleZh?: string
  imageUrl?: string
}

export function useSavedWords(options: UseSavedWordsOptions) {
  const studentId = options.studentId.trim()
  const onPersistenceError = options.onPersistenceError
  const [entries, setEntries] = useState<SavedWordEntry[]>([])

  useEffect(() => {
    let cancelled = false
    const reload = () => {
      if (cancelled || !studentId) return
      setEntries(loadEntriesForStudent(studentId))
    }
    void (async () => {
      await hydrateSavedWordsFromDisk()
      if (cancelled) return
      reload()
    })()
    window.addEventListener(SAVED_WORDS_HYDRATED_EVENT, reload)
    return () => {
      cancelled = true
      window.removeEventListener(SAVED_WORDS_HYDRATED_EVENT, reload)
    }
  }, [studentId])

  const persistEntries = useCallback(
    (next: SavedWordEntry[]) => {
      setEntries(next)
      if (!studentId) return false
      try {
        setSavedWordsForStudent(studentId, next)
        return true
      } catch {
        onPersistenceError?.(
          isSavedWordsDiskActive()
            ? 'Could not save words on this PC.'
            : 'Could not save words locally (storage full).',
        )
        return false
      }
    },
    [onPersistenceError, studentId],
  )

  const saveWord = useCallback(
    (input: SaveWordInput): 'created' | 'updated' => {
      const source = input.source.trim()
      const chinese = input.chinese.trim()
      if (!source || !chinese) return 'updated'
      const now = new Date().toISOString()
      const normalizedWord = source.toLowerCase()
      const existing = entries.find((entry) => entry.source.trim().toLowerCase() === normalizedWord)
      const next: SavedWordEntry = existing
        ? {
            ...existing,
            source,
            chinese,
            pinyin: input.pinyin?.trim() ?? existing.pinyin,
            exampleEn: input.exampleEn?.trim() ?? existing.exampleEn,
            exampleZh: input.exampleZh?.trim() ?? existing.exampleZh,
            imageUrl: input.imageUrl?.trim() || existing.imageUrl,
            updatedAt: now,
          }
        : {
            id:
              typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : `vocab_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
            source,
            chinese,
            pinyin: input.pinyin?.trim() ?? '',
            exampleEn: input.exampleEn?.trim() ?? '',
            exampleZh: input.exampleZh?.trim() ?? '',
            imageUrl: input.imageUrl?.trim() ?? '',
            status: 'new',
            createdAt: now,
            updatedAt: now,
            reviewCount: 0,
            lastReviewedAt: null,
            nextReviewAt: now,
          }
      const rest = entries.filter((entry) => entry.id !== next.id)
      persistEntries([next, ...rest])
      return existing ? 'updated' : 'created'
    },
    [entries, persistEntries],
  )

  const markStatus = useCallback(
    (entryId: string, status: SavedWordStatus) => {
      const now = new Date().toISOString()
      const next = entries.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              status,
              updatedAt: now,
              reviewCount: entry.reviewCount + 1,
              lastReviewedAt: now,
              nextReviewAt: computeNextReviewAt(status, now, entry.reviewCount + 1),
            }
          : entry,
      )
      persistEntries(next)
    },
    [entries, persistEntries],
  )

  const reviewEntries = useMemo(
    () => entries.filter((entry) => entry.status !== 'mastered'),
    [entries],
  )
  const dueReviewEntries = useMemo(() => {
    const now = Date.now()
    return reviewEntries
      .filter((entry) => {
        if (!entry.nextReviewAt) return true
        const dueTs = Date.parse(entry.nextReviewAt)
        if (!Number.isFinite(dueTs)) return true
        return dueTs <= now
      })
      .sort((a, b) => {
        const aTs = a.nextReviewAt ? Date.parse(a.nextReviewAt) : 0
        const bTs = b.nextReviewAt ? Date.parse(b.nextReviewAt) : 0
        return aTs - bTs
      })
  }, [reviewEntries])

  return {
    entries,
    reviewEntries,
    dueReviewEntries,
    saveWord,
    markStatus,
    persistEntries,
  }
}

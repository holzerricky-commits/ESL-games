'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

export type NotebookStatus = 'new' | 'learning' | 'mastered'

export type VocabNotebookEntry = {
  id: string
  source: string
  chinese: string
  pinyin: string
  exampleEn: string
  exampleZh: string
  imageUrl: string
  status: NotebookStatus
  createdAt: string
  updatedAt: string
  reviewCount: number
  lastReviewedAt: string | null
  nextReviewAt: string | null
}

export const VOCAB_NOTEBOOK_STORAGE_KEY = 'translate-dock-vocab-notebook-v1'

function sanitizeNotebookEntry(entry: unknown): VocabNotebookEntry | null {
  if (!entry || typeof entry !== 'object') return null
  const raw = entry as Partial<VocabNotebookEntry>
  if (typeof raw.id !== 'string' || typeof raw.source !== 'string' || typeof raw.chinese !== 'string') return null
  const status: NotebookStatus =
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

function addDays(isoNow: string, days: number): string {
  const base = new Date(isoNow)
  base.setUTCDate(base.getUTCDate() + days)
  return base.toISOString()
}

function computeNextReviewAt(status: NotebookStatus, nowIso: string, reviewCount: number): string | null {
  if (status === 'mastered') return null
  if (status === 'new') return addDays(nowIso, 1)
  // learning: gradually increase interval a little as repetitions grow
  if (reviewCount >= 6) return addDays(nowIso, 5)
  if (reviewCount >= 3) return addDays(nowIso, 3)
  return addDays(nowIso, 2)
}

interface UseVocabNotebookOptions {
  storageKey?: string
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

export function useVocabNotebook(options?: UseVocabNotebookOptions) {
  const storageKey = options?.storageKey ?? VOCAB_NOTEBOOK_STORAGE_KEY
  const [entries, setEntries] = useState<VocabNotebookEntry[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) return
      const next = parsed
        .map((entry) => sanitizeNotebookEntry(entry))
        .filter((entry): entry is VocabNotebookEntry => entry != null)
      setEntries(next)
    } catch {
      // ignore malformed payloads
    }
  }, [storageKey])

  const persistEntries = useCallback(
    (next: VocabNotebookEntry[]) => {
      setEntries(next)
      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
        return true
      } catch {
        options?.onPersistenceError?.('Could not save notebook locally (storage full).')
        return false
      }
    },
    [options, storageKey],
  )

  const saveWord = useCallback(
    (input: SaveWordInput): 'created' | 'updated' => {
      const source = input.source.trim()
      const chinese = input.chinese.trim()
      if (!source || !chinese) return 'updated'
      const now = new Date().toISOString()
      const normalizedWord = source.toLowerCase()
      const existing = entries.find((entry) => entry.source.trim().toLowerCase() === normalizedWord)
      const next: VocabNotebookEntry = existing
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
    (entryId: string, status: NotebookStatus) => {
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


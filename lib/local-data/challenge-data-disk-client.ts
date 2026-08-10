'use client'

import { toast } from 'sonner'
import {
  emptyChallengeDataDiskPayload,
  isChallengeDataDiskPayloadEmpty,
  normalizeChallengeDataDiskPayload,
  type ChallengeDataDiskPayload,
} from '@/lib/local-data/challenge-data-disk-types'

export const QUIZZES_KEY = 'esl_quizzes'
export const RESULTS_KEY = 'esl_student_results'

const PERSIST_DEBOUNCE_MS = 300

let diskActive = false
let cache: ChallengeDataDiskPayload | null = null
let hydratePromise: Promise<boolean> | null = null
let persistTimer: ReturnType<typeof setTimeout> | null = null
let pendingPayload: ChallengeDataDiskPayload | null = null

export function isChallengeDataDiskActive(): boolean {
  return diskActive
}

export function getChallengeDataDiskCache(): ChallengeDataDiskPayload | null {
  return cache
}

function readBrowserArray(key: string): unknown[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function readBrowserPayload(): ChallengeDataDiskPayload {
  return {
    quizzes: readBrowserArray(QUIZZES_KEY),
    results: readBrowserArray(RESULTS_KEY),
  }
}

function clearBrowserKeys(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(QUIZZES_KEY)
    localStorage.removeItem(RESULTS_KEY)
  } catch {
    /* ignore */
  }
}

async function persistPayloadToDisk(payload: ChallengeDataDiskPayload): Promise<void> {
  const res = await fetch('/api/local-data/challenge-data', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `Save failed (${res.status})`)
  }
}

function schedulePersist(payload: ChallengeDataDiskPayload): void {
  pendingPayload = payload
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = null
    const next = pendingPayload
    pendingPayload = null
    if (!next) return
    void persistPayloadToDisk(next).catch((err) => {
      const msg = err instanceof Error ? err.message : 'Could not save challenge data to disk.'
      toast.error(msg)
    })
  }, PERSIST_DEBOUNCE_MS)
}

function ensureCache(): ChallengeDataDiskPayload {
  if (!cache) cache = emptyChallengeDataDiskPayload()
  return cache
}

export function setQuizzesOnDiskCache(quizzes: unknown[]): void {
  const next = { ...ensureCache(), quizzes }
  cache = next
  if (diskActive) schedulePersist(next)
}

export function setResultsOnDiskCache(results: unknown[]): void {
  const next = { ...ensureCache(), results }
  cache = next
  if (diskActive) schedulePersist(next)
}

export function setChallengeDataDiskCache(
  payload: ChallengeDataDiskPayload,
  options?: { persist?: boolean },
): void {
  cache = normalizeChallengeDataDiskPayload(payload)
  if (diskActive && options?.persist !== false) schedulePersist(cache)
}

export function flushChallengeDataToDisk(): void {
  if (!diskActive) return
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  const payload = pendingPayload ?? cache
  pendingPayload = null
  if (!payload) return
  void persistPayloadToDisk(payload).catch(() => {})
}

export async function hydrateChallengeDataFromDisk(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (diskActive) return true
  if (hydratePromise) return hydratePromise

  hydratePromise = (async () => {
    try {
      const res = await fetch('/api/local-data/challenge-data', { cache: 'no-store' })
      if (!res.ok) return false

      const body = (await res.json()) as ChallengeDataDiskPayload & { ok?: boolean }
      let payload = normalizeChallengeDataDiskPayload(body)
      const browser = readBrowserPayload()
      let migrated = false

      if (isChallengeDataDiskPayloadEmpty(payload) && !isChallengeDataDiskPayloadEmpty(browser)) {
        payload = browser
        await persistPayloadToDisk(payload)
        clearBrowserKeys()
        migrated = true
      }

      cache = payload
      diskActive = true

      if (migrated) {
        toast.success('Timed challenges are now saved on this PC (not only in the browser).')
      }

      return true
    } catch {
      return false
    } finally {
      if (!diskActive) hydratePromise = null
    }
  })()

  return hydratePromise
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => flushChallengeDataToDisk())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushChallengeDataToDisk()
  })
}

'use client'

import { toast } from 'sonner'
import {
  emptySavedWordsDiskPayload,
  isSavedWordsDiskPayloadEmpty,
  normalizeSavedWordsDiskPayload,
  SAVED_WORDS_LEGACY_SCOPE,
  type SavedWordsDiskPayload,
} from '@/lib/local-data/saved-words-disk-types'

/** Browser key from earlier builds (global list). */
export const SAVED_WORDS_BROWSER_KEY = 'translate-dock-vocab-notebook-v1'

/** Backup / restore key (must match `esl_*` pattern). */
export const SAVED_WORDS_BACKUP_KEY = 'esl_saved_words_v1'

const PERSIST_DEBOUNCE_MS = 300

let diskActive = false
let cache: SavedWordsDiskPayload | null = null
let hydratePromise: Promise<boolean> | null = null
let persistTimer: ReturnType<typeof setTimeout> | null = null
let pendingPayload: SavedWordsDiskPayload | null = null

export const SAVED_WORDS_HYDRATED_EVENT = 'esl-saved-words-hydrated'

function notifySavedWordsHydrated(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(SAVED_WORDS_HYDRATED_EVENT))
}

export function isSavedWordsDiskActive(): boolean {
  return diskActive
}

export function getSavedWordsDiskCache(): SavedWordsDiskPayload | null {
  return cache
}

function readBrowserPayload(): SavedWordsDiskPayload {
  if (typeof window === 'undefined') return emptySavedWordsDiskPayload()
  try {
    const raw = localStorage.getItem(SAVED_WORDS_BROWSER_KEY)
    if (!raw) return emptySavedWordsDiskPayload()
    const parsed = JSON.parse(raw) as unknown
    return normalizeSavedWordsDiskPayload(parsed)
  } catch {
    return emptySavedWordsDiskPayload()
  }
}

function clearBrowserKeys(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(SAVED_WORDS_BROWSER_KEY)
  } catch {
    /* ignore */
  }
}

async function persistPayloadToDisk(payload: SavedWordsDiskPayload): Promise<void> {
  const res = await fetch('/api/local-data/saved-words', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `Save failed (${res.status})`)
  }
}

function schedulePersist(payload: SavedWordsDiskPayload): void {
  pendingPayload = payload
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = null
    const next = pendingPayload
    pendingPayload = null
    if (!next) return
    void persistPayloadToDisk(next).catch((err) => {
      const msg = err instanceof Error ? err.message : 'Could not save words to disk.'
      toast.error(msg)
    })
  }, PERSIST_DEBOUNCE_MS)
}

function ensureCache(): SavedWordsDiskPayload {
  if (!cache) cache = emptySavedWordsDiskPayload()
  return cache
}

/** Words for one student; falls back to pre-migration global list until that student has their own bucket. */
export function getSavedWordsForStudent(studentId: string): unknown[] {
  const sid = studentId.trim()
  if (!sid) return []
  const root = diskActive ? ensureCache() : readBrowserPayload()
  if (Object.prototype.hasOwnProperty.call(root.byStudent, sid)) {
    return root.byStudent[sid] ?? []
  }
  return root.byStudent[SAVED_WORDS_LEGACY_SCOPE] ?? []
}

export function setSavedWordsForStudent(studentId: string, entries: unknown[]): void {
  const sid = studentId.trim()
  if (!sid) return
  const root = diskActive ? ensureCache() : readBrowserPayload()
  const byStudent = { ...root.byStudent, [sid]: entries }
  const next = { byStudent }
  cache = next
  if (diskActive) {
    schedulePersist(next)
    return
  }
  // Browser fallback when disk is unavailable.
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(SAVED_WORDS_BROWSER_KEY, JSON.stringify(next))
  } catch {
    throw new Error('Could not save words locally (storage full).')
  }
}

/** Drop one student's notebook (e.g. when deleting the student). */
export function removeSavedWordsForStudent(studentId: string): void {
  const sid = studentId.trim()
  if (!sid) return
  const root = diskActive ? ensureCache() : readBrowserPayload()
  if (!(sid in root.byStudent)) return
  const byStudent = { ...root.byStudent }
  delete byStudent[sid]
  const next = { byStudent }
  cache = next
  if (diskActive) {
    schedulePersist(next)
    return
  }
  if (typeof window === 'undefined') return
  try {
    if (isSavedWordsDiskPayloadEmpty(next)) {
      localStorage.removeItem(SAVED_WORDS_BROWSER_KEY)
    } else {
      localStorage.setItem(SAVED_WORDS_BROWSER_KEY, JSON.stringify(next))
    }
  } catch {
    /* ignore */
  }
}

export function setSavedWordsDiskCache(
  payload: SavedWordsDiskPayload,
  options?: { persist?: boolean },
): void {
  cache = normalizeSavedWordsDiskPayload(payload)
  if (diskActive && options?.persist !== false) schedulePersist(cache)
}

export function flushSavedWordsToDisk(): void {
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

export async function hydrateSavedWordsFromDisk(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (diskActive) return true
  if (hydratePromise) return hydratePromise

  hydratePromise = (async () => {
    try {
      const res = await fetch('/api/local-data/saved-words', { cache: 'no-store' })
      if (!res.ok) return false

      const body = (await res.json()) as SavedWordsDiskPayload & { ok?: boolean }
      let payload = normalizeSavedWordsDiskPayload(body)
      const browser = readBrowserPayload()
      let migrated = false

      if (isSavedWordsDiskPayloadEmpty(payload) && !isSavedWordsDiskPayloadEmpty(browser)) {
        payload = browser
        await persistPayloadToDisk(payload)
        clearBrowserKeys()
        migrated = true
      }

      cache = payload
      diskActive = true
      notifySavedWordsHydrated()

      if (migrated) {
        toast.success('Saved words are now stored on this PC (not only in the browser).')
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
  window.addEventListener('beforeunload', () => flushSavedWordsToDisk())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSavedWordsToDisk()
  })
}

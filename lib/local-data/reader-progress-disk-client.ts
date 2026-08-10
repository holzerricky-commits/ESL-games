'use client'

import { toast } from 'sonner'
import type { ReaderProgressMap } from '@/lib/books/types'
import {
  emptyReaderProgressDiskPayload,
  isReaderProgressDiskPayloadEmpty,
  normalizeReaderProgressDiskPayload,
  type ReaderProgressDiskPayload,
} from '@/lib/local-data/reader-progress-disk-types'

export const READER_PROGRESS_BROWSER_KEY = 'esl_book_reader_progress_v1'

const PERSIST_DEBOUNCE_MS = 300

let diskActive = false
let cache: ReaderProgressDiskPayload | null = null
let hydratePromise: Promise<boolean> | null = null
let persistTimer: ReturnType<typeof setTimeout> | null = null
let pendingPayload: ReaderProgressDiskPayload | null = null

export function isReaderProgressDiskActive(): boolean {
  return diskActive
}

export function getReaderProgressDiskCache(): ReaderProgressDiskPayload | null {
  return cache
}

function readBrowserPayload(): ReaderProgressDiskPayload {
  if (typeof window === 'undefined' && typeof localStorage === 'undefined') {
    return emptyReaderProgressDiskPayload()
  }
  try {
    const storage = typeof localStorage !== 'undefined' ? localStorage : null
    if (!storage) return emptyReaderProgressDiskPayload()
    const raw = storage.getItem(READER_PROGRESS_BROWSER_KEY)
    if (!raw) return emptyReaderProgressDiskPayload()
    return normalizeReaderProgressDiskPayload(JSON.parse(raw) as unknown)
  } catch {
    return emptyReaderProgressDiskPayload()
  }
}

function clearBrowserKeys(): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.removeItem(READER_PROGRESS_BROWSER_KEY)
  } catch {
    /* ignore */
  }
}

async function persistPayloadToDisk(payload: ReaderProgressDiskPayload): Promise<void> {
  const res = await fetch('/api/local-data/reader-progress', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `Save failed (${res.status})`)
  }
}

function schedulePersist(payload: ReaderProgressDiskPayload): void {
  pendingPayload = payload
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = null
    const next = pendingPayload
    pendingPayload = null
    if (!next) return
    void persistPayloadToDisk(next).catch((err) => {
      const msg = err instanceof Error ? err.message : 'Could not save reader progress to disk.'
      toast.error(msg)
    })
  }, PERSIST_DEBOUNCE_MS)
}

function ensureCache(): ReaderProgressDiskPayload {
  if (!cache) cache = emptyReaderProgressDiskPayload()
  return cache
}

function toReaderProgressMap(payload: ReaderProgressDiskPayload): ReaderProgressMap {
  const map: ReaderProgressMap = {}
  for (const [bookId, byUnit] of Object.entries(payload.progress)) {
    const units: ReaderProgressMap[string] = {}
    for (const [unitId, entry] of Object.entries(byUnit)) {
      const page = Number(entry.page)
      if (!Number.isFinite(page)) continue
      units[unitId] = {
        page: Math.max(1, Math.floor(page)),
        updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : new Date().toISOString(),
      }
    }
    if (Object.keys(units).length > 0) map[bookId] = units
  }
  return map
}

export function getReaderProgressMapFromDiskOrBrowser(): ReaderProgressMap {
  if (diskActive) return toReaderProgressMap(ensureCache())
  return toReaderProgressMap(readBrowserPayload())
}

export function setReaderProgressMapOnDiskOrBrowser(map: ReaderProgressMap): void {
  const next = normalizeReaderProgressDiskPayload({ progress: map })
  cache = next
  if (diskActive) {
    schedulePersist(next)
    return
  }
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(READER_PROGRESS_BROWSER_KEY, JSON.stringify(next.progress))
  } catch {
    /* ignore quota/private mode */
  }
}

export function setReaderProgressDiskCache(
  payload: ReaderProgressDiskPayload,
  options?: { persist?: boolean },
): void {
  cache = normalizeReaderProgressDiskPayload(payload)
  if (diskActive && options?.persist !== false) schedulePersist(cache)
}

export function flushReaderProgressToDisk(): void {
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

export async function hydrateReaderProgressFromDisk(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (diskActive) return true
  if (hydratePromise) return hydratePromise

  hydratePromise = (async () => {
    try {
      const res = await fetch('/api/local-data/reader-progress', { cache: 'no-store' })
      if (!res.ok) return false

      const body = (await res.json()) as ReaderProgressDiskPayload & { ok?: boolean }
      let payload = normalizeReaderProgressDiskPayload(body)
      const browser = readBrowserPayload()
      let migrated = false

      if (isReaderProgressDiskPayloadEmpty(payload) && !isReaderProgressDiskPayloadEmpty(browser)) {
        payload = browser
        await persistPayloadToDisk(payload)
        clearBrowserKeys()
        migrated = true
      }

      cache = payload
      diskActive = true

      if (migrated) {
        toast.success('Reader page positions are now saved on this PC (not only in the browser).')
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
  window.addEventListener('beforeunload', () => flushReaderProgressToDisk())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushReaderProgressToDisk()
  })
}

'use client'

import { toast } from 'sonner'
import {
  emptyBookAnnotationsDiskPayload,
  isBookAnnotationsDiskPayloadEmpty,
  mergeBrowserInkSafetyNetIntoPayload,
  normalizeBookAnnotationsDiskPayload,
  type BookAnnotationsDiskPayload,
  type BookAnnotationsDiskRoot,
} from '@/lib/local-data/book-annotations-disk-types'
import { inkSessionPersistV2Enabled } from '@/lib/books/feature-flags'
import { INK_SESSION_DISK_PERSIST_DEBOUNCE_MS } from '@/lib/books/ink-session-persist-config'

export const ANNOTATION_STORAGE_KEY_V2 = 'esl_book_annotations_v2'
export const SPREAD_SESSION_STORAGE_KEY = 'bookSpreadSessionV1'
export const WHITEBOARD_INK_SESSION_STORAGE_KEY = 'bookWhiteboardInkSessionV1'

const PERSIST_DEBOUNCE_MS = 300

function resolveDiskPersistDebounceMs(): number {
  return inkSessionPersistV2Enabled ? INK_SESSION_DISK_PERSIST_DEBOUNCE_MS : PERSIST_DEBOUNCE_MS
}

let diskActive = false
let cache: BookAnnotationsDiskPayload | null = null
let hydratePromise: Promise<boolean> | null = null
let persistTimer: ReturnType<typeof setTimeout> | null = null
let pendingPayload: BookAnnotationsDiskPayload | null = null

/** Monotonic generation for full-payload disk writes. */
let persistGeneration = 0
/** Generation of the in-flight (or last started) PUT. */
let inFlightGeneration = 0
let inFlightPromise: Promise<void> | null = null
/** Newest payload waiting for the in-flight PUT to finish. */
let queuedPersist: {
  payload: BookAnnotationsDiskPayload
  generation: number
  keepalive?: boolean
} | null = null

export const BOOK_ANNOTATIONS_HYDRATED_EVENT = 'esl-book-annotations-hydrated'

function notifyBookAnnotationsHydrated(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(BOOK_ANNOTATIONS_HYDRATED_EVENT))
}

export function isBookAnnotationsDiskActive(): boolean {
  return diskActive
}

export function getBookAnnotationsDiskCache(): BookAnnotationsDiskPayload | null {
  return cache
}

function readLocalStorageJsonObject(key: string): Record<string, unknown> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as Record<string, unknown>
  } catch {
    return {}
  }
}

function writeLocalStorageJsonObject(key: string, value: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* quota / private mode */
  }
}

function readBrowserAnnotationPayload(): BookAnnotationsDiskPayload {
  const annotationsRaw = readLocalStorageJsonObject(ANNOTATION_STORAGE_KEY_V2)
  return {
    annotations: annotationsRaw as BookAnnotationsDiskRoot,
    spreadSessions: readLocalStorageJsonObject(SPREAD_SESSION_STORAGE_KEY),
    whiteboardSessions: readLocalStorageJsonObject(WHITEBOARD_INK_SESSION_STORAGE_KEY),
  }
}

/** Sync mirror so refresh can recover ink if the PC write did not finish. */
export function mirrorInkSessionsToBrowserStorage(args: {
  annotations?: BookAnnotationsDiskRoot
  whiteboardSessions?: Record<string, unknown>
  spreadSessions?: Record<string, unknown>
}): void {
  if (args.annotations) {
    writeLocalStorageJsonObject(ANNOTATION_STORAGE_KEY_V2, args.annotations as Record<string, unknown>)
  }
  if (args.whiteboardSessions) {
    writeLocalStorageJsonObject(WHITEBOARD_INK_SESSION_STORAGE_KEY, args.whiteboardSessions)
  }
  if (args.spreadSessions) {
    writeLocalStorageJsonObject(SPREAD_SESSION_STORAGE_KEY, args.spreadSessions)
  }
}

function mirrorFullPayloadToBrowser(payload: BookAnnotationsDiskPayload): void {
  mirrorInkSessionsToBrowserStorage({
    annotations: payload.annotations,
    whiteboardSessions: payload.whiteboardSessions,
    spreadSessions: payload.spreadSessions,
  })
}

async function persistPayloadToDisk(
  payload: BookAnnotationsDiskPayload,
  options?: { keepalive?: boolean },
): Promise<void> {
  const res = await fetch('/api/local-data/book-annotations', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: options?.keepalive === true,
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `Save failed (${res.status})`)
  }
}

/**
 * Serialize full-payload PUTs. Only the newest generation may land on disk;
 * concurrent flushes queue behind the in-flight write.
 */
function enqueueDiskPersist(
  payload: BookAnnotationsDiskPayload,
  options?: { keepalive?: boolean; awaitCompletion?: boolean },
): Promise<void> {
  const generation = ++persistGeneration
  mirrorFullPayloadToBrowser(payload)

  if (inFlightPromise) {
    queuedPersist = {
      payload,
      generation,
      keepalive: options?.keepalive,
    }
    if (options?.awaitCompletion) {
      return inFlightPromise.then(() => waitForPersistIdle())
    }
    return inFlightPromise.then(() => undefined).catch(() => undefined)
  }

  return startDiskPersist(payload, generation, options)
}

async function waitForPersistIdle(): Promise<void> {
  while (inFlightPromise) {
    try {
      await inFlightPromise
    } catch {
      /* surfaced by callers that care */
    }
  }
}

function startDiskPersist(
  payload: BookAnnotationsDiskPayload,
  generation: number,
  options?: { keepalive?: boolean; awaitCompletion?: boolean },
): Promise<void> {
  inFlightGeneration = generation
  const run = (async () => {
    try {
      // Skip network if a newer generation already replaced this one in the queue.
      if (queuedPersist && queuedPersist.generation > generation) {
        return
      }
      await persistPayloadToDisk(payload, { keepalive: options?.keepalive })
    } finally {
      inFlightPromise = null
      const next = queuedPersist
      queuedPersist = null
      if (next && next.generation >= inFlightGeneration) {
        // Fire-and-follow the newest queued body (may itself queue further).
        void startDiskPersist(next.payload, next.generation, {
          keepalive: next.keepalive,
        }).catch((err) => {
          if (!options?.awaitCompletion) {
            const msg =
              err instanceof Error ? err.message : 'Could not save book annotations to disk.'
            toast.error(msg)
          }
        })
      }
    }
  })()

  inFlightPromise = run

  if (options?.awaitCompletion) {
    return run.then(() => waitForPersistIdle())
  }

  return run.catch((err) => {
    const msg = err instanceof Error ? err.message : 'Could not save book annotations to disk.'
    toast.error(msg)
  })
}

function schedulePersist(payload: BookAnnotationsDiskPayload): void {
  pendingPayload = payload
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = null
    const next = pendingPayload
    pendingPayload = null
    if (!next) return
    void enqueueDiskPersist(next)
  }, resolveDiskPersistDebounceMs())
}

function ensureCache(): BookAnnotationsDiskPayload {
  if (!cache) cache = emptyBookAnnotationsDiskPayload()
  return cache
}

/** Replace full payload (hydrate / restore / discard). Schedules disk write when active. */
export function setBookAnnotationsDiskCache(
  payload: BookAnnotationsDiskPayload,
  options?: { persist?: boolean },
): void {
  cache = normalizeBookAnnotationsDiskPayload(payload)
  mirrorFullPayloadToBrowser(cache)
  if (diskActive && options?.persist !== false) {
    schedulePersist(cache)
  }
}

export function setAnnotationsRootOnDiskCache(annotations: BookAnnotationsDiskRoot): void {
  const next = { ...ensureCache(), annotations }
  cache = next
  mirrorInkSessionsToBrowserStorage({ annotations })
  if (diskActive) schedulePersist(next)
}

export function setSpreadSessionsOnDiskCache(spreadSessions: Record<string, unknown>): void {
  const next = { ...ensureCache(), spreadSessions }
  cache = next
  mirrorInkSessionsToBrowserStorage({ spreadSessions })
  if (diskActive) schedulePersist(next)
}

export function setWhiteboardSessionsOnDiskCache(whiteboardSessions: Record<string, unknown>): void {
  const next = { ...ensureCache(), whiteboardSessions }
  cache = next
  mirrorInkSessionsToBrowserStorage({ whiteboardSessions })
  if (diskActive) schedulePersist(next)
}

export function flushBookAnnotationsToDisk(): void {
  if (!diskActive) return
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  const payload = pendingPayload ?? cache
  pendingPayload = null
  if (!payload) return
  void enqueueDiskPersist(payload, { keepalive: true })
}

/** Awaitable flush for end-class paths. */
export async function flushBookAnnotationsToDiskAsync(): Promise<void> {
  if (!diskActive) return
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  const payload = pendingPayload ?? cache
  pendingPayload = null
  if (!payload) {
    await waitForPersistIdle()
    return
  }
  await enqueueDiskPersist(payload, { awaitCompletion: true })
}

export async function hydrateBookAnnotationsFromDisk(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (diskActive) return true
  if (hydratePromise) return hydratePromise

  hydratePromise = (async () => {
    try {
      const res = await fetch('/api/local-data/book-annotations', { cache: 'no-store' })
      if (!res.ok) return false

      const body = (await res.json()) as BookAnnotationsDiskPayload & { ok?: boolean }
      let payload = normalizeBookAnnotationsDiskPayload(body)
      const browser = readBrowserAnnotationPayload()
      let migrated = false

      if (isBookAnnotationsDiskPayloadEmpty(payload) && !isBookAnnotationsDiskPayloadEmpty(browser)) {
        payload = browser
        await persistPayloadToDisk(payload)
        migrated = true
      } else {
        const merged = mergeBrowserInkSafetyNetIntoPayload(payload, browser)
        payload = merged.payload
        if (merged.changed) {
          await persistPayloadToDisk(payload)
        }
      }

      cache = payload
      diskActive = true
      // Keep browser mirrors as unload/refresh safety nets (page marks + sessions).
      mirrorFullPayloadToBrowser(payload)
      notifyBookAnnotationsHydrated()

      if (migrated) {
        toast.success('Book annotations are now saved on this PC (not only in the browser).')
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

export async function ensureBookAnnotationsHydrated(): Promise<boolean> {
  return hydrateBookAnnotationsFromDisk()
}

/** Test-only: reset module state between vitest cases. */
export function __resetBookAnnotationsDiskClientForTests(): void {
  diskActive = false
  cache = null
  hydratePromise = null
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = null
  pendingPayload = null
  persistGeneration = 0
  inFlightGeneration = 0
  inFlightPromise = null
  queuedPersist = null
}

/** Test-only: mark disk mode active without hydrating from the network. */
export function __activateBookAnnotationsDiskForTests(payload?: BookAnnotationsDiskPayload): void {
  cache = normalizeBookAnnotationsDiskPayload(payload ?? emptyBookAnnotationsDiskPayload())
  diskActive = true
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => flushBookAnnotationsToDisk())
  window.addEventListener('pagehide', () => flushBookAnnotationsToDisk())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushBookAnnotationsToDisk()
  })
}

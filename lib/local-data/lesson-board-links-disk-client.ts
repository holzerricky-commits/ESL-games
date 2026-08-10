'use client'

import { toast } from 'sonner'
import {
  emptyLessonBoardLinksDiskPayload,
  isLessonBoardLinksDiskPayloadEmpty,
  normalizeLessonBoardLinksDiskPayload,
  type LessonBoardLinksDiskPayload,
} from '@/lib/local-data/lesson-board-links-disk-types'

/** Browser key from earlier builds (bare scope → links map). */
export const LESSON_BOARD_PAGE_LINKS_BROWSER_KEY = 'lessonBoardPageLinksV1'

/** Backup / restore key (must match `esl_*` pattern). */
export const LESSON_BOARD_LINKS_BACKUP_KEY = 'esl_lesson_board_page_links_v1'

const PERSIST_DEBOUNCE_MS = 300

let diskActive = false
let cache: LessonBoardLinksDiskPayload | null = null
let hydratePromise: Promise<boolean> | null = null
let persistTimer: ReturnType<typeof setTimeout> | null = null
let pendingPayload: LessonBoardLinksDiskPayload | null = null

export function isLessonBoardLinksDiskActive(): boolean {
  return diskActive
}

export function getLessonBoardLinksDiskCache(): LessonBoardLinksDiskPayload | null {
  return cache
}

function readBrowserPayload(): LessonBoardLinksDiskPayload {
  if (typeof window === 'undefined') return emptyLessonBoardLinksDiskPayload()
  try {
    const raw = localStorage.getItem(LESSON_BOARD_PAGE_LINKS_BROWSER_KEY)
    if (!raw) return emptyLessonBoardLinksDiskPayload()
    return normalizeLessonBoardLinksDiskPayload(JSON.parse(raw) as unknown)
  } catch {
    return emptyLessonBoardLinksDiskPayload()
  }
}

function clearBrowserKeys(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(LESSON_BOARD_PAGE_LINKS_BROWSER_KEY)
  } catch {
    /* ignore */
  }
}

async function persistPayloadToDisk(payload: LessonBoardLinksDiskPayload): Promise<void> {
  const res = await fetch('/api/local-data/lesson-board-links', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `Save failed (${res.status})`)
  }
}

function schedulePersist(payload: LessonBoardLinksDiskPayload): void {
  pendingPayload = payload
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = null
    const next = pendingPayload
    pendingPayload = null
    if (!next) return
    void persistPayloadToDisk(next).catch((err) => {
      const msg = err instanceof Error ? err.message : 'Could not save board links to disk.'
      toast.error(msg)
    })
  }, PERSIST_DEBOUNCE_MS)
}

function ensureCache(): LessonBoardLinksDiskPayload {
  if (!cache) cache = emptyLessonBoardLinksDiskPayload()
  return cache
}

export function getLessonBoardLinksRoot(): Record<string, unknown[]> {
  if (diskActive) return { ...ensureCache().links }
  return { ...readBrowserPayload().links }
}

export function setLessonBoardLinksRoot(links: Record<string, unknown[]>): void {
  const next = normalizeLessonBoardLinksDiskPayload({ links })
  cache = next
  if (diskActive) {
    schedulePersist(next)
    return
  }
  if (typeof window === 'undefined') return
  try {
    // Browser fallback keeps the legacy bare-map shape.
    localStorage.setItem(LESSON_BOARD_PAGE_LINKS_BROWSER_KEY, JSON.stringify(next.links))
  } catch {
    /* ignore quota/private mode */
  }
}

export function setLessonBoardLinksDiskCache(
  payload: LessonBoardLinksDiskPayload,
  options?: { persist?: boolean },
): void {
  cache = normalizeLessonBoardLinksDiskPayload(payload)
  if (diskActive && options?.persist !== false) schedulePersist(cache)
}

/** Drop all board links for one student (e.g. when deleting the student). */
export function removeLessonBoardLinksForStudent(studentId: string): void {
  const sid = studentId.trim()
  if (!sid) return
  const prefix = `${sid}::`
  const root = diskActive ? ensureCache() : readBrowserPayload()
  const links: Record<string, unknown[]> = {}
  let changed = false
  for (const [key, value] of Object.entries(root.links)) {
    if (key.startsWith(prefix)) {
      changed = true
      continue
    }
    links[key] = value
  }
  if (!changed) return
  setLessonBoardLinksRoot(links)
}

export function flushLessonBoardLinksToDisk(): void {
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

export async function hydrateLessonBoardLinksFromDisk(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (diskActive) return true
  if (hydratePromise) return hydratePromise

  hydratePromise = (async () => {
    try {
      const res = await fetch('/api/local-data/lesson-board-links', { cache: 'no-store' })
      if (!res.ok) return false

      const body = (await res.json()) as LessonBoardLinksDiskPayload & { ok?: boolean }
      let payload = normalizeLessonBoardLinksDiskPayload(body)
      const browser = readBrowserPayload()
      let migrated = false

      if (isLessonBoardLinksDiskPayloadEmpty(payload) && !isLessonBoardLinksDiskPayloadEmpty(browser)) {
        payload = browser
        await persistPayloadToDisk(payload)
        clearBrowserKeys()
        migrated = true
      }

      cache = payload
      diskActive = true

      if (migrated) {
        toast.success('Book–board links are now saved on this PC (not only in the browser).')
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
  window.addEventListener('beforeunload', () => flushLessonBoardLinksToDisk())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushLessonBoardLinksToDisk()
  })
}

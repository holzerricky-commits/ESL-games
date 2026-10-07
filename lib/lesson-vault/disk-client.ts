'use client'

import {
  emptyLessonVaultDiskPayload,
  normalizeLessonVaultDiskPayload,
  upsertLessonVaultCard,
  type LessonVaultCard,
  type LessonVaultDiskPayload,
  type LessonVaultSaveInput,
} from '@/lib/lesson-vault/types'

const PERSIST_DEBOUNCE_MS = 300

/** Stable empty list so `useSyncExternalStore` snapshots stay referentially equal. */
export const EMPTY_LESSON_VAULT_CARDS: LessonVaultCard[] = []

let cache: LessonVaultDiskPayload = emptyLessonVaultDiskPayload()
let hydrated = false
let hydratePromise: Promise<boolean> | null = null
let persistTimer: ReturnType<typeof setTimeout> | null = null
let pendingPayload: LessonVaultDiskPayload | null = null
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

export function subscribeLessonVault(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function isLessonVaultHydrated(): boolean {
  return hydrated
}

async function persistPayloadToDisk(payload: LessonVaultDiskPayload): Promise<void> {
  const res = await fetch('/api/local-data/lesson-vault', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `Save failed (${res.status})`)
  }
}

function schedulePersist(payload: LessonVaultDiskPayload, onError?: (message: string) => void): void {
  pendingPayload = payload
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = null
    const next = pendingPayload
    pendingPayload = null
    if (!next) return
    void persistPayloadToDisk(next).catch((err) => {
      onError?.(err instanceof Error ? err.message : 'Could not save the vault to disk.')
    })
  }, PERSIST_DEBOUNCE_MS)
}

export function flushLessonVaultToDisk(): void {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  const payload = pendingPayload
  pendingPayload = null
  if (!payload) return
  void persistPayloadToDisk(payload).catch(() => {})
}

export async function hydrateLessonVaultFromDisk(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (hydrated) return true
  if (hydratePromise) return hydratePromise
  hydratePromise = (async () => {
    try {
      const res = await fetch('/api/local-data/lesson-vault', { cache: 'no-store' })
      if (!res.ok) return false
      cache = normalizeLessonVaultDiskPayload(await res.json())
      hydrated = true
      notify()
      return true
    } catch {
      return false
    } finally {
      if (!hydrated) hydratePromise = null
    }
  })()
  return hydratePromise
}

export function getLessonVaultCardsForStudent(studentId: string): LessonVaultCard[] {
  const sid = studentId.trim()
  if (!sid) return EMPTY_LESSON_VAULT_CARDS
  return cache.byStudent[sid] ?? EMPTY_LESSON_VAULT_CARDS
}

export function saveLessonVaultCard(
  studentId: string,
  input: LessonVaultSaveInput,
  onPersistError?: (message: string) => void,
): { mode: 'added' | 'updated'; card: LessonVaultCard } | null {
  const sid = studentId.trim()
  if (!sid || !hydrated) return null
  const result = upsertLessonVaultCard(getLessonVaultCardsForStudent(sid), input, {
    now: new Date().toISOString(),
    createId: () =>
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `lv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  })
  cache = { byStudent: { ...cache.byStudent, [sid]: result.cards } }
  notify()
  schedulePersist(cache, onPersistError)
  return { mode: result.mode, card: result.card }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => flushLessonVaultToDisk())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushLessonVaultToDisk()
  })
}

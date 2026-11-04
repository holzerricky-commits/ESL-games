'use client'

import {
  addNewLessonGrammarItems,
  emptyLessonGrammarDiskPayload,
  normalizeLessonGrammarDiskPayload,
  removeLessonGrammarItem,
  restoreLessonGrammarItem,
  setLessonGrammarRule,
  updateLessonGrammarItem,
  upsertLessonGrammarItem,
  type LessonGrammarDiskPayload,
  type LessonGrammarItem,
  type LessonGrammarItemPatch,
  type LessonGrammarLessonRef,
  type LessonGrammarRule,
  type LessonGrammarSaveInput,
} from '@/lib/lesson-grammar/types'

const PERSIST_DEBOUNCE_MS = 300

/** Stable empty lists so `useSyncExternalStore` snapshots stay referentially equal. */
export const EMPTY_LESSON_GRAMMAR_ITEMS: LessonGrammarItem[] = []
export const EMPTY_LESSON_GRAMMAR_RULES: LessonGrammarRule[] = []

type PersistErrorHandler = (message: string) => void

let cache: LessonGrammarDiskPayload = emptyLessonGrammarDiskPayload()
let hydrated = false
let hydratePromise: Promise<boolean> | null = null
let persistTimer: ReturnType<typeof setTimeout> | null = null
let pendingPayload: LessonGrammarDiskPayload | null = null
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

export function subscribeLessonGrammar(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function isLessonGrammarHydrated(): boolean {
  return hydrated
}

async function persistPayloadToDisk(payload: LessonGrammarDiskPayload): Promise<void> {
  const res = await fetch('/api/local-data/lesson-grammar', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `Save failed (${res.status})`)
  }
}

function schedulePersist(payload: LessonGrammarDiskPayload, onError?: PersistErrorHandler): void {
  pendingPayload = payload
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = null
    const next = pendingPayload
    pendingPayload = null
    if (!next) return
    void persistPayloadToDisk(next).catch((err) => {
      onError?.(err instanceof Error ? err.message : 'Could not save grammar to disk.')
    })
  }, PERSIST_DEBOUNCE_MS)
}

export function flushLessonGrammarToDisk(): void {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  const payload = pendingPayload
  pendingPayload = null
  if (!payload) return
  void persistPayloadToDisk(payload).catch(() => {})
}

export async function hydrateLessonGrammarFromDisk(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (hydrated) return true
  if (hydratePromise) return hydratePromise
  hydratePromise = (async () => {
    try {
      const res = await fetch('/api/local-data/lesson-grammar', { cache: 'no-store' })
      if (!res.ok) return false
      cache = normalizeLessonGrammarDiskPayload(await res.json())
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

export function getLessonGrammarItemsForStudent(studentId: string): LessonGrammarItem[] {
  const sid = studentId.trim()
  if (!sid) return EMPTY_LESSON_GRAMMAR_ITEMS
  return cache.byStudent[sid] ?? EMPTY_LESSON_GRAMMAR_ITEMS
}

export function getLessonGrammarRulesForStudent(studentId: string): LessonGrammarRule[] {
  const sid = studentId.trim()
  if (!sid) return EMPTY_LESSON_GRAMMAR_RULES
  return cache.rulesByStudent[sid] ?? EMPTY_LESSON_GRAMMAR_RULES
}

function commitItems(sid: string, items: LessonGrammarItem[], onError?: PersistErrorHandler): void {
  cache = { ...cache, byStudent: { ...cache.byStudent, [sid]: items } }
  notify()
  schedulePersist(cache, onError)
}

function createId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `lg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function saveLessonGrammarItem(
  studentId: string,
  input: LessonGrammarSaveInput,
  onPersistError?: PersistErrorHandler,
): { mode: 'added' | 'updated'; item: LessonGrammarItem } | null {
  const sid = studentId.trim()
  if (!sid || !hydrated) return null
  const result = upsertLessonGrammarItem(getLessonGrammarItemsForStudent(sid), input, {
    now: new Date().toISOString(),
    createId,
  })
  commitItems(sid, result.items, onPersistError)
  return { mode: result.mode, item: result.item }
}

/** Adds several sentences at once (e.g. AI drafts); sentences already in their lesson are skipped. */
export function saveNewLessonGrammarItems(
  studentId: string,
  inputs: readonly LessonGrammarSaveInput[],
  onPersistError?: PersistErrorHandler,
): LessonGrammarItem[] | null {
  const sid = studentId.trim()
  if (!sid || !hydrated) return null
  const result = addNewLessonGrammarItems(getLessonGrammarItemsForStudent(sid), inputs, {
    now: new Date().toISOString(),
    createId,
  })
  if (result.added.length > 0) commitItems(sid, result.items, onPersistError)
  return result.added
}

export function patchLessonGrammarItem(
  studentId: string,
  itemId: string,
  patch: LessonGrammarItemPatch,
  onPersistError?: PersistErrorHandler,
): LessonGrammarItem | null {
  const sid = studentId.trim()
  if (!sid || !hydrated) return null
  const result = updateLessonGrammarItem(getLessonGrammarItemsForStudent(sid), itemId, patch, new Date().toISOString())
  if (!result) return null
  commitItems(sid, result.items, onPersistError)
  return result.item
}

export function deleteLessonGrammarItem(
  studentId: string,
  itemId: string,
  onPersistError?: PersistErrorHandler,
): { removed: LessonGrammarItem; index: number } | null {
  const sid = studentId.trim()
  if (!sid || !hydrated) return null
  const result = removeLessonGrammarItem(getLessonGrammarItemsForStudent(sid), itemId)
  if (!result) return null
  commitItems(sid, result.items, onPersistError)
  return { removed: result.removed, index: result.index }
}

export function undoDeleteLessonGrammarItem(
  studentId: string,
  item: LessonGrammarItem,
  index: number,
  onPersistError?: PersistErrorHandler,
): boolean {
  const sid = studentId.trim()
  if (!sid || !hydrated) return false
  commitItems(sid, restoreLessonGrammarItem(getLessonGrammarItemsForStudent(sid), item, index), onPersistError)
  return true
}

export function saveLessonGrammarRule(
  studentId: string,
  ref: LessonGrammarLessonRef,
  text: string,
  onPersistError?: PersistErrorHandler,
): boolean {
  const sid = studentId.trim()
  if (!sid || !hydrated) return false
  const rules = setLessonGrammarRule(getLessonGrammarRulesForStudent(sid), ref, text, new Date().toISOString())
  cache = { ...cache, rulesByStudent: { ...cache.rulesByStudent, [sid]: rules } }
  notify()
  schedulePersist(cache, onPersistError)
  return true
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => flushLessonGrammarToDisk())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushLessonGrammarToDisk()
  })
}

'use client'

import {
  seedVaultCardsFromInteractiveVocab,
  type SeedInteractiveVocabInput,
} from '@/lib/lesson-vault/seed-from-interactive-vocab'
import {
  applyLessonVaultReviewStatuses,
  emptyLessonVaultDiskPayload,
  moveLessonVaultCardToLesson,
  normalizeLessonVaultDiskPayload,
  fillLessonVaultCardChineseIfEmpty,
  fillLessonVaultCardMeaningIfEmpty,
  patchLessonVaultCardPictureMeta,
  removeLessonVaultCard,
  restoreLessonVaultCard,
  setLessonVaultCardImage,
  updateLessonVaultCardText,
  upsertLessonVaultCard,
  type LessonVaultCard,
  type LessonVaultCardTextPatch,
  type LessonVaultReviewStatus,
  type LessonVaultDiskPayload,
  type LessonVaultPictureMetaPatch,
  type LessonVaultPictureSource,
  type LessonVaultSaveInput,
} from '@/lib/lesson-vault/types'

function createLessonVaultCardId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `lv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

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
    createId: createLessonVaultCardId,
  })
  cache = { byStudent: { ...cache.byStudent, [sid]: result.cards } }
  notify()
  schedulePersist(cache, onPersistError)
  return { mode: result.mode, card: result.card }
}

/** Prefills missing vault cards from shared Vocabulary-part interactiveVocabulary (one commit). */
export function seedLessonVaultFromInteractiveVocab(
  studentId: string,
  input: SeedInteractiveVocabInput,
  onPersistError?: (message: string) => void,
): LessonVaultCard[] | null {
  const sid = studentId.trim()
  if (!sid || !hydrated) return null
  if (input.parts.length === 0) return []
  const before = getLessonVaultCardsForStudent(sid)
  const result = seedVaultCardsFromInteractiveVocab(before, input, {
    now: new Date().toISOString(),
    createId: createLessonVaultCardId,
  })
  const unchanged =
    result.added.length === 0 &&
    result.cards.length === before.length &&
    result.cards.every((card, i) => card === before[i])
  if (unchanged) return []
  commitStudentCards(sid, result.cards, onPersistError)
  return result.added
}

export function saveLessonVaultReviewStatuses(
  studentId: string,
  updates: readonly { cardId: string; status: LessonVaultReviewStatus }[],
  onPersistError?: (message: string) => void,
): boolean {
  const sid = studentId.trim()
  if (!sid || !hydrated || updates.length === 0) return false
  const result = applyLessonVaultReviewStatuses(getLessonVaultCardsForStudent(sid), updates, new Date().toISOString())
  if (result.updated === 0) return false
  commitStudentCards(sid, result.cards, onPersistError)
  return true
}

export function updateLessonVaultCard(
  studentId: string,
  cardId: string,
  patch: LessonVaultCardTextPatch,
  onPersistError?: (message: string) => void,
): LessonVaultCard | null {
  const sid = studentId.trim()
  if (!sid || !hydrated) return null
  const result = updateLessonVaultCardText(getLessonVaultCardsForStudent(sid), cardId, patch, new Date().toISOString())
  if (!result) return null
  cache = { byStudent: { ...cache.byStudent, [sid]: result.cards } }
  notify()
  schedulePersist(cache, onPersistError)
  return result.card
}

/** Writes a gloss only when the card's meaning is still empty. */
export function fillLessonVaultCardMeaning(
  studentId: string,
  cardId: string,
  meaning: string,
  onPersistError?: (message: string) => void,
): LessonVaultCard | null {
  const sid = studentId.trim()
  if (!sid || !hydrated || !meaning.trim()) return null
  const result = fillLessonVaultCardMeaningIfEmpty(
    getLessonVaultCardsForStudent(sid),
    cardId,
    meaning,
    new Date().toISOString(),
  )
  if (!result) return null
  commitStudentCards(sid, result.cards, onPersistError)
  return result.card
}

/** Writes Simplified Chinese only when the card's chinese field is still empty. */
export function fillLessonVaultCardChinese(
  studentId: string,
  cardId: string,
  chinese: string,
  onPersistError?: (message: string) => void,
): LessonVaultCard | null {
  const sid = studentId.trim()
  if (!sid || !hydrated || !chinese.trim()) return null
  const result = fillLessonVaultCardChineseIfEmpty(
    getLessonVaultCardsForStudent(sid),
    cardId,
    chinese,
    new Date().toISOString(),
  )
  if (!result) return null
  commitStudentCards(sid, result.cards, onPersistError)
  return result.card
}

export function setLessonVaultCardPicture(
  studentId: string,
  cardId: string,
  imageUrl: string,
  onPersistError?: (message: string) => void,
  source: Exclude<LessonVaultPictureSource, ''> = 'own',
): LessonVaultCard | null {
  const sid = studentId.trim()
  if (!sid || !hydrated) return null
  const result = setLessonVaultCardImage(
    getLessonVaultCardsForStudent(sid),
    cardId,
    imageUrl,
    new Date().toISOString(),
    source,
  )
  if (!result) return null
  cache = { byStudent: { ...cache.byStudent, [sid]: result.cards } }
  notify()
  schedulePersist(cache, onPersistError)
  return result.card
}

export function patchLessonVaultCardPicture(
  studentId: string,
  cardId: string,
  patch: LessonVaultPictureMetaPatch,
  onPersistError?: (message: string) => void,
): LessonVaultCard | null {
  const sid = studentId.trim()
  if (!sid || !hydrated) return null
  const result = patchLessonVaultCardPictureMeta(getLessonVaultCardsForStudent(sid), cardId, patch)
  if (!result) return null
  commitStudentCards(sid, result.cards, onPersistError)
  return result.card
}

function commitStudentCards(sid: string, cards: LessonVaultCard[], onPersistError?: (message: string) => void): void {
  cache = { byStudent: { ...cache.byStudent, [sid]: cards } }
  notify()
  schedulePersist(cache, onPersistError)
}

export function deleteLessonVaultCard(
  studentId: string,
  cardId: string,
  onPersistError?: (message: string) => void,
): { removed: LessonVaultCard; index: number } | null {
  const sid = studentId.trim()
  if (!sid || !hydrated) return null
  const result = removeLessonVaultCard(getLessonVaultCardsForStudent(sid), cardId)
  if (!result) return null
  commitStudentCards(sid, result.cards, onPersistError)
  return { removed: result.removed, index: result.index }
}

export function undoDeleteLessonVaultCard(
  studentId: string,
  card: LessonVaultCard,
  index: number,
  onPersistError?: (message: string) => void,
): boolean {
  const sid = studentId.trim()
  if (!sid || !hydrated) return false
  commitStudentCards(sid, restoreLessonVaultCard(getLessonVaultCardsForStudent(sid), card, index), onPersistError)
  return true
}

export function moveLessonVaultCard(
  studentId: string,
  cardId: string,
  target: { lessonId: string; lessonTitle: string },
  onPersistError?: (message: string) => void,
): ReturnType<typeof moveLessonVaultCardToLesson> | null {
  const sid = studentId.trim()
  if (!sid || !hydrated) return null
  const result = moveLessonVaultCardToLesson(getLessonVaultCardsForStudent(sid), cardId, target, new Date().toISOString())
  if (result.ok) commitStudentCards(sid, result.cards, onPersistError)
  return result
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => flushLessonVaultToDisk())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushLessonVaultToDisk()
  })
}

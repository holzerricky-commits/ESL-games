import type { ReaderProgressMap } from '@/lib/books/types'

const READER_PROGRESS_KEY = 'esl_book_reader_progress_v1'

/** Debounce window for saving last-read page during rapid page turns (R1). */
export const UNIT_PAGE_SAVE_DEBOUNCE_MS = 400

export function getReaderProgressMap(): ReaderProgressMap {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(READER_PROGRESS_KEY)
    return raw ? (JSON.parse(raw) as ReaderProgressMap) : {}
  } catch {
    return {}
  }
}

export function saveReaderProgressMap(map: ReaderProgressMap): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(READER_PROGRESS_KEY, JSON.stringify(map))
}

export function getSavedUnitPage(bookId: string, unitId: string): number {
  const map = getReaderProgressMap()
  const page = map[bookId]?.[unitId]?.page ?? 1
  if (!Number.isFinite(page)) return 1
  return Math.max(1, Math.floor(page))
}

export function saveUnitPage(bookId: string, unitId: string, page: number): void {
  const normalized = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1
  const map = getReaderProgressMap()
  const byBook = map[bookId] ?? {}
  byBook[unitId] = {
    page: normalized,
    updatedAt: new Date().toISOString(),
  }
  map[bookId] = byBook
  saveReaderProgressMap(map)
}

let pendingUnitPageSaveTimer: ReturnType<typeof setTimeout> | null = null
let pendingUnitPageSave: { bookId: string; unitId: string; page: number } | null = null

/** Schedule a debounced last-page write (coalesces rapid turns). */
export function scheduleSaveUnitPage(bookId: string, unitId: string, page: number): void {
  if (typeof localStorage === 'undefined') return
  pendingUnitPageSave = { bookId, unitId, page }
  if (pendingUnitPageSaveTimer != null) clearTimeout(pendingUnitPageSaveTimer)
  pendingUnitPageSaveTimer = setTimeout(() => {
    pendingUnitPageSaveTimer = null
    const pending = pendingUnitPageSave
    pendingUnitPageSave = null
    if (pending) saveUnitPage(pending.bookId, pending.unitId, pending.page)
  }, UNIT_PAGE_SAVE_DEBOUNCE_MS)
}

/** Persist any pending last-page write immediately (overlay close, unit change). */
export function flushPendingUnitPageSave(): void {
  if (pendingUnitPageSaveTimer != null) {
    clearTimeout(pendingUnitPageSaveTimer)
    pendingUnitPageSaveTimer = null
  }
  const pending = pendingUnitPageSave
  pendingUnitPageSave = null
  if (pending) saveUnitPage(pending.bookId, pending.unitId, pending.page)
}

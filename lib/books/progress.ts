import type { ReaderProgressMap } from '@/lib/books/types'
import {
  getReaderProgressMapFromDiskOrBrowser,
  READER_PROGRESS_BROWSER_KEY,
  setReaderProgressMapOnDiskOrBrowser,
} from '@/lib/local-data/reader-progress-disk-client'

/** @deprecated Prefer disk-backed storage; kept for older references. */
export const READER_PROGRESS_KEY = READER_PROGRESS_BROWSER_KEY

/** Debounce window for saving last-read page during rapid page turns (R1). */
export const UNIT_PAGE_SAVE_DEBOUNCE_MS = 400

export function getReaderProgressMap(): ReaderProgressMap {
  if (typeof localStorage === 'undefined' && typeof window === 'undefined') return {}
  return getReaderProgressMapFromDiskOrBrowser()
}

export function saveReaderProgressMap(map: ReaderProgressMap): void {
  if (typeof localStorage === 'undefined' && typeof window === 'undefined') return
  setReaderProgressMapOnDiskOrBrowser(map)
}

export function getSavedUnitPage(bookId: string, unitId: string): number {
  const map = getReaderProgressMap()
  const page = map[bookId]?.[unitId]?.page ?? 1
  if (!Number.isFinite(page)) return 1
  return Math.max(1, Math.floor(page))
}

/** Last saved page for this book+unit, or null when nothing was stored yet. */
export function peekSavedUnitPage(bookId: string, unitId: string): number | null {
  const bid = bookId.trim()
  const uid = unitId.trim()
  if (!bid || !uid) return null
  const entry = getReaderProgressMap()[bid]?.[uid]
  if (!entry) return null
  const page = Number(entry.page)
  if (!Number.isFinite(page) || page < 1) return null
  return Math.max(1, Math.floor(page))
}

/** Most recently updated saved page for any unit in this book. */
export function getLatestSavedUnitPageForBook(
  bookId: string,
): { unitId: string; page: number; updatedAt: string } | null {
  const bid = bookId.trim()
  if (!bid) return null
  const byUnit = getReaderProgressMap()[bid]
  if (!byUnit) return null
  let best: { unitId: string; page: number; updatedAt: string; atMs: number } | null = null
  for (const [unitId, entry] of Object.entries(byUnit)) {
    const page = Number(entry.page)
    if (!Number.isFinite(page) || page < 1) continue
    const updatedAt = typeof entry.updatedAt === 'string' ? entry.updatedAt : ''
    const atMs = updatedAt ? Date.parse(updatedAt) : Number.NaN
    const t = Number.isFinite(atMs) ? atMs : 0
    if (!best || t >= best.atMs) {
      best = {
        unitId,
        page: Math.max(1, Math.floor(page)),
        updatedAt: updatedAt || new Date(0).toISOString(),
        atMs: t,
      }
    }
  }
  if (!best) return null
  return { unitId: best.unitId, page: best.page, updatedAt: best.updatedAt }
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
  if (typeof localStorage === 'undefined' && typeof window === 'undefined') return
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

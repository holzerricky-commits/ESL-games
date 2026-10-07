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

export type SavedUnitPageEntry = {
  bookId: string
  unitId: string
  page: number
  updatedAt: string
  atMs: number
}

function savedEntryFromMap(
  bookId: string,
  unitId: string,
  entry: { page?: unknown; updatedAt?: unknown } | null | undefined,
): SavedUnitPageEntry | null {
  const bid = bookId.trim()
  const uid = unitId.trim()
  if (!bid || !uid || !entry) return null
  const page = Number(entry.page)
  if (!Number.isFinite(page) || page < 1) return null
  const updatedAt = typeof entry.updatedAt === 'string' ? entry.updatedAt : ''
  const parsed = updatedAt ? Date.parse(updatedAt) : Number.NaN
  return {
    bookId: bid,
    unitId: uid,
    page: Math.max(1, Math.floor(page)),
    updatedAt: updatedAt || new Date(0).toISOString(),
    atMs: Number.isFinite(parsed) ? parsed : 0,
  }
}

/** Last saved page for this book+unit, with timestamp, or null when nothing was stored yet. */
export function peekSavedUnitPageEntry(bookId: string, unitId: string): SavedUnitPageEntry | null {
  const bid = bookId.trim()
  const uid = unitId.trim()
  if (!bid || !uid) return null
  return savedEntryFromMap(bid, uid, getReaderProgressMap()[bid]?.[uid])
}

/** Last saved page for this book+unit, or null when nothing was stored yet. */
export function peekSavedUnitPage(bookId: string, unitId: string): number | null {
  return peekSavedUnitPageEntry(bookId, unitId)?.page ?? null
}

/** Most recently updated saved page for any unit in this book. */
export function getLatestSavedUnitPageForBook(
  bookId: string,
): { unitId: string; page: number; updatedAt: string } | null {
  const bid = bookId.trim()
  if (!bid) return null
  const byUnit = getReaderProgressMap()[bid]
  if (!byUnit) return null
  let best: SavedUnitPageEntry | null = null
  for (const [unitId, entry] of Object.entries(byUnit)) {
    const hit = savedEntryFromMap(bid, unitId, entry)
    if (!hit) continue
    if (!best || hit.atMs >= best.atMs) best = hit
  }
  if (!best) return null
  return { unitId: best.unitId, page: best.page, updatedAt: best.updatedAt }
}

/** Most recently updated saved page among these books (any unit). */
export function getLatestSavedUnitPageForBooks(bookIds: string[]): SavedUnitPageEntry | null {
  let best: SavedUnitPageEntry | null = null
  for (const raw of bookIds) {
    const bookId = raw.trim()
    if (!bookId) continue
    const hit = getLatestSavedUnitPageForBook(bookId)
    if (!hit) continue
    const parsed = Date.parse(hit.updatedAt)
    const atMs = Number.isFinite(parsed) ? parsed : 0
    if (!best || atMs >= best.atMs) {
      best = {
        bookId,
        unitId: hit.unitId,
        page: hit.page,
        updatedAt: hit.updatedAt,
        atMs,
      }
    }
  }
  return best
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

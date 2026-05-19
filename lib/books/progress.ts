import type { ReaderProgressMap } from '@/lib/books/types'

const READER_PROGRESS_KEY = 'esl_book_reader_progress_v1'

export function getReaderProgressMap(): ReaderProgressMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(READER_PROGRESS_KEY)
    return raw ? (JSON.parse(raw) as ReaderProgressMap) : {}
  } catch {
    return {}
  }
}

export function saveReaderProgressMap(map: ReaderProgressMap): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(READER_PROGRESS_KEY, JSON.stringify(map))
}

export function getSavedUnitPage(bookId: string, unitId: string): number {
  const map = getReaderProgressMap()
  const page = map[bookId]?.[unitId]?.page ?? 1
  if (!Number.isFinite(page)) return 1
  return Math.max(1, Math.floor(page))
}

export function getSavedUnitPageIfPresent(bookId: string, unitId: string): number | null {
  const map = getReaderProgressMap()
  const page = map[bookId]?.[unitId]?.page
  if (!Number.isFinite(page)) return null
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

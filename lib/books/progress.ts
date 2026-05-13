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
  const page = getSavedUnitProgress(bookId, unitId)?.page ?? 1
  if (!Number.isFinite(page)) return 1
  return Math.max(1, Math.floor(page))
}

export function getSavedUnitProgress(bookId: string, unitId: string): { page: number; updatedAt: string } | null {
  const entry = getReaderProgressMap()[bookId]?.[unitId]
  if (!entry || !Number.isFinite(entry.page) || typeof entry.updatedAt !== 'string') return null
  return {
    page: Math.max(1, Math.floor(entry.page)),
    updatedAt: entry.updatedAt,
  }
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

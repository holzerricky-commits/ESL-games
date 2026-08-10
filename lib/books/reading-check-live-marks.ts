/** Soft local log of in-class reading-check marks (Phase 7). Not wired to student knowledge yet. */

import {
  countUsableReadingCheckStops,
  type ReadingCheckPack,
} from '@/lib/books/reading-check-pack'

export type ReadingCheckLiveMarkResult = 'correct' | 'incorrect' | 'skip'

export interface ReadingCheckLiveMarkEntry {
  storyId: string
  stopId: string
  result: ReadingCheckLiveMarkResult
  markedAt: string
  studentId?: string | null
  bookId?: string | null
  /** Live class session id when marked during a lesson. */
  classSessionId?: string | null
  selectedAnswer?: string | null
  correctAnswer?: string | null
}

export interface ReadingCheckClassWrapSummary {
  attempted: number
  correct: number
  incorrect: number
  skip: number
  /** Distinct story ids with at least one mark this class. */
  storyIds: string[]
  /**
   * Usable stop count for the single story when exactly one story was marked
   * and a pack total is known; otherwise null.
   */
  totalInPack: number | null
}

const STORAGE_KEY = 'reading-check-live-marks-v1'
const MAX_ENTRIES = 200

/** In-memory fallback when localStorage is unavailable (tests / private mode). */
let memoryStore: ReadingCheckLiveMarkEntry[] = []

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function isValidEntry(row: unknown): row is ReadingCheckLiveMarkEntry {
  return (
    !!row &&
    typeof row === 'object' &&
    typeof (row as ReadingCheckLiveMarkEntry).storyId === 'string' &&
    typeof (row as ReadingCheckLiveMarkEntry).stopId === 'string' &&
    typeof (row as ReadingCheckLiveMarkEntry).result === 'string' &&
    typeof (row as ReadingCheckLiveMarkEntry).markedAt === 'string'
  )
}

export function listReadingCheckLiveMarks(): ReadingCheckLiveMarkEntry[] {
  if (canUseStorage()) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return [...memoryStore]
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) return [...memoryStore]
      const fromDisk = parsed.filter(isValidEntry)
      memoryStore = fromDisk
      return [...fromDisk]
    } catch {
      return [...memoryStore]
    }
  }
  return [...memoryStore]
}

export function appendReadingCheckLiveMark(
  entry: Omit<ReadingCheckLiveMarkEntry, 'markedAt'> & { markedAt?: string },
): ReadingCheckLiveMarkEntry {
  const next: ReadingCheckLiveMarkEntry = {
    storyId: entry.storyId.trim(),
    stopId: entry.stopId.trim(),
    result: entry.result,
    markedAt: entry.markedAt?.trim() || new Date().toISOString(),
    studentId: entry.studentId?.trim() || null,
    bookId: entry.bookId?.trim() || null,
    classSessionId: entry.classSessionId?.trim() || null,
    selectedAnswer: entry.selectedAnswer?.trim() || null,
    correctAnswer: entry.correctAnswer?.trim() || null,
  }
  if (!next.storyId || !next.stopId) return next

  const merged = [...listReadingCheckLiveMarks(), next].slice(-MAX_ENTRIES)
  memoryStore = merged
  if (canUseStorage()) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
    } catch {
      // ignore quota / private mode — memory still holds the mark
    }
  }
  return next
}

/** Latest mark for a stop (if any). */
export function latestReadingCheckLiveMarkForStop(
  storyId: string,
  stopId: string,
): ReadingCheckLiveMarkEntry | null {
  const sid = storyId.trim()
  const stop = stopId.trim()
  if (!sid || !stop) return null
  const matches = listReadingCheckLiveMarks().filter((m) => m.storyId === sid && m.stopId === stop)
  return matches[matches.length - 1] ?? null
}

/**
 * Summarize marks for one class. Latest result per stop wins.
 * When exactly one story appears and its pack is provided, `totalInPack` is set.
 */
export function summarizeReadingCheckLiveMarksForClass(opts: {
  classSessionId: string
  studentId?: string | null
  packsByStoryId?: Record<string, ReadingCheckPack | null | undefined>
}): ReadingCheckClassWrapSummary {
  const classSessionId = opts.classSessionId.trim()
  const studentId = opts.studentId?.trim() || null
  const empty: ReadingCheckClassWrapSummary = {
    attempted: 0,
    correct: 0,
    incorrect: 0,
    skip: 0,
    storyIds: [],
    totalInPack: null,
  }
  if (!classSessionId) return empty

  const latestByStop = new Map<string, ReadingCheckLiveMarkEntry>()
  for (const m of listReadingCheckLiveMarks()) {
    if ((m.classSessionId?.trim() || '') !== classSessionId) continue
    if (studentId && (m.studentId?.trim() || '') !== studentId) continue
    const key = `${m.storyId}\0${m.stopId}`
    latestByStop.set(key, m)
  }

  let correct = 0
  let incorrect = 0
  let skip = 0
  const storyIdSet = new Set<string>()
  for (const m of latestByStop.values()) {
    storyIdSet.add(m.storyId)
    if (m.result === 'correct') correct++
    else if (m.result === 'incorrect') incorrect++
    else if (m.result === 'skip') skip++
  }

  const storyIds = [...storyIdSet].sort()
  let totalInPack: number | null = null
  if (storyIds.length === 1) {
    const pack = opts.packsByStoryId?.[storyIds[0]]
    const total = countUsableReadingCheckStops(pack)
    if (total > 0) totalInPack = total
  }

  return {
    attempted: latestByStop.size,
    correct,
    incorrect,
    skip,
    storyIds,
    totalInPack,
  }
}

/** Short teacher-facing / wrap line. Empty when nothing was attempted. */
export function formatReadingCheckWrapLine(summary: ReadingCheckClassWrapSummary): string | undefined {
  if (summary.attempted <= 0) return undefined
  const parts: string[] = []
  if (summary.totalInPack != null && summary.totalInPack > 0) {
    parts.push(`${summary.attempted}/${summary.totalInPack}`)
  } else {
    parts.push(`${summary.attempted} check${summary.attempted === 1 ? '' : 's'}`)
  }
  parts.push(`${summary.correct} right`)
  if (summary.incorrect > 0) parts.push(`${summary.incorrect} miss`)
  if (summary.skip > 0) parts.push(`${summary.skip} skip`)
  return `Checks: ${parts.join(' · ')}`
}

/** Test / reset helper. */
export function clearReadingCheckLiveMarksForTests(): void {
  memoryStore = []
  if (canUseStorage()) {
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }
}

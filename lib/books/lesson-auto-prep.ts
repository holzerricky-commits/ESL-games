import type { StudentClassStatus } from '@/lib/types'

/** Prep lessons for classes starting within this window. */
export const LESSON_AUTO_PREP_WINDOW_MS = 24 * 60 * 60 * 1000
/** Don't retry the same lesson sooner than this, even if the last run left steps to look at. */
export const LESSON_AUTO_PREP_RETRY_MS = 6 * 60 * 60 * 1000

const ATTEMPTS_STORAGE_KEY = 'lesson-auto-prep:attempts'

export interface LessonAutoPrepCandidate {
  sessionId: string
  studentName: string
  scheduledFor: string
  status: StudentClassStatus
  bookId: string
  unitId: string
  lessonId: string
}

export interface LessonAutoPrepTarget {
  key: string
  bookId: string
  unitId: string
  lessonId: string
  scheduledFor: string
  studentName: string
}

export function lessonAutoPrepKey(bookId: string, unitId: string, lessonId: string): string {
  return `${bookId}::${unitId}::${lessonId}`
}

/** Upcoming lessons to prep, soonest class first, one entry per lesson. */
export function pickLessonsToAutoPrep(
  candidates: readonly LessonAutoPrepCandidate[],
  nowMs: number,
  lastAttemptByKey: Readonly<Record<string, number>>,
  options?: { windowMs?: number; retryMs?: number },
): LessonAutoPrepTarget[] {
  const windowMs = options?.windowMs ?? LESSON_AUTO_PREP_WINDOW_MS
  const retryMs = options?.retryMs ?? LESSON_AUTO_PREP_RETRY_MS
  const byKey = new Map<string, LessonAutoPrepTarget & { startMs: number }>()

  for (const c of candidates) {
    if (c.status !== 'planned' && c.status !== 'prepared') continue
    const startMs = Date.parse(c.scheduledFor)
    if (!Number.isFinite(startMs) || startMs <= nowMs || startMs - nowMs > windowMs) continue
    const key = lessonAutoPrepKey(c.bookId, c.unitId, c.lessonId)
    const last = lastAttemptByKey[key]
    if (typeof last === 'number' && nowMs - last < retryMs) continue
    const existing = byKey.get(key)
    if (existing && existing.startMs <= startMs) continue
    byKey.set(key, {
      key,
      bookId: c.bookId,
      unitId: c.unitId,
      lessonId: c.lessonId,
      scheduledFor: c.scheduledFor,
      studentName: c.studentName,
      startMs,
    })
  }

  return [...byKey.values()]
    .sort((a, b) => a.startMs - b.startMs)
    .map(({ startMs: _startMs, ...target }) => target)
}

export function readLessonAutoPrepAttempts(): Record<string, number> {
  if (typeof window === 'undefined') return {}
  try {
    const parsed = JSON.parse(localStorage.getItem(ATTEMPTS_STORAGE_KEY) ?? '{}') as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const out: Record<string, number> = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'number' && Number.isFinite(value)) out[key] = value
    }
    return out
  } catch {
    return {}
  }
}

/** Remember an attempt; entries older than a day are dropped so storage stays small. */
export function recordLessonAutoPrepAttempt(key: string, nowMs: number = Date.now()): void {
  if (typeof window === 'undefined') return
  const next: Record<string, number> = {}
  for (const [k, t] of Object.entries(readLessonAutoPrepAttempts())) {
    if (nowMs - t < LESSON_AUTO_PREP_WINDOW_MS) next[k] = t
  }
  next[key] = nowMs
  try {
    localStorage.setItem(ATTEMPTS_STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore quota */
  }
}

import type { StudentClassSession, StudentClassStatus } from '@/lib/types'

const RECAP_MAX = 140
const REVIEW_WORD_CAP = 3
const STREAK_SHOW_MIN = 2

const TERMINAL: StudentClassStatus[] = ['completed', 'missed', 'cancelled']

function sessionSortTime(session: StudentClassSession): number {
  const ended = session.classEndedAt ? Date.parse(session.classEndedAt) : NaN
  if (Number.isFinite(ended)) return ended
  const scheduled = Date.parse(session.scheduledFor)
  return Number.isFinite(scheduled) ? scheduled : 0
}

function newestFirst(sessions: StudentClassSession[]): StudentClassSession[] {
  return [...sessions].sort((a, b) => sessionSortTime(b) - sessionSortTime(a) || a.id.localeCompare(b.id))
}

/** Consecutive completed classes from the newest terminal class. Missed/cancelled breaks it. */
export function classroomHomeCompletedStreak(sessions: StudentClassSession[]): number {
  const terminal = newestFirst(sessions.filter((session) => TERMINAL.includes(session.status)))
  let streak = 0
  for (const session of terminal) {
    if (session.status !== 'completed') break
    streak += 1
  }
  return streak
}

export function classroomHomeShouldShowStreak(streak: number): boolean {
  return streak >= STREAK_SHOW_MIN
}

export interface ClassroomHomeLastTime {
  recap: string | null
  reviewWords: string[]
}

export function classroomHomeLastTime(input: {
  sessions: StudentClassSession[]
  currentSessionId?: string | null
  needsPracticeWords?: string[] | null
}): ClassroomHomeLastTime | null {
  const previous = newestFirst(
    input.sessions.filter(
      (session) => session.status === 'completed' && session.id !== input.currentSessionId,
    ),
  )[0]
  const recapRaw = previous?.classEndNote?.trim() ?? ''
  const recap = recapRaw ? (recapRaw.length > RECAP_MAX ? `${recapRaw.slice(0, RECAP_MAX - 1).trimEnd()}…` : recapRaw) : null
  const reviewWords: string[] = []
  const seen = new Set<string>()
  for (const raw of input.needsPracticeWords ?? []) {
    const word = raw.trim()
    if (!word) continue
    const key = word.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    reviewWords.push(word)
    if (reviewWords.length >= REVIEW_WORD_CAP) break
  }
  if (!recap && reviewWords.length === 0) return null
  return { recap, reviewWords }
}

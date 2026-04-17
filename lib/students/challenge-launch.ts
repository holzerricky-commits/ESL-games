export type TimedChallengeLaunchMode = 'challenge'

export interface TimedChallengeLaunchParams {
  mode: TimedChallengeLaunchMode
  quizId: string
  studentId?: string
  studentName?: string
  /** Same-origin path to navigate to when leaving setup without starting (e.g. fullscreen map). */
  returnTo?: string
}

export const TIMED_CHALLENGE_ROUTE = '/games/timed-challenge'

/** Allow only in-app paths to avoid open redirects via `returnTo`. */
export function sanitizeTimedChallengeReturnTo(raw: string | null): string | null {
  if (raw == null) return null
  const trimmed = raw.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return null
  if (!/^\/students\/[^/]+\/map$/.test(trimmed)) return null
  return trimmed
}

export function buildTimedChallengeLaunchHref(params: TimedChallengeLaunchParams): string {
  const query = new URLSearchParams()
  query.set('mode', params.mode)
  query.set('quizId', params.quizId)
  if (params.studentId) query.set('studentId', params.studentId)
  if (params.studentName) query.set('studentName', params.studentName)
  if (params.returnTo) query.set('returnTo', params.returnTo)
  return `${TIMED_CHALLENGE_ROUTE}?${query.toString()}`
}

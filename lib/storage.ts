import type { Quiz, StudentResult, AnimationSettings, KnownStudentSummary } from './types'

const QUIZZES_KEY = 'esl_quizzes'
const RESULTS_KEY = 'esl_student_results'
const ANIMATION_SETTINGS_KEY = 'esl_animation_settings'
const DEFAULT_CHALLENGE_QUESTION_COUNT = 6

function normalizeChallengeQuestionCount(rawCount: unknown, questionCount: number): number {
  const fallback = Math.max(1, Math.min(DEFAULT_CHALLENGE_QUESTION_COUNT, questionCount || DEFAULT_CHALLENGE_QUESTION_COUNT))
  const parsed = typeof rawCount === 'number' ? rawCount : Number(rawCount)
  if (!Number.isFinite(parsed)) return fallback
  const rounded = Math.floor(parsed)
  return Math.max(1, Math.min(rounded, Math.max(1, questionCount)))
}

export const DEFAULT_ANIMATION_SETTINGS: AnimationSettings = {
  success: 'gentle-sparkles',
  perfect: 'fireworks-celebration',
  fail: 'warm-encouragement',
}

/** Map legacy localStorage ids to presets implemented in play-mode. */
const ANIMATION_PRESET_ALIASES: Record<string, string> = {
  'fireworks-explosion': 'fireworks-celebration',
  'confetti-burst': 'gentle-sparkles',
  'gentle-bounce': 'warm-encouragement',
  'oops-moments': 'warm-encouragement',
}

function normalizeAnimationSettings(settings: AnimationSettings): AnimationSettings {
  const mapId = (id: string) => ANIMATION_PRESET_ALIASES[id] ?? id
  return {
    success: mapId(settings.success),
    perfect: mapId(settings.perfect),
    fail: mapId(settings.fail),
  }
}

export function getQuizzes(): Quiz[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(QUIZZES_KEY)
    const quizzes = raw ? (JSON.parse(raw) as Quiz[]) : []
    return quizzes.map((quiz) => ({
      ...quiz,
      challengeQuestionCount: normalizeChallengeQuestionCount(
        (quiz as Partial<Quiz>).challengeQuestionCount,
        quiz.questions.length,
      ),
    }))
  } catch {
    return []
  }
}

export function saveQuiz(quiz: Quiz): void {
  const quizzes = getQuizzes()
  const idx = quizzes.findIndex((q) => q.id === quiz.id)
  if (idx >= 0) {
    quizzes[idx] = quiz
  } else {
    quizzes.push(quiz)
  }
  localStorage.setItem(QUIZZES_KEY, JSON.stringify(quizzes))
}

export function deleteQuiz(id: string): void {
  const quizzes = getQuizzes().filter((q) => q.id !== id)
  localStorage.setItem(QUIZZES_KEY, JSON.stringify(quizzes))
}

export function getStudentResults(): StudentResult[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(RESULTS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/** Unique student names from results, sorted by most recent activity (matches Student Results). */
export function getKnownStudentSummaries(): KnownStudentSummary[] {
  const results = getStudentResults()
  const map = new Map<string, { lastDate: string; totalQuizzes: number }>()
  for (const r of results) {
    const existing = map.get(r.studentName)
    if (existing) {
      existing.totalQuizzes += 1
      if (r.completedAt > existing.lastDate) existing.lastDate = r.completedAt
    } else {
      map.set(r.studentName, { lastDate: r.completedAt, totalQuizzes: 1 })
    }
  }
  return Array.from(map.entries())
    .map(([name, v]) => ({ name, lastDate: v.lastDate, totalQuizzes: v.totalQuizzes }))
    .sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime())
}

export function saveStudentResult(result: StudentResult): void {
  const results = getStudentResults()
  results.push(result)
  localStorage.setItem(RESULTS_KEY, JSON.stringify(results))
}

export function getAnimationSettings(): AnimationSettings {
  if (typeof window === 'undefined') return DEFAULT_ANIMATION_SETTINGS
  try {
    const raw = localStorage.getItem(ANIMATION_SETTINGS_KEY)
    const merged = raw
      ? { ...DEFAULT_ANIMATION_SETTINGS, ...JSON.parse(raw) }
      : DEFAULT_ANIMATION_SETTINGS
    return normalizeAnimationSettings(merged)
  } catch {
    return DEFAULT_ANIMATION_SETTINGS
  }
}

export function saveAnimationSettings(settings: AnimationSettings): void {
  localStorage.setItem(ANIMATION_SETTINGS_KEY, JSON.stringify(settings))
}

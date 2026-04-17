import { buildChallengeCatalogForQuizIds } from '@/lib/challenges'
import { normalizeStudentKey } from '@/lib/students/identity'
import { getStudentResults, getStudents, getQuizzes } from '@/lib/storage'
import type { DifficultyTier, Quiz, StudentResult } from '@/lib/types'
import { getTiersWithQuestions, resolveInitialPlayTier } from '@/lib/quiz-difficulty'

/** Coin multipliers vs Easy — shown on locked tiers as motivation. */
export const TIER_COIN_MULTIPLIER: Record<DifficultyTier, number> = {
  easy: 1,
  mid: 1.15,
  hard: 1.35,
}

export function tierCoinRewardDisplay(baseCoins: number, tier: DifficultyTier): number {
  return Math.max(0, Math.round(baseCoins * TIER_COIN_MULTIPLIER[tier]))
}

export function computePassThresholdForQuiz(quiz: Quiz, totalQuestions: number): number {
  return quiz.passThreshold === 0 ? totalQuestions : quiz.passThreshold
}

function resultTier(r: StudentResult): DifficultyTier {
  return r.difficultyTier ?? 'mid'
}

function resultPassed(r: StudentResult, quiz: Quiz): boolean {
  if (r.passedChallenge !== undefined) return r.passedChallenge
  const need = computePassThresholdForQuiz(quiz, r.totalQuestions || 1)
  return r.score >= need
}

/**
 * Whether this student passed challenge mode on `tier` for this quiz (saved results only).
 */
export function hasPassedChallengeTier(
  results: StudentResult[],
  quizId: string,
  studentKey: string,
  tier: DifficultyTier,
  quiz: Quiz,
): boolean {
  return results.some(
    (r) =>
      r.quizId === quizId &&
      normalizeStudentKey(r.studentName) === studentKey &&
      resultTier(r) === tier &&
      resultPassed(r, quiz),
  )
}

/**
 * Ordered tiers that have questions; first is always playable in challenge once identity is known.
 */
export function getUnlockedTiersForChallenge(quiz: Quiz, studentKey: string): DifficultyTier[] {
  const progression = getTiersWithQuestions(quiz)
  if (progression.length === 0) return []
  const results = getStudentResults()
  const unlocked: DifficultyTier[] = []
  for (let i = 0; i < progression.length; i += 1) {
    const tier = progression[i]!
    if (i === 0) {
      unlocked.push(tier)
      continue
    }
    const prev = progression[i - 1]!
    if (hasPassedChallengeTier(results, quiz.id, studentKey, prev, quiz)) {
      unlocked.push(tier)
    }
  }
  return unlocked
}

export function resolveChallengePlayTier(
  quiz: Quiz,
  preferred: DifficultyTier,
  studentKey: string | null,
): DifficultyTier {
  if (!studentKey) {
    return resolveInitialPlayTier(quiz, preferred)
  }
  const unlocked = getUnlockedTiersForChallenge(quiz, studentKey)
  const available = getTiersWithQuestions(quiz)
  if (unlocked.length === 0 || available.length === 0) {
    return resolveInitialPlayTier(quiz, preferred)
  }
  if (unlocked.includes(preferred)) return preferred
  return unlocked[0]!
}

/** Base coin reward for this quiz on the student path (default when not on a path). */
export function getChallengeCoinRewardForQuiz(quizId: string, studentKey: string): number {
  const students = getStudents()
  const student = students.find((s) => normalizeStudentKey(s.name) === studentKey)
  const ids = student?.assignedQuizIds
  if (!Array.isArray(ids) || ids.length === 0) return 100
  const catalog = buildChallengeCatalogForQuizIds(ids, getQuizzes())
  const def = catalog.find((c) => c.quizId === quizId)
  return def?.coinReward ?? 100
}

export function isTierLockedForChallenge(
  quiz: Quiz,
  tier: DifficultyTier,
  studentKey: string | null,
): boolean {
  const withContent = getTiersWithQuestions(quiz)
  if (!withContent.includes(tier)) return false
  if (!studentKey) return false
  const unlocked = getUnlockedTiersForChallenge(quiz, studentKey)
  return !unlocked.includes(tier)
}

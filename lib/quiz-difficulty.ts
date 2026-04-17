import type { DifficultyTier, Quiz, QuizQuestion } from '@/lib/types'

export const DIFFICULTY_TIERS: DifficultyTier[] = ['easy', 'mid', 'hard']

export const DIFFICULTY_TIER_LABELS: Record<DifficultyTier, string> = {
  easy: 'Easy',
  mid: 'Mid',
  hard: 'Hard',
}

/** Default play tier when none chosen (legacy quizzes used a single pool). */
export const DEFAULT_PLAY_TIER: DifficultyTier = 'mid'

export function emptyQuestionsByTier(): Record<DifficultyTier, QuizQuestion[]> {
  return { easy: [], mid: [], hard: [] }
}

/**
 * Normalize loaded quiz: migrate legacy `questions` into `questionsByTier.mid` when needed.
 */
export function normalizeQuizQuestions(quiz: Quiz): Quiz {
  const byTier = quiz.questionsByTier
  const hasAnyTierContent =
    byTier && DIFFICULTY_TIERS.some((t) => (byTier[t]?.length ?? 0) > 0)
  if (hasAnyTierContent) {
    return quiz
  }
  if (quiz.questions?.length) {
    return {
      ...quiz,
      questionsByTier: {
        easy: [],
        mid: [...quiz.questions],
        hard: [],
      },
    }
  }
  return {
    ...quiz,
    questionsByTier: { easy: [], mid: [], hard: [] },
  }
}

/** Questions for a tier; legacy single-pool quizzes resolve to mid. */
export function getQuizQuestionsForTier(quiz: Quiz, tier: DifficultyTier = DEFAULT_PLAY_TIER): QuizQuestion[] {
  const normalized = quiz.questionsByTier ? quiz : normalizeQuizQuestions(quiz)
  const byTier = normalized.questionsByTier
  if (byTier?.[tier]?.length) return byTier[tier]!
  if (tier === DEFAULT_PLAY_TIER && quiz.questions?.length) return quiz.questions
  return byTier?.[tier] ?? []
}

export function getTotalQuestionCountAcrossTiers(quiz: Quiz): number {
  const n = normalizeQuizQuestions(quiz)
  let sum = 0
  for (const t of DIFFICULTY_TIERS) {
    sum += n.questionsByTier?.[t]?.length ?? 0
  }
  return sum
}

/** First question image/word for card previews (any tier). */
export function getFirstQuizQuestionPreview(quiz: Quiz): QuizQuestion | undefined {
  const n = normalizeQuizQuestions(quiz)
  for (const t of DIFFICULTY_TIERS) {
    const p = n.questionsByTier?.[t]
    if (p?.[0]) return p[0]
  }
  return quiz.questions?.[0]
}

/**
 * Pool for play: preferred tier, or first non-empty tier (so Easy-only quizzes still run).
 */
export function getQuizQuestionsForPlay(quiz: Quiz, tier: DifficultyTier = DEFAULT_PLAY_TIER): QuizQuestion[] {
  const direct = getQuizQuestionsForTier(quiz, tier)
  if (direct.length > 0) return direct
  for (const t of DIFFICULTY_TIERS) {
    const p = getQuizQuestionsForTier(quiz, t)
    if (p.length > 0) return p
  }
  return []
}

/** Tiers that have at least one question (for picker availability). */
export function getTiersWithQuestions(quiz: Quiz): DifficultyTier[] {
  return DIFFICULTY_TIERS.filter((t) => getQuizQuestionsForTier(quiz, t).length > 0)
}

/** Prefer `preferred` if it has a bank; otherwise first tier that has questions. */
export function resolveInitialPlayTier(quiz: Quiz, preferred: DifficultyTier): DifficultyTier {
  const available = getTiersWithQuestions(quiz)
  if (available.length === 0) return preferred
  if (available.includes(preferred)) return preferred
  return available[0]!
}

export function cloneQuestionsWithNewIds(questions: QuizQuestion[]): QuizQuestion[] {
  return questions.map((q) => ({
    ...q,
    id: `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`,
  }))
}

/** Persist shape: tier banks + legacy `questions` mirror of mid for older code paths. */
export function quizPayloadForSave(
  base: Omit<Quiz, 'questions' | 'questionsByTier'>,
  questionsByTier: Record<DifficultyTier, QuizQuestion[]>,
): Quiz {
  const mid = questionsByTier.mid.map(({ resolvedPreviewUrl: _r, ...rest }) => rest)
  return {
    ...base,
    questionsByTier: {
      easy: questionsByTier.easy.map(({ resolvedPreviewUrl: _r, ...rest }) => rest),
      mid,
      hard: questionsByTier.hard.map(({ resolvedPreviewUrl: _r, ...rest }) => rest),
    },
    questions: mid,
  }
}

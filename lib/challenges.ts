import type { ChallengeDefinition, Quiz } from '@/lib/types'

const DEFAULT_PASS_THRESHOLD_PCT = 70

function rewardForOrder(order: number): number {
  if (order <= 3) return 100
  if (order <= 6) return 150
  return 200
}

function partLabelForQuiz(quiz: Quiz): string {
  if (quiz.partLabel?.trim()) return quiz.partLabel.trim()
  if (quiz.partIndex && quiz.partIndex > 0) return `Part ${quiz.partIndex}`
  return 'Part 1'
}

function challengeTitleForQuiz(quiz: Quiz, fallbackOrder: number): string {
  const quizName = quiz.name?.trim()
  if (quizName) return quizName
  const series = quiz.seriesTitle?.trim()
  if (!series) return `Challenge ${fallbackOrder}`
  return `${series} · ${partLabelForQuiz(quiz)}`
}

function challengeDescriptionForQuiz(quiz: Quiz): string {
  const series = quiz.seriesTitle?.trim()
  if (!series) return `Complete ${quiz.name} to unlock the next challenge.`
  return `Complete ${partLabelForQuiz(quiz)} in ${series} to unlock the next part.`
}

export function buildChallengeCatalog(quizzes: Quiz[]): ChallengeDefinition[] {
  return [...quizzes]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((quiz, index) => ({
      id: `challenge-${quiz.id}`,
      order: index + 1,
      title: challengeTitleForQuiz(quiz, index + 1),
      description: challengeDescriptionForQuiz(quiz),
      quizId: quiz.id,
      coinReward: rewardForOrder(index + 1),
      passThreshold: DEFAULT_PASS_THRESHOLD_PCT,
      isActive: true,
    }))
}

/**
 * Build challenge definitions only for quizzes the teacher assigned, in order.
 * Unknown quiz IDs are skipped; rewards/threshold follow position on the path.
 */
export function buildChallengeCatalogForQuizIds(orderedQuizIds: string[], quizzes: Quiz[]): ChallengeDefinition[] {
  const byId = new Map(quizzes.map((q) => [q.id, q]))
  const ordered: Quiz[] = []
  for (const id of orderedQuizIds) {
    const quiz = byId.get(id)
    if (quiz) ordered.push(quiz)
  }
  return ordered.map((quiz, index) => ({
    id: `challenge-${quiz.id}`,
    order: index + 1,
    title: challengeTitleForQuiz(quiz, index + 1),
    description: challengeDescriptionForQuiz(quiz),
    quizId: quiz.id,
    coinReward: rewardForOrder(index + 1),
    passThreshold: DEFAULT_PASS_THRESHOLD_PCT,
    isActive: true,
  }))
}

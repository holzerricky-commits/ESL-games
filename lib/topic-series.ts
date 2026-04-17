import type { Quiz } from '@/lib/types'

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function getQuizSeriesKey(quiz: Quiz): string {
  if (quiz.seriesId && quiz.seriesId.trim()) return quiz.seriesId.trim()
  return `quiz:${quiz.id}`
}

export function getQuizPartLabel(quiz: Quiz): string {
  if (quiz.partLabel?.trim()) return quiz.partLabel.trim()
  if (quiz.partIndex && quiz.partIndex > 0) return `Part ${quiz.partIndex}`
  return 'Part 1'
}

export function listSeriesParts(quizzes: Quiz[], seriesId: string): Quiz[] {
  return quizzes
    .filter((quiz) => quiz.seriesId === seriesId)
    .sort((a, b) => {
      const aPart = a.partIndex ?? Number.MAX_SAFE_INTEGER
      const bPart = b.partIndex ?? Number.MAX_SAFE_INTEGER
      if (aPart !== bPart) return aPart - bPart
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })
}

export function getSeriesForQuiz(quizzes: Quiz[], quizId: string): Quiz[] {
  const target = quizzes.find((quiz) => quiz.id === quizId)
  if (!target?.seriesId) return target ? [target] : []
  return listSeriesParts(quizzes, target.seriesId)
}

export function getNextPartInSeries(quizzes: Quiz[], quizId: string): Quiz | null {
  const series = getSeriesForQuiz(quizzes, quizId)
  if (series.length <= 1) return null
  const at = series.findIndex((quiz) => quiz.id === quizId)
  if (at < 0 || at >= series.length - 1) return null
  return series[at + 1] ?? null
}

export function buildNextPartSeed(sourceQuiz: Quiz, quizzes: Quiz[]): Partial<Quiz> {
  const seriesId = sourceQuiz.seriesId?.trim() || `${slugify(sourceQuiz.seriesTitle || sourceQuiz.name)}-${sourceQuiz.id}`
  const seriesTitle = sourceQuiz.seriesTitle?.trim() || sourceQuiz.name
  const existing = listSeriesParts(quizzes, seriesId)
  const maxPart = Math.max(0, ...existing.map((quiz) => quiz.partIndex ?? 0), sourceQuiz.partIndex ?? 1)
  const nextPartIndex = maxPart + 1
  return {
    seriesId,
    seriesTitle,
    partIndex: nextPartIndex,
    partLabel: `Part ${nextPartIndex}`,
    sourceQuizId: sourceQuiz.id,
    name: `${seriesTitle} Part ${nextPartIndex}`,
    description: sourceQuiz.description,
    coverImageMode: sourceQuiz.coverImageMode ?? 'auto',
    coverImageUrl: sourceQuiz.coverImageUrl,
    challengeQuestionCount: sourceQuiz.challengeQuestionCount,
    passThreshold: sourceQuiz.passThreshold,
  }
}


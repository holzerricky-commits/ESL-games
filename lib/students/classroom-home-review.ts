import type { ClassroomHomeGoalLine } from '@/lib/students/classroom-home-goals'

export interface ClassroomHomeAnswersLike {
  attempted: number
  correct: number
  incorrect: number
  skip: number
}

export interface ClassroomHomeReview {
  durationLabel: string | null
  contextLine: string | null
  practiced: ClassroomHomeGoalLine[]
  learnedWords: string[]
  answersLabel: string | null
  reviewWords: string[]
}

export function formatClassroomHomeDuration(input: {
  startedAt?: string | null
  endedAt?: string | null
  durationMin?: number | null
  nowMs?: number
}): string | null {
  const start = input.startedAt ? Date.parse(input.startedAt) : NaN
  const end = input.endedAt ? Date.parse(input.endedAt) : (input.nowMs ?? Date.now())
  if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
    const mins = Math.max(1, Math.round((end - start) / 60_000))
    if (mins < 60) return `${mins} min`
    const hours = Math.floor(mins / 60)
    const rest = mins % 60
    return rest ? `${hours} hr ${rest} min` : `${hours} hr`
  }
  const planned = input.durationMin
  if (typeof planned === 'number' && Number.isFinite(planned) && planned > 0) {
    return `${Math.round(planned)} min`
  }
  return null
}

export function formatClassroomHomeAnswers(summary: ClassroomHomeAnswersLike | null | undefined): string | null {
  if (!summary || summary.attempted <= 0) return null
  const bits = [`${summary.correct} right`]
  if (summary.incorrect > 0) bits.push(`${summary.incorrect} miss`)
  if (summary.skip > 0) bits.push(`${summary.skip} skip`)
  return bits.join(' · ')
}

export function capClassroomHomeWords(words: string[] | null | undefined, cap = 6): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of words ?? []) {
    const word = raw.trim()
    if (!word) continue
    const key = word.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(word)
    if (out.length >= cap) break
  }
  return out
}

export function classroomHomeReviewHasExtras(review: ClassroomHomeReview): boolean {
  return Boolean(
    review.durationLabel ||
      review.contextLine ||
      review.practiced.length ||
      review.learnedWords.length ||
      review.answersLabel ||
      review.reviewWords.length,
  )
}

export function buildClassroomHomeReview(input: {
  startedAt?: string | null
  endedAt?: string | null
  durationMin?: number | null
  contextLine?: string | null
  practiced?: ClassroomHomeGoalLine[] | null
  learnedWords?: string[] | null
  answers?: ClassroomHomeAnswersLike | null
  reviewWords?: string[] | null
  nowMs?: number
}): ClassroomHomeReview {
  return {
    durationLabel: formatClassroomHomeDuration(input),
    contextLine: input.contextLine?.trim() || null,
    practiced: (input.practiced ?? []).filter((line) => line.text.trim()),
    learnedWords: capClassroomHomeWords(input.learnedWords, 6),
    answersLabel: formatClassroomHomeAnswers(input.answers),
    reviewWords: capClassroomHomeWords(input.reviewWords, 3),
  }
}

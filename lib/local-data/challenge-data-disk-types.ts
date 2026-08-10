/** On-disk timed-challenge quizzes and student results. */
export type ChallengeDataDiskPayload = {
  quizzes: unknown[]
  results: unknown[]
}

export function emptyChallengeDataDiskPayload(): ChallengeDataDiskPayload {
  return { quizzes: [], results: [] }
}

export function normalizeChallengeDataDiskPayload(raw: unknown): ChallengeDataDiskPayload {
  const empty = emptyChallengeDataDiskPayload()
  if (!raw || typeof raw !== 'object') return empty
  const o = raw as Record<string, unknown>
  return {
    quizzes: Array.isArray(o.quizzes) ? o.quizzes : [],
    results: Array.isArray(o.results) ? o.results : [],
  }
}

export function isChallengeDataDiskPayloadEmpty(payload: ChallengeDataDiskPayload): boolean {
  return payload.quizzes.length === 0 && payload.results.length === 0
}

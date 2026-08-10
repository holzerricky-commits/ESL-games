export interface ClassPrepWordRevisit {
  word: string
  reason: string
}

export interface ClassPrepExtrasPayload {
  prepPriorities?: string[]
  prepSuggestedActivities?: string[]
  prepCheckpointMoments?: string[]
  prepWordsToRevisit?: ClassPrepWordRevisit[]
  prepDifferentiationTips?: string[]
  prepCarryOver?: string[]
}

export interface ClassPrepExtrasSessionFields extends ClassPrepExtrasPayload {}

function sanitizeStringList(raw: unknown, max: number): string[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const line = item.trim()
    if (!line) continue
    const key = line.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(line)
    if (out.length >= max) break
  }
  return out.length > 0 ? out : undefined
}

export function sanitizePrepWordsToRevisit(raw: unknown): ClassPrepWordRevisit[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: ClassPrepWordRevisit[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const word = typeof row.word === 'string' ? row.word.trim() : ''
    const reason = typeof row.reason === 'string' ? row.reason.trim() : ''
    if (!word) continue
    const key = word.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ word, reason: reason || 'Needs more practice' })
    if (out.length >= 12) break
  }
  return out.length > 0 ? out : undefined
}

export function sanitizeClassPrepExtras(raw: Partial<ClassPrepExtrasSessionFields>): ClassPrepExtrasPayload {
  return {
    prepPriorities: sanitizeStringList(raw.prepPriorities, 6),
    prepSuggestedActivities: sanitizeStringList(raw.prepSuggestedActivities, 6),
    prepCheckpointMoments: sanitizeStringList(raw.prepCheckpointMoments, 6),
    prepWordsToRevisit: sanitizePrepWordsToRevisit(raw.prepWordsToRevisit),
    prepDifferentiationTips: sanitizeStringList(raw.prepDifferentiationTips, 5),
    prepCarryOver: sanitizeStringList(raw.prepCarryOver, 4),
  }
}

export function prepExtrasFromAiSuggestion(input: {
  priorities: string[]
  activities: string[]
  checkpointMoments: string[]
  wordsToRevisit: ClassPrepWordRevisit[]
  differentiationTips: string[]
  homeworkOrCarryOver: string[]
}): ClassPrepExtrasPayload {
  return sanitizeClassPrepExtras({
    prepPriorities: input.priorities,
    prepSuggestedActivities: input.activities,
    prepCheckpointMoments: input.checkpointMoments,
    prepWordsToRevisit: input.wordsToRevisit,
    prepDifferentiationTips: input.differentiationTips,
    prepCarryOver: input.homeworkOrCarryOver,
  })
}

export function hasPrepExtras(session: ClassPrepExtrasSessionFields): boolean {
  return Boolean(
    session.prepPriorities?.length ||
      session.prepSuggestedActivities?.length ||
      session.prepCheckpointMoments?.length ||
      session.prepWordsToRevisit?.length ||
      session.prepDifferentiationTips?.length ||
      session.prepCarryOver?.length,
  )
}

export function prepRevisitWordLabels(session: ClassPrepExtrasSessionFields): string[] {
  return (session.prepWordsToRevisit ?? []).map((row) => row.word)
}

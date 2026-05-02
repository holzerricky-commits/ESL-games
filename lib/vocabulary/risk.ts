import type { VocabularyEntry } from '@/lib/vocabulary/types'

export function getVocabularyRiskScore(entry: VocabularyEntry): number {
  const flags = new Set((entry.reviewFlags ?? []).map((f) => f.trim().toLowerCase()))
  let score = 0
  if (flags.has('off_scope')) score += 3
  if (flags.has('ambiguous_meaning')) score += 2
  if (flags.has('low_confidence')) score += 1
  if ((entry.confidence ?? 0.5) < 0.55) score += 1
  return score
}

export function isHighRiskEntry(entry: VocabularyEntry): boolean {
  return getVocabularyRiskScore(entry) >= 3
}

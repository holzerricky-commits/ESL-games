import { createStableId } from '@/lib/vocabulary/utils'
import type { VocabularySet } from '@/lib/vocabulary/types'
import type { StudentClassSession } from '@/lib/types'

export function generateMeaningMatchPracticeItems(
  set: VocabularySet,
  requestedCount: number = 6,
): NonNullable<StudentClassSession['practiceItems']> {
  const approved = set.entries.filter((entry) => entry.approved && entry.definition.trim())
  if (approved.length < 2) return []
  const count = Math.max(2, Math.min(12, Math.floor(requestedCount)))
  const now = new Date().toISOString()
  const items: NonNullable<StudentClassSession['practiceItems']> = []
  for (const entry of approved.slice(0, count)) {
    const distractors = approved
      .filter((candidate) => candidate.id !== entry.id)
      .map((candidate) => candidate.definition.trim())
      .filter(Boolean)
      .slice(0, 3)
    const choices = [entry.definition.trim(), ...distractors].slice(0, 4)
    if (choices.length < 2) continue
    items.push({
      id: createStableId(`practice:${set.id}:${entry.id}`),
      type: 'meaning_match',
      word: entry.word,
      prompt: `Choose the best meaning for "${entry.word}".`,
      choices,
      correctChoiceIndex: 0,
      createdAt: now,
    })
  }
  return items
}

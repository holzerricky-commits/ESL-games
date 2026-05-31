/** Default “what to ask” lines for student dictation / error correction (Phase 2). */
export const DEFAULT_COACH_PROMPTS: readonly string[] = [
  'How many mistakes do you hear in that sentence?',
  'Can you find what is wrong?',
  'Look at this part — what is missing or wrong here?',
  'Should it be a, an, or the?',
  'Does the word order sound natural?',
  'Try saying the whole sentence again.',
]

export function getDefaultPromptScript(): string[] {
  return [...DEFAULT_COACH_PROMPTS]
}

export function getDefaultPromptChecked(length = DEFAULT_COACH_PROMPTS.length): boolean[] {
  return Array.from({ length }, () => false)
}

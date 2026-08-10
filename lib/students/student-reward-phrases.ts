export const STUDENT_REWARD_PHRASES = [
  'Great job!',
  'Amazing work!',
  'Perfect!',
  'Well done!',
  'Fantastic!',
  'Super!',
  'Brilliant!',
  'You nailed it!',
  'Awesome!',
  'Nice one!',
] as const

export type StudentRewardPhrase = (typeof STUDENT_REWARD_PHRASES)[number]

/** Pick a praise line; avoids repeating the same phrase twice in a row. */
export function pickStudentRewardPhrase(lastPhrase?: string | null): StudentRewardPhrase {
  const pool =
    lastPhrase && STUDENT_REWARD_PHRASES.length > 1
      ? STUDENT_REWARD_PHRASES.filter((p) => p !== lastPhrase)
      : STUDENT_REWARD_PHRASES
  const idx = Math.floor(Math.random() * pool.length)
  return pool[idx] ?? STUDENT_REWARD_PHRASES[0]!
}

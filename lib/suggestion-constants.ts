/** Shared client/server constants for vocabulary suggestion pool size. */

export const MIN_DISPLAY_PER_DIFFICULTY = 3
export const MAX_DISPLAY_PER_DIFFICULTY = 12
export const SUGGESTION_BUFFER = 5
export const MAX_FETCH_PER_DIFFICULTY = MAX_DISPLAY_PER_DIFFICULTY + SUGGESTION_BUFFER

/** Words fetched per difficulty row (display + buffer), matches `lib/gemini.ts`. */
export function getSuggestionFetchCount(numPerDifficulty: number): number {
  const displayCount = Math.max(
    MIN_DISPLAY_PER_DIFFICULTY,
    Math.min(MAX_DISPLAY_PER_DIFFICULTY, Math.floor(numPerDifficulty || 6))
  )
  return Math.min(
    MAX_FETCH_PER_DIFFICULTY,
    Math.max(MIN_DISPLAY_PER_DIFFICULTY, displayCount + SUGGESTION_BUFFER)
  )
}

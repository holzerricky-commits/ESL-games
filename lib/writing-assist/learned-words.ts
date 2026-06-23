import {
  loadWritingAssistPrefs,
  resetWritingAssistPrefsForTests,
  saveWritingAssistPrefs,
} from '@/lib/writing-assist/writing-assist-prefs'
import { isKnownContractionTypo } from '@/lib/writing-assist/contractions'

const MAX_LEARNED_WORDS = 500

export function loadLearnedWords(): Set<string> {
  const prefs = loadWritingAssistPrefs()
  const words = prefs.learnedWords ?? []
  return new Set(words.map((w) => w.toLowerCase()))
}

export function rememberLearnedWord(word: string): void {
  const token = word.trim().toLowerCase()
  if (!token || token.length < 2) return
  if (isKnownContractionTypo(token)) return
  const prefs = loadWritingAssistPrefs()
  const existing = prefs.learnedWords ?? []
  if (existing.some((w) => w.toLowerCase() === token)) return

  const next = [...existing, token]
  const trimmed = next.length > MAX_LEARNED_WORDS ? next.slice(-MAX_LEARNED_WORDS) : next
  saveWritingAssistPrefs({ ...prefs, learnedWords: trimmed })
}

/** Reset for tests only. */
export function resetLearnedWordsForTests(): void {
  resetWritingAssistPrefsForTests()
}

/** Lone pronoun i → I on space trigger. */
export function suggestLonePronounI(token: string): string | null {
  if (token === 'i') return 'I'
  return null
}

/** First letter shown on a card without a picture ("" when the word has none). */
export function wordTileLetter(word: string): string {
  const match = word.trim().match(/\p{L}|\p{N}/u)
  return match ? match[0]!.toLocaleUpperCase() : ''
}

/** Stable colour slot per word, so a card keeps its colour everywhere. */
export function wordTileIndex(word: string, slots: number): number {
  const key = word.trim().toLowerCase()
  let h = 0
  for (let i = 0; i < key.length; i++) h = (Math.imul(31, h) + key.charCodeAt(i)) | 0
  return slots > 0 ? Math.abs(h) % slots : 0
}

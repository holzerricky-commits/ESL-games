import { pictureWordKey } from '@/lib/lesson-vault/types'

export type PreparedVocabEntry = { word: string; definition: string }

/** Lesson definition for this word, or '' when none is usable. Exact spelling wins over a plural match. */
export function preparedMeaningFromEntries(
  word: string,
  entries: readonly PreparedVocabEntry[],
  sentence: string,
): string {
  const want = word.replace(/\s+/g, ' ').trim().toLowerCase()
  const wantKey = pictureWordKey(word)
  if (!want) return ''
  const source = sentence.replace(/\s+/g, ' ').trim().toLowerCase()
  let fuzzy = ''
  for (const entry of entries) {
    const definition = acceptPreparedDefinition(entry.definition, source)
    if (!definition) continue
    const head = entry.word.replace(/\s+/g, ' ').trim().toLowerCase()
    if (head && head === want) return definition
    if (!fuzzy && pictureWordKey(entry.word) === wantKey) fuzzy = definition
  }
  return fuzzy
}

/** Puts the part the word was saved from ahead of the lesson's other lists. */
export function preferPartEntries<T extends { partId: string; words: readonly PreparedVocabEntry[] }>(
  groups: readonly T[],
  partId: string,
): PreparedVocabEntry[] {
  const prefer = partId.trim()
  const ordered = prefer
    ? [...groups.filter((g) => g.partId === prefer), ...groups.filter((g) => g.partId !== prefer)]
    : [...groups]
  return ordered.flatMap((g) => g.words)
}

function acceptPreparedDefinition(definition: string, sentenceLower: string): string {
  const text = definition.replace(/\s+/g, ' ').trim().slice(0, 200)
  if (!text || /^vocabulary:/i.test(text)) return ''
  if (sentenceLower && text.toLowerCase() === sentenceLower) return ''
  return text
}

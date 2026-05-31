import type { InteractiveVocabPack } from '@/lib/books/interactive-vocab'
import type { BookRecord, BookUnitRecord } from '@/lib/books/types'
import { extractLessonWords } from '@/lib/writing-assist/lesson-words'

function addWord(set: Set<string>, raw: string | undefined | null): void {
  const w = raw?.trim().toLowerCase()
  if (!w || w.length < 2) return
  set.add(w)
}

export function buildLessonVocabulary(args: {
  book: BookRecord | null | undefined
  unit: BookUnitRecord | null | undefined
  interactiveVocabPack: InteractiveVocabPack | null | undefined
}): string[] {
  const set = new Set<string>()

  for (const w of extractLessonWords(args.book, args.unit)) {
    set.add(w)
  }

  if (args.interactiveVocabPack?.words) {
    for (const entry of args.interactiveVocabPack.words) {
      addWord(set, entry.word)
      for (const ex of entry.examples ?? []) {
        for (const t of ex.toLowerCase().split(/[^a-z']+/i)) {
          if (t.length > 2) set.add(t)
        }
      }
    }
  }

  return Array.from(set)
}

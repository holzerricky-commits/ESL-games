import type { BookRecord, BookUnitRecord } from '@/lib/books/types'

const TOKEN = /[a-zA-Z][a-zA-Z''-]*/g

function tokensFromText(text: string): string[] {
  const out: string[] = []
  for (const m of text.matchAll(TOKEN)) {
    const t = m[0]?.trim()
    if (t && t.length > 1) out.push(t.toLowerCase())
  }
  return out
}

export function extractLessonWords(
  book: BookRecord | null | undefined,
  unit: BookUnitRecord | null | undefined,
): string[] {
  const set = new Set<string>()
  if (!book && !unit) return []

  if (unit) {
    for (const lesson of unit.lessons ?? []) {
      for (const part of lesson.parts ?? []) {
        if (part.title) tokensFromText(part.title).forEach((t) => set.add(t))
      }
      if (lesson.title) tokensFromText(lesson.title).forEach((t) => set.add(t))
    }
  }

  if (book) {
    for (const u of book.units ?? []) {
      if (unit && u.id !== unit.id) continue
      for (const lesson of u.lessons ?? []) {
        for (const part of lesson.parts ?? []) {
          if (part.title) tokensFromText(part.title).forEach((t) => set.add(t))
        }
      }
    }
  }

  return Array.from(set)
}

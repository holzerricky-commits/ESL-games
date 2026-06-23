import type { SpellEngine } from '@/lib/writing-assist/spell-engine'
import { normalizeToken } from '@/lib/writing-assist/spell-engine'

export type SpellMarkerSpan = { start: number; end: number; kind?: 'spell' | 'capitalization' }
const WORD_RE = /[\w''-]+/g

export function findUnknownWordSpans(
  text: string,
  engine: SpellEngine | null,
  options?: { lessonWords?: Set<string>; learnedWords?: Set<string> },
): SpellMarkerSpan[] {
  if (!engine || !text.trim()) return []

  const lessonWords = options?.lessonWords ?? new Set<string>()
  const learnedWords = options?.learnedWords ?? new Set<string>()
  const spans: SpellMarkerSpan[] = []

  for (const match of text.matchAll(WORD_RE)) {
    const token = match[0]
    const start = match.index ?? 0
    const end = start + token.length
    const norm = normalizeToken(token)
    if (norm.length < 2) continue
    if (lessonWords.has(norm) || learnedWords.has(norm)) continue
    if (engine.isValidWord(token)) continue
    if (!engine.suggestCorrection(token)) continue
    spans.push({ start, end, kind: 'spell' })
  }

  return spans
}

/** Spell markers for the live mirror overlay. */
export function findWritingAssistMarkerSpans(
  text: string,
  engine: SpellEngine | null,
  options?: { lessonWords?: Set<string>; learnedWords?: Set<string> },
): SpellMarkerSpan[] {
  return findUnknownWordSpans(text, engine, options)
}

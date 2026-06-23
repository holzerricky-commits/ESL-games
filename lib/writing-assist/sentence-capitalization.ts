import type { WritingAssistTriggerChar } from '@/lib/writing-assist/autocorrect'

const SENTENCE_CLOSE_TRIGGERS = new Set<string>(['.', '!', '?'])

/** Lowercase letter that should be capitalized at a sentence boundary (grammar check). */
const AFTER_SENTENCE_END_RE = /[.!?]["')\]]*(?:\s+|\n+)([a-z])/g

/** Index of the first character of the sentence that ends at `punctIndex` (. ! ?). */
export function findSentenceStartBeforePunctuation(text: string, punctIndex: number): number {
  if (punctIndex <= 0) return 0

  let contentEnd = punctIndex
  while (contentEnd > 0 && text[contentEnd - 1] === ' ') {
    contentEnd--
  }

  const before = text.slice(0, contentEnd)
  if (!before.trim()) return 0

  const boundaryRe = /[.!?]["')\]]*(?:\s+|\n+)/g
  let start = 0
  for (const match of before.matchAll(boundaryRe)) {
    start = (match.index ?? 0) + match[0].length
  }

  while (start < contentEnd && /\s/.test(text[start] ?? '')) {
    start++
  }

  return start
}

/**
 * When the user closes a sentence with `.`, `!`, or `?`, capitalize that sentence's
 * opening letter (look backward — not the next sentence).
 */
export function capitalizeClosingSentence(
  text: string,
  caret: number,
  trigger: WritingAssistTriggerChar,
): { text: string; caret: number } {
  if (!SENTENCE_CLOSE_TRIGGERS.has(trigger)) return { text, caret }

  const punctIndex = caret - trigger.length
  if (punctIndex < 0 || text[punctIndex] !== trigger) return { text, caret }

  const start = findSentenceStartBeforePunctuation(text, punctIndex)
  const ch = text[start]
  if (!ch || !/[a-z]/.test(ch)) return { text, caret }

  return {
    text: text.slice(0, start) + ch.toUpperCase() + text.slice(start + 1),
    caret,
  }
}

/** Live marker spans for grammar-style checks (coach / optional UI). */
export function findUncapitalizedSentenceStartSpans(
  text: string,
): { start: number; end: number; kind: 'capitalization' }[] {
  if (!text.trim()) return []

  const spans: { start: number; end: number; kind: 'capitalization' }[] = []
  const seen = new Set<number>()

  const push = (start: number) => {
    if (seen.has(start)) return
    seen.add(start)
    spans.push({ start, end: start + 1, kind: 'capitalization' })
  }

  const leading = text.match(/^\s*/)
  const leadLen = leading?.[0].length ?? 0
  const first = text[leadLen]
  if (first && /[a-z]/.test(first)) {
    push(leadLen)
  }

  for (const match of text.matchAll(AFTER_SENTENCE_END_RE)) {
    const letterIndex = (match.index ?? 0) + match[0].length - 1
    push(letterIndex)
  }

  spans.sort((a, b) => a.start - b.start)
  return spans
}

/** First lowercase letter index at a sentence boundary (for grammar-lite issues). */
export function findUncapitalizedSentenceStartLetters(text: string): { index: number; letter: string }[] {
  return findUncapitalizedSentenceStartSpans(text).map((span) => ({
    index: span.start,
    letter: text[span.start] ?? '',
  }))
}

import type { SpellEngine } from '@/lib/writing-assist/spell-engine'
import { normalizeToken } from '@/lib/writing-assist/spell-engine'
import { getBigramNextWords } from '@/lib/writing-assist/ngram-index'

export type GhostSuggestion = {
  /** Full suggested word. */
  word: string
  /** Characters to append after the partial word at the caret. */
  suffix: string
}

const COMMON_BIGRAMS: Record<string, string[]> = {
  i: ['am', 'have', 'think', 'want', 'will', 'can', 'was', 'said'],
  you: ['are', 'can', 'have', 'will', 'should', 'need', 'were', 'said'],
  we: ['are', 'can', 'have', 'will', 'should', 'need', 'were'],
  they: ['are', 'can', 'have', 'will', 'should', 'were', 'said'],
  he: ['is', 'was', 'has', 'said', 'can', 'will'],
  she: ['is', 'was', 'has', 'said', 'can', 'will'],
  it: ['is', 'was', 'has', 'can', 'will'],
  the: ['student', 'book', 'lesson', 'word', 'sentence', 'teacher', 'first', 'same'],
  a: ['good', 'great', 'student', 'word', 'sentence', 'lot', 'little', 'new'],
  an: ['example', 'idea', 'answer', 'important'],
  is: ['a', 'the', 'not', 'very', 'good', 'important', 'correct'],
  are: ['you', 'they', 'we', 'good', 'very', 'not', 'going'],
  was: ['a', 'the', 'very', 'not', 'good', 'really'],
  were: ['you', 'they', 'we', 'not', 'very', 'good'],
  to: ['the', 'be', 'read', 'write', 'learn', 'help', 'make', 'get'],
  and: ['the', 'then', 'also', 'i', 'you', 'we', 'they'],
  in: ['the', 'a', 'this', 'my', 'your', 'class'],
  on: ['the', 'a', 'this', 'page', 'your'],
  for: ['the', 'a', 'example', 'you', 'this'],
  with: ['the', 'a', 'you', 'your', 'this'],
  that: ['is', 'was', 'the', 'you', 'i', 'we'],
  this: ['is', 'was', 'book', 'lesson', 'word'],
  said: ['the', 'that', 'you', 'i', 'he', 'she'],
  have: ['a', 'the', 'to', 'you', 'been', 'not'],
  has: ['a', 'the', 'to', 'been', 'not'],
  be: ['a', 'the', 'able', 'good', 'very'],
  do: ['you', 'not', 'the', 'it', 'this'],
  does: ['not', 'the', 'it', 'this'],
  can: ['you', 'see', 'help', 'read', 'write', 'not'],
  will: ['be', 'help', 'read', 'write', 'not', 'you'],
  my: ['student', 'book', 'lesson', 'name', 'friend'],
  your: ['student', 'book', 'lesson', 'name', 'answer'],
  student: ['said', 'is', 'was', 'can', 'will', 'has', 'needs'],
  teacher: ['said', 'is', 'was', 'can', 'will', 'has'],
  hello: ['i', 'teacher', 'everyone', 'how'],
  good: ['morning', 'job', 'idea', 'work', 'answer'],
  very: ['good', 'well', 'important', 'much'],
  not: ['a', 'the', 'very', 'sure', 'good'],
}

const TEACHING_STARTERS = [
  'the',
  'a',
  'this',
  'my',
  'your',
  'please',
  'let',
  'read',
  'write',
  'listen',
  'repeat',
  'what',
  'how',
  'can',
  'today',
  'hello',
]

const SCORE_LESSON = 1200
const SCORE_SESSION = 900
const SCORE_NGRAM = 600
const SCORE_STATIC_BIGRAM = 400
const SCORE_STARTER = 350
const SCORE_PREFIX = 80

export function buildSessionBigrams(words: string[]): Map<string, string[]> {
  const map = new Map<string, string[]>()
  const tokens = words.map(normalizeToken).filter(Boolean)
  for (let i = 0; i < tokens.length - 1; i++) {
    const prev = tokens[i]!
    const next = tokens[i + 1]!
    const list = map.get(prev) ?? []
    if (!list.includes(next)) list.push(next)
    map.set(prev, list)
  }
  return map
}

export function isSentenceStart(text: string, caret: number, partial: string): boolean {
  const before = text.slice(0, caret - partial.length).trimEnd()
  return before.length === 0 || /[\n.!?]\s*$/.test(before)
}

export function getPartialWordAtCaret(text: string, caret: number): string {
  const before = text.slice(0, caret)
  const m = before.match(/([\w'-]*)$/)
  return m?.[1] ?? ''
}

/** Strip whitespace and punctuation after the last completed word. */
function trimAfterLastWord(text: string): string {
  return text.replace(/[\s.!?,;:"')\]}]+$/g, '')
}

export function getPreviousWord(text: string, caret: number): string {
  const partial = getPartialWordAtCaret(text, caret)
  const before = trimAfterLastWord(text.slice(0, caret - partial.length))
  const tokens = before.match(/[\w'-]+/g)
  return tokens?.[tokens.length - 1] ?? ''
}

export function getSecondPreviousWord(text: string, caret: number): string {
  const partial = getPartialWordAtCaret(text, caret)
  const before = trimAfterLastWord(text.slice(0, caret - partial.length))
  const tokens = before.match(/[\w'-]+/g) ?? []
  return tokens.length >= 2 ? tokens[tokens.length - 2]! : ''
}

function toGhostSuggestion(word: string, partial: string): GhostSuggestion {
  const part = partial.toLowerCase()
  const lower = word.toLowerCase()
  const suffix = part ? lower.slice(part.length) : lower
  return { word: lower, suffix: suffix || lower }
}

function collectPrefixMatches(
  partial: string,
  lessonWords: Set<string>,
  engine: SpellEngine | null,
): string[] {
  const part = partial.toLowerCase()
  if (part.length < 1) return []

  const out: string[] = []
  const seen = new Set<string>()

  const add = (w: string) => {
    const lower = w.toLowerCase()
    if (seen.has(lower) || !lower.startsWith(part) || lower.length <= part.length) return
    seen.add(lower)
    out.push(lower)
  }

  for (const w of lessonWords) add(w)
  if (engine) {
    for (const w of engine.findWordsWithPrefix(part, 24)) add(w)
  }

  return out
}

type CandidateSource = 'lesson' | 'session' | 'ngram' | 'static' | 'starter' | 'prefix'

function scoreCandidate(
  word: string,
  partial: string,
  source: CandidateSource,
  lessonWords: Set<string>,
  engine: SpellEngine | null,
): number {
  const lower = word.toLowerCase()
  const part = partial.toLowerCase()
  let score = 0

  if (lessonWords.has(lower)) score += SCORE_LESSON
  if (source === 'session') score += SCORE_SESSION
  else if (source === 'ngram') score += SCORE_NGRAM
  else if (source === 'static') score += SCORE_STATIC_BIGRAM
  else if (source === 'starter') score += SCORE_STARTER
  else if (source === 'prefix') score += SCORE_PREFIX * 0.5

  if (part.length > 0 && lower.startsWith(part)) {
    score += SCORE_PREFIX * part.length
  }

  const freq = engine?.getWordFrequency(lower) ?? 0
  if (freq > 0) score += Math.log(freq + 1) * 50

  // Prefer full next-word predictions over single-letter ghosts (e.g. "are" not "a").
  if (part.length === 0 && lower.length > 1) score += 100
  if (part.length === 0 && lower.length === 1 && source !== 'prefix') score -= 60

  return score
}

function addScored(
  bucket: Map<string, { score: number; source: CandidateSource }>,
  word: string,
  partial: string,
  source: CandidateSource,
  lessonWords: Set<string>,
  engine: SpellEngine | null,
): void {
  const lower = word.toLowerCase()
  const part = partial.toLowerCase()
  if (!lower) return
  if (part && !lower.startsWith(part)) return
  if (part && lower.length <= part.length) return

  const nextScore = scoreCandidate(lower, partial, source, lessonWords, engine)
  const prev = bucket.get(lower)
  if (!prev || nextScore > prev.score) {
    bucket.set(lower, { score: nextScore, source })
  }
}

export function suggestNextWords(
  prevWord: string,
  partial: string,
  sessionBigrams: Map<string, string[]>,
  lessonWords: Set<string>,
  engine: SpellEngine | null,
  options?: {
    prev2Word?: string
    ngramIndex?: Map<string, { word: string; count: number }[]> | null
    text?: string
    caret?: number
  },
): GhostSuggestion[] {
  const prev = normalizeToken(prevWord)
  const prev2 = normalizeToken(options?.prev2Word ?? '')
  const part = partial.toLowerCase()

  const bucket = new Map<string, { score: number; source: CandidateSource }>()
  const sentenceStart =
    options?.text != null && options?.caret != null
      ? isSentenceStart(options.text, options.caret, partial)
      : !prev && !part

  if (part.length >= 1) {
    for (const w of collectPrefixMatches(part, lessonWords, engine)) {
      addScored(bucket, w, partial, lessonWords.has(w) ? 'lesson' : 'prefix', lessonWords, engine)
    }
  }

  const session = sessionBigrams.get(prev)
  if (session) {
    for (const w of session) addScored(bucket, w, partial, 'session', lessonWords, engine)
  }

  const common = COMMON_BIGRAMS[prev]
  if (common) {
    for (const w of common) addScored(bucket, w, partial, 'static', lessonWords, engine)
  }

  if (options?.ngramIndex && prev) {
    for (const w of getBigramNextWords(options.ngramIndex, prev, prev2 || undefined)) {
      addScored(bucket, w, partial, 'ngram', lessonWords, engine)
    }
  }

  if (sentenceStart && !part.length) {
    for (const w of TEACHING_STARTERS) addScored(bucket, w, partial, 'starter', lessonWords, engine)
  }

  if (!part.length && !prev) {
    for (const w of lessonWords) {
      if (w.length > 2) addScored(bucket, w, partial, 'lesson', lessonWords, engine)
    }
  }

  const ranked = [...bucket.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .map(([word]) => word)

  const out: GhostSuggestion[] = []
  const seen = new Set<string>()
  for (const word of ranked) {
    if (seen.has(word)) continue
    seen.add(word)
    out.push(toGhostSuggestion(word, partial))
    if (out.length >= 3) break
  }

  return out
}

/** @deprecated Use suggestNextWords — returns first candidate or null. */
export function suggestNextWord(
  prevWord: string,
  partial: string,
  sessionBigrams: Map<string, string[]>,
  lessonWords: Set<string>,
  engine: SpellEngine | null,
  options?: Parameters<typeof suggestNextWords>[5],
): GhostSuggestion | null {
  const hits = suggestNextWords(prevWord, partial, sessionBigrams, lessonWords, engine, options)
  return hits[0] ?? null
}

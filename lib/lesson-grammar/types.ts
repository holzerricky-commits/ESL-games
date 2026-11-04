/** One example sentence saved for a lesson's grammar point, kept per student. */
export type LessonGrammarItem = {
  id: string
  bookId: string
  unitId: string
  lessonId: string
  lessonTitle: string
  partId: string
  partTitle: string
  sentence: string
  /** Character range of the practised form inside `sentence`; both -1 when not marked yet. */
  targetStart: number
  targetEnd: number
  /** Wrong forms offered next to the target in games (e.g. "go", "goes" for "went"). */
  distractors: string[]
  pdfPage: number
  /** 'ai' while an AI-generated draft is untouched; any teacher edit clears it. */
  source?: 'ai'
  createdAt: string
  updatedAt: string
}

/** The lesson's grammar point in the teacher's words ("Past tense: add -ed"). */
export type LessonGrammarRule = {
  bookId: string
  unitId: string
  lessonId: string
  text: string
  updatedAt: string
}

export type LessonGrammarDiskPayload = {
  byStudent: Record<string, LessonGrammarItem[]>
  rulesByStudent: Record<string, LessonGrammarRule[]>
}

export type LessonGrammarLessonRef = {
  bookId: string
  unitId: string
  lessonId: string
}

export type LessonGrammarSaveInput = LessonGrammarLessonRef & {
  lessonTitle: string
  partId: string
  partTitle: string
  sentence: string
  /** Text to mark inside the sentence; '' leaves the item unmarked. */
  target: string
  pdfPage: number
  /** Only used for new sentences that have a mark. */
  distractors?: string[]
  source?: 'ai'
}

export type LessonGrammarItemPatch = {
  sentence?: string
  /** `null` clears the mark. */
  target?: { start: number; end: number } | null
  distractors?: string[]
}

export type GrammarTargetRange = { start: number; end: number }

export type GrammarSentenceWord = { text: string; start: number; end: number }

export const MAX_GRAMMAR_DISTRACTORS = 5
/** Picks longer than this many words are treated as "the whole sentence", not a target. */
const MAX_TARGET_WORDS = 4
const MAX_SENTENCE_CHARS = 400
const MAX_RULE_CHARS = 600

export function emptyLessonGrammarDiskPayload(): LessonGrammarDiskPayload {
  return { byStudent: {}, rulesByStudent: {} }
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function int(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function validRange(sentence: string, start: number, end: number): GrammarTargetRange | null {
  return start >= 0 && end > start && end <= sentence.length ? { start, end } : null
}

export function grammarTargetRange(item: Pick<LessonGrammarItem, 'sentence' | 'targetStart' | 'targetEnd'>): GrammarTargetRange | null {
  return validRange(item.sentence, item.targetStart, item.targetEnd)
}

export function grammarTargetText(item: Pick<LessonGrammarItem, 'sentence' | 'targetStart' | 'targetEnd'>): string {
  const range = grammarTargetRange(item)
  return range ? item.sentence.slice(range.start, range.end) : ''
}

const WORD_RE = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu

export function grammarSentenceWords(sentence: string): GrammarSentenceWord[] {
  return Array.from(sentence.matchAll(WORD_RE), (m) => ({
    text: m[0],
    start: m.index!,
    end: m.index! + m[0].length,
  }))
}

/** First whole-word, case-insensitive match of `target` in `sentence`. */
export function findTargetInSentence(sentence: string, target: string): GrammarTargetRange | null {
  const t = cleanText(target)
  if (!t) return null
  const pattern = escapeRegExp(t).replace(/ /g, '\\s+')
  const match = new RegExp(`(?<![\\p{L}\\p{N}])${pattern}(?![\\p{L}\\p{N}])`, 'iu').exec(sentence)
  return match ? { start: match.index, end: match.index + match[0].length } : null
}

/** Word indexes covered by `range` (inclusive), or null. */
export function targetWordSpan(
  words: readonly GrammarSentenceWord[],
  range: GrammarTargetRange | null,
): [number, number] | null {
  if (!range) return null
  const first = words.findIndex((w) => w.end > range.start)
  let last = -1
  for (let i = words.length - 1; i >= 0; i--) {
    if (words[i]!.start < range.end) {
      last = i
      break
    }
  }
  return first >= 0 && last >= first ? [first, last] : null
}

/**
 * Clicking a word of the sentence: marks it, grows the mark when it is right next to it,
 * trims an end word off, or clears a one-word mark.
 */
export function toggleGrammarTargetWord(
  sentence: string,
  range: GrammarTargetRange | null,
  wordIndex: number,
): GrammarTargetRange | null {
  const words = grammarSentenceWords(sentence)
  if (!words[wordIndex]) return range
  let from = wordIndex
  let to = wordIndex
  const span = targetWordSpan(words, range)
  if (span) {
    const [a, b] = span
    if (wordIndex === a - 1) to = b
    else if (wordIndex === b + 1) from = a
    else if (wordIndex >= a && wordIndex <= b) {
      if (a === b) return null
      if (wordIndex === a) {
        from = a + 1
        to = b
      } else if (wordIndex === b) {
        from = a
        to = b - 1
      }
    }
  }
  return { start: words[from]!.start, end: words[to]!.end }
}

/** What to save from a page selection: the sentence, plus the picked words as target when short enough. */
export function grammarSaveFromPick(word: string, sentence: string): { sentence: string; target: string } {
  const picked = cleanText(word)
  const around = cleanText(sentence)
  if (!around) return { sentence: picked, target: '' }
  const pickedWords = grammarSentenceWords(picked).length
  if (pickedWords === 0 || pickedWords > MAX_TARGET_WORDS) return { sentence: around, target: '' }
  return { sentence: around, target: picked }
}

/** "go, goes; gone" → ["go", "goes", "gone"], without the target or repeats. */
export function parseGrammarDistractors(text: string, target: string = ''): string[] {
  const targetKey = cleanText(target).toLowerCase()
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of text.split(/[,;\n]/)) {
    const value = cleanText(raw)
    const key = value.toLowerCase()
    if (!value || key === targetKey || seen.has(key)) continue
    seen.add(key)
    out.push(value)
    if (out.length >= MAX_GRAMMAR_DISTRACTORS) break
  }
  return out
}

function sentenceKey(sentence: string): string {
  return cleanText(sentence).toLowerCase()
}

export function sanitizeLessonGrammarItem(raw: unknown): LessonGrammarItem | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = str(o.id).trim()
  const sentence = cleanText(str(o.sentence)).slice(0, MAX_SENTENCE_CHARS)
  const bookId = str(o.bookId).trim()
  const unitId = str(o.unitId).trim()
  const lessonId = str(o.lessonId).trim()
  if (!id || !sentence || !bookId || !unitId || !lessonId) return null
  const range = validRange(sentence, int(o.targetStart, -1), int(o.targetEnd, -1))
  const createdAt = str(o.createdAt) || new Date().toISOString()
  const target = range ? sentence.slice(range.start, range.end) : ''
  return {
    id,
    bookId,
    unitId,
    lessonId,
    lessonTitle: str(o.lessonTitle),
    partId: str(o.partId),
    partTitle: str(o.partTitle),
    sentence,
    targetStart: range?.start ?? -1,
    targetEnd: range?.end ?? -1,
    distractors: Array.isArray(o.distractors)
      ? parseGrammarDistractors(o.distractors.filter((d): d is string => typeof d === 'string').join(','), target)
      : [],
    pdfPage: int(o.pdfPage, 0),
    ...(o.source === 'ai' ? { source: 'ai' as const } : {}),
    createdAt,
    updatedAt: str(o.updatedAt) || createdAt,
  }
}

function sanitizeLessonGrammarRule(raw: unknown): LessonGrammarRule | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const text = str(o.text).trim().slice(0, MAX_RULE_CHARS)
  const bookId = str(o.bookId).trim()
  const unitId = str(o.unitId).trim()
  const lessonId = str(o.lessonId).trim()
  if (!text || !bookId || !unitId || !lessonId) return null
  return { bookId, unitId, lessonId, text, updatedAt: str(o.updatedAt) }
}

function normalizeByStudent<T>(raw: unknown, sanitize: (entry: unknown) => T | null): Record<string, T[]> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, T[]> = {}
  for (const [studentId, entries] of Object.entries(raw as Record<string, unknown>)) {
    if (!studentId.trim() || !Array.isArray(entries)) continue
    out[studentId] = entries.map(sanitize).filter((entry): entry is T => entry != null)
  }
  return out
}

export function normalizeLessonGrammarDiskPayload(raw: unknown): LessonGrammarDiskPayload {
  if (!raw || typeof raw !== 'object') return emptyLessonGrammarDiskPayload()
  const o = raw as Record<string, unknown>
  return {
    byStudent: normalizeByStudent(o.byStudent, sanitizeLessonGrammarItem),
    rulesByStudent: normalizeByStudent(o.rulesByStudent, sanitizeLessonGrammarRule),
  }
}

function isInLesson(entry: LessonGrammarLessonRef, ref: LessonGrammarLessonRef): boolean {
  return entry.bookId === ref.bookId && entry.unitId === ref.unitId && entry.lessonId === ref.lessonId
}

export function grammarItemsForLesson(
  items: readonly LessonGrammarItem[],
  ref: LessonGrammarLessonRef,
): LessonGrammarItem[] {
  return items.filter((item) => isInLesson(item, ref))
}

/** Sentences for every lesson in a teaching week. Earlier refs win, and each sentence is included once. */
export function grammarItemsForLessons(
  items: readonly LessonGrammarItem[],
  refs: readonly LessonGrammarLessonRef[],
): LessonGrammarItem[] {
  const seen = new Set<string>()
  const out: LessonGrammarItem[] = []
  for (const ref of refs) {
    for (const item of grammarItemsForLesson(items, ref)) {
      if (seen.has(item.id)) continue
      seen.add(item.id)
      out.push(item)
    }
  }
  return out
}

export function grammarRuleForLesson(rules: readonly LessonGrammarRule[], ref: LessonGrammarLessonRef): string {
  return rules.find((rule) => isInLesson(rule, ref))?.text ?? ''
}

/** The first non-empty rule in ref order. The open book is first, so its rule wins. */
export function grammarRuleForLessons(
  rules: readonly LessonGrammarRule[],
  refs: readonly LessonGrammarLessonRef[],
): string {
  for (const ref of refs) {
    const text = grammarRuleForLesson(rules, ref).trim()
    if (text) return text
  }
  return ''
}

/** Adds a sentence, or re-marks the existing one when the same sentence is already in that lesson. */
export function upsertLessonGrammarItem(
  items: readonly LessonGrammarItem[],
  input: LessonGrammarSaveInput,
  options: { now: string; createId: () => string },
): { items: LessonGrammarItem[]; mode: 'added' | 'updated'; item: LessonGrammarItem } {
  const sentence = cleanText(input.sentence).slice(0, MAX_SENTENCE_CHARS)
  const range = findTargetInSentence(sentence, input.target)
  const key = sentenceKey(sentence)
  const index = items.findIndex((item) => isInLesson(item, input) && sentenceKey(item.sentence) === key)
  if (index >= 0) {
    const prev = items[index]!
    const sameTarget = range != null && range.start === prev.targetStart && range.end === prev.targetEnd
    const item: LessonGrammarItem = {
      ...prev,
      targetStart: range ? range.start : prev.targetStart,
      targetEnd: range ? range.end : prev.targetEnd,
      distractors: range && !sameTarget ? [] : prev.distractors,
      partId: input.partId,
      partTitle: input.partTitle,
      lessonTitle: input.lessonTitle || prev.lessonTitle,
      pdfPage: input.pdfPage,
      updatedAt: options.now,
    }
    const next = [...items]
    next[index] = item
    return { items: next, mode: 'updated', item }
  }
  const item: LessonGrammarItem = {
    id: options.createId(),
    bookId: input.bookId,
    unitId: input.unitId,
    lessonId: input.lessonId,
    lessonTitle: input.lessonTitle,
    partId: input.partId,
    partTitle: input.partTitle,
    sentence,
    targetStart: range?.start ?? -1,
    targetEnd: range?.end ?? -1,
    distractors: range
      ? parseGrammarDistractors((input.distractors ?? []).join(','), sentence.slice(range.start, range.end))
      : [],
    pdfPage: input.pdfPage,
    ...(input.source ? { source: input.source } : {}),
    createdAt: options.now,
    updatedAt: options.now,
  }
  return { items: [...items, item], mode: 'added', item }
}

/** Adds sentences that are not in their lesson yet; ones already there are left alone. */
export function addNewLessonGrammarItems(
  items: readonly LessonGrammarItem[],
  inputs: readonly LessonGrammarSaveInput[],
  options: { now: string; createId: () => string },
): { items: LessonGrammarItem[]; added: LessonGrammarItem[] } {
  let next = [...items]
  const added: LessonGrammarItem[] = []
  for (const input of inputs) {
    const key = sentenceKey(input.sentence)
    if (!key || next.some((item) => isInLesson(item, input) && sentenceKey(item.sentence) === key)) continue
    const result = upsertLessonGrammarItem(next, input, options)
    next = result.items
    added.push(result.item)
  }
  return { items: next, added }
}

/** Edits one sentence. A new sentence keeps its mark when the marked text is still in it. */
export function updateLessonGrammarItem(
  items: readonly LessonGrammarItem[],
  itemId: string,
  patch: LessonGrammarItemPatch,
  now: string,
): { items: LessonGrammarItem[]; item: LessonGrammarItem } | null {
  const index = items.findIndex((item) => item.id === itemId)
  if (index < 0) return null
  const prev = items[index]!
  const sentence =
    patch.sentence !== undefined ? cleanText(patch.sentence).slice(0, MAX_SENTENCE_CHARS) || prev.sentence : prev.sentence
  let range: GrammarTargetRange | null
  if (patch.target !== undefined) {
    range = patch.target ? validRange(sentence, patch.target.start, patch.target.end) : null
  } else if (sentence !== prev.sentence) {
    range = findTargetInSentence(sentence, grammarTargetText(prev))
  } else {
    range = grammarTargetRange(prev)
  }
  const target = range ? sentence.slice(range.start, range.end) : ''
  const distractors = parseGrammarDistractors((patch.distractors ?? prev.distractors).join(','), target)
  const item: LessonGrammarItem = {
    ...prev,
    sentence,
    targetStart: range?.start ?? -1,
    targetEnd: range?.end ?? -1,
    distractors,
    updatedAt: now,
  }
  delete item.source
  const next = [...items]
  next[index] = item
  return { items: next, item }
}

/** Takes one sentence out; `index` lets undo put it back in the same place. */
export function removeLessonGrammarItem(
  items: readonly LessonGrammarItem[],
  itemId: string,
): { items: LessonGrammarItem[]; removed: LessonGrammarItem; index: number } | null {
  const index = items.findIndex((item) => item.id === itemId)
  if (index < 0) return null
  return { items: items.filter((item) => item.id !== itemId), removed: items[index]!, index }
}

/** Puts a removed sentence back (undo). No-op when it is already there. */
export function restoreLessonGrammarItem(
  items: readonly LessonGrammarItem[],
  item: LessonGrammarItem,
  index: number,
): LessonGrammarItem[] {
  if (items.some((i) => i.id === item.id)) return [...items]
  const next = [...items]
  next.splice(Math.max(0, Math.min(index, next.length)), 0, item)
  return next
}

/** Sets the lesson's grammar point; empty text removes it. */
export function setLessonGrammarRule(
  rules: readonly LessonGrammarRule[],
  ref: LessonGrammarLessonRef,
  text: string,
  now: string,
): LessonGrammarRule[] {
  const clean = text.trim().slice(0, MAX_RULE_CHARS)
  const rest = rules.filter((rule) => !isInLesson(rule, ref))
  if (!clean) return rest
  return [...rest, { bookId: ref.bookId, unitId: ref.unitId, lessonId: ref.lessonId, text: clean, updatedAt: now }]
}

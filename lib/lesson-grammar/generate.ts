import { findTargetInSentence, grammarSentenceWords, parseGrammarDistractors } from '@/lib/lesson-grammar/types'

export const GRAMMAR_GENERATE_MIN_ITEMS = 6
export const GRAMMAR_GENERATE_MAX_ITEMS = 10
export const GRAMMAR_GENERATE_MAX_DISTRACTORS = 3
export const GRAMMAR_GENERATE_MAX_PAGES = 4
/** Page text sent to the model; a textbook spread is usually well under this. */
const MAX_PAGE_TEXT_CHARS = 8000
const MAX_SENTENCE_WORDS = 18
const MAX_SENTENCE_CHARS = 160
const MAX_RULE_CHARS = 300

export type GrammarGenerateInput = {
  lessonTitle: string
  pages: { pdfPage: number; text: string }[]
  /** Grammar notes from the lesson plan (teacher materials). */
  grammarNotes: string[]
  /** The lesson's current grammar point, '' when none. */
  rule: string
  /** Sentences already saved for the lesson; the model should not repeat them. */
  existingSentences: string[]
}

export type GeneratedGrammarItem = { sentence: string; target: string; distractors: string[] }

export type GeneratedGrammar = { rule: string; items: GeneratedGrammarItem[] }

export const GRAMMAR_GENERATE_SYSTEM = `You write grammar practice for an ESL lesson (children aged 7–12) from a page of their student book.

1. Find the ONE grammar point the page teaches. Use the lesson plan notes and the teacher's grammar point when given; otherwise infer it from the page (headings like "Grammar", example boxes, exercises).
2. "rule": the grammar point in one or two short, child-friendly sentences, with a tiny example (e.g. "Past tense: add -ed to most verbs (walk → walked). Some verbs change: go → went.").
3. "items": ${GRAMMAR_GENERATE_MIN_ITEMS} to ${GRAMMAR_GENERATE_MAX_ITEMS} example sentences that practise this point.
   - Prefer sentences or examples from the page itself (fix OCR noise); add your own simple ones in the same topic to reach the count.
   - Each sentence: short and simple (under ${MAX_SENTENCE_WORDS} words), one clause or two, natural English, grade-appropriate.
   - "target": the exact word or short phrase (1–3 words) in the sentence that shows the grammar point. It MUST appear in the sentence exactly as written.
   - "distractors": 2 or 3 wrong forms a learner might choose instead of the target (e.g. target "went" → "goed", "go", "goes"). They must be wrong in this sentence, never another correct answer.
   - Do not repeat sentences listed as already saved.

Return ONLY valid JSON:
{ "rule": "...", "items": [ { "sentence": "...", "target": "...", "distractors": ["...", "..."] } ] }`

function clean(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export function buildGrammarGeneratePrompt(input: GrammarGenerateInput): string {
  let budget = MAX_PAGE_TEXT_CHARS
  const pageBlocks: string[] = []
  for (const page of input.pages) {
    const text = page.text.trim().slice(0, Math.max(0, budget))
    if (!text) continue
    budget -= text.length
    pageBlocks.push(`--- Page ${page.pdfPage} ---\n${text}`)
  }
  const notes = input.grammarNotes.map(clean).filter(Boolean)
  const existing = input.existingSentences.map(clean).filter(Boolean)
  return [
    `Lesson: ${clean(input.lessonTitle) || '(untitled)'}`,
    `Teacher's grammar point: ${clean(input.rule) || '(none yet)'}`,
    `Lesson plan grammar notes: ${notes.length ? notes.join(' | ') : '(none)'}`,
    `Already saved sentences: ${existing.length ? existing.map((s) => `"${s}"`).join('; ') : '(none)'}`,
    '',
    'Student book page text:',
    pageBlocks.join('\n\n') || '(empty)',
  ].join('\n')
}

function sentenceKey(sentence: string): string {
  return clean(sentence).toLowerCase()
}

/** Reads the model's JSON into checked items: short sentences, marks that exist in the sentence, real wrong options. */
export function parseGeneratedGrammar(text: string, existingSentences: readonly string[] = []): GeneratedGrammar {
  let jsonText = text.trim()
  if (jsonText.startsWith('```')) jsonText = jsonText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    return { rule: '', items: [] }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { rule: '', items: [] }
  const o = parsed as Record<string, unknown>
  const rule = typeof o.rule === 'string' ? clean(o.rule).slice(0, MAX_RULE_CHARS) : ''
  const seen = new Set(existingSentences.map(sentenceKey))
  const items: GeneratedGrammarItem[] = []
  for (const raw of Array.isArray(o.items) ? o.items : []) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    const sentence = typeof r.sentence === 'string' ? clean(r.sentence) : ''
    const key = sentenceKey(sentence)
    if (!sentence || seen.has(key)) continue
    if (sentence.length > MAX_SENTENCE_CHARS || grammarSentenceWords(sentence).length > MAX_SENTENCE_WORDS) continue
    const range = typeof r.target === 'string' ? findTargetInSentence(sentence, r.target) : null
    const target = range ? sentence.slice(range.start, range.end) : ''
    const rawDistractors = Array.isArray(r.distractors)
      ? r.distractors.filter((d): d is string => typeof d === 'string')
      : []
    const distractors = target
      ? parseGrammarDistractors(rawDistractors.join(','), target).slice(0, GRAMMAR_GENERATE_MAX_DISTRACTORS)
      : []
    seen.add(key)
    items.push({ sentence, target, distractors })
    if (items.length >= GRAMMAR_GENERATE_MAX_ITEMS) break
  }
  return { rule, items }
}

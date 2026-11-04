import { sanitizeVaultGloss } from '@/lib/lesson-vault/picture-plan'

export type VaultCardTextFields = 'sentence' | 'meaning' | 'both'

export type VaultCardTextGenerateInput = {
  word: string
  sentence: string
  meaning: string
  fields: VaultCardTextFields
  /** Teacher asked again — avoid returning the current sentence/meaning when possible. */
  regenerate: boolean
}

export type VaultCardTextGenerateResult = {
  sentence: string
  meaning: string
}

const MAX_SENTENCE_WORDS = 16
const MAX_SENTENCE_CHARS = 140

export const VAULT_CARD_TEXT_SYSTEM = `You write ESL vocabulary flashcard text for children aged 6–12.

Rules:
- "sentence": one short, natural example sentence that uses the target word. Under ${MAX_SENTENCE_WORDS} words. The target word (or a clear inflection of it) MUST appear in the sentence. Plain English, one idea, no quotes around the sentence.
- "meaning": a short learner gloss (about 4–12 words) for the sense used in the sentence (or the most common child-friendly sense when there is no sentence). Do not copy the sentence. Do not start with the word itself. Plain English.
- Match any sense hint the teacher already wrote (existing meaning or sentence).
- When asked to regenerate, write a different sentence and/or meaning — do not repeat the avoided text.
- Only fill fields the teacher asked for; use "" for fields not requested.

Return ONLY valid JSON: { "sentence": "...", "meaning": "..." }`

export function parseVaultCardTextFields(value: unknown): VaultCardTextFields | null {
  return value === 'sentence' || value === 'meaning' || value === 'both' ? value : null
}

function clean(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** True when the sentence contains the word as its own token (case-insensitive). */
export function sentenceContainsWord(sentence: string, word: string): boolean {
  const target = clean(word)
  if (!target || !clean(sentence)) return false
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapeRegExp(target)}(?:[^\\p{L}\\p{N}]|$)`, 'iu').test(sentence)
}

export function sanitizeVaultCardSentence(raw: unknown, word: string): string {
  if (typeof raw !== 'string') return ''
  let text = clean(raw).replace(/^["'“”]+|["'“”]+$/g, '')
  if (!text) return ''
  const words = text.split(' ')
  if (words.length > MAX_SENTENCE_WORDS) text = words.slice(0, MAX_SENTENCE_WORDS).join(' ')
  text = text.slice(0, MAX_SENTENCE_CHARS)
  if (!sentenceContainsWord(text, word)) return ''
  return text
}

export function buildVaultCardTextPrompt(input: VaultCardTextGenerateInput): string {
  const word = clean(input.word)
  const sentence = clean(input.sentence).slice(0, 200)
  const meaning = clean(input.meaning).slice(0, 160)
  const needSentence = input.fields === 'sentence' || input.fields === 'both'
  const needMeaning = input.fields === 'meaning' || input.fields === 'both'
  const lines = [
    `Target word: "${word}"`,
    `Fields to write: ${input.fields}`,
    `Existing sentence: ${sentence || '(none)'}`,
    `Existing meaning: ${meaning || '(none)'}`,
  ]
  if (input.regenerate) {
    if (needSentence && sentence) lines.push(`Avoid repeating this sentence: "${sentence}"`)
    if (needMeaning && meaning) lines.push(`Avoid repeating this meaning: "${meaning}"`)
  }
  if (needSentence && meaning) {
    lines.push('The new sentence must match the existing meaning’s sense when one is given.')
  }
  if (needMeaning && sentence) {
    lines.push('The new meaning must match the sense used in the existing sentence.')
  }
  lines.push('Return only valid JSON: {"sentence":"...","meaning":"..."}')
  return lines.join('\n')
}

/** Reads the model JSON and keeps only requested, usable fields. */
export function parseVaultCardTextGenerate(
  text: string,
  input: VaultCardTextGenerateInput,
): VaultCardTextGenerateResult {
  let jsonText = text.trim()
  if (jsonText.startsWith('```')) jsonText = jsonText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    return { sentence: '', meaning: '' }
  }
  if (!parsed || typeof parsed !== 'object') return { sentence: '', meaning: '' }
  const o = parsed as Record<string, unknown>
  const needSentence = input.fields === 'sentence' || input.fields === 'both'
  const needMeaning = input.fields === 'meaning' || input.fields === 'both'
  const word = clean(input.word)
  const sentence = needSentence ? sanitizeVaultCardSentence(o.sentence, word) : ''
  let meaning = needMeaning ? sanitizeVaultGloss(o.meaning) : ''
  if (meaning && meaning.toLowerCase() === word.toLowerCase()) meaning = ''
  if (meaning && sentence && meaning.toLowerCase() === sentence.toLowerCase()) meaning = ''
  return { sentence, meaning }
}

export function vaultCardTextGenerateIsEmpty(
  result: VaultCardTextGenerateResult,
  fields: VaultCardTextFields,
): boolean {
  if (fields === 'sentence') return !result.sentence
  if (fields === 'meaning') return !result.meaning
  return !result.sentence && !result.meaning
}

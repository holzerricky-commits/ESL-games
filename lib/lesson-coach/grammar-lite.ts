import type { GrammarIssue } from '@/lib/lesson-coach/types'
import { findUncapitalizedSentenceStartLetters } from '@/lib/writing-assist/sentence-capitalization'

const THIRD_PERSON_PRONOUNS = /\b(he|she|it)\s+([a-z]+)\b/gi
const THIRD_PERSON_AUX = new Set([
  'is',
  'was',
  'are',
  'were',
  'am',
  'be',
  'been',
  'being',
  'has',
  'had',
  'have',
  'do',
  'does',
  'did',
  'will',
  'would',
  'can',
  'could',
  'should',
  'may',
  'might',
  'must',
  'shall',
  'ought',
  'need',
  'dare',
])

type DraftIssue = Omit<GrammarIssue, 'id' | 'status'>

function issueId(type: string, start: number, end: number): string {
  return `${type}:${start}:${end}`
}

function pushIssue(out: DraftIssue[], draft: DraftIssue): void {
  const overlaps = out.some(
    (i) =>
      (draft.start >= i.start && draft.start < i.end) ||
      (draft.end > i.start && draft.end <= i.end) ||
      (draft.start <= i.start && draft.end >= i.end),
  )
  if (!overlaps) out.push(draft)
}

/** Offline, high-confidence grammar checks for dictation (Phase 4). */
export function analyzeText(text: string): GrammarIssue[] {
  if (!text.trim()) return []

  const drafts: DraftIssue[] = []

  // Sentence-start capitalization (start of text or after .?! + space/newline)
  for (const hit of findUncapitalizedSentenceStartLetters(text)) {
    const ch = hit.letter
    if (!ch) continue
    pushIssue(drafts, {
      start: hit.index,
      end: hit.index + 1,
      type: 'capitalization',
      message: 'Start the sentence with a capital letter.',
      suggestion: ch.toUpperCase(),
      explanation: 'Sentences and names usually begin with a capital letter in English.',
    })
  }

  // Standalone lowercase i
  const loneIRe = /\bi\b/g
  let m: RegExpExecArray | null
  while ((m = loneIRe.exec(text)) !== null) {
    pushIssue(drafts, {
      start: m.index,
      end: m.index + 1,
      type: 'pronoun-i',
      message: 'Use capital I when you mean yourself.',
      suggestion: 'I',
      explanation: 'The pronoun for yourself is always capitalized: I.',
    })
  }

  // Space after . ? !
  const missingSpaceRe = /[.?!]([^\s\n])/g
  while ((m = missingSpaceRe.exec(text)) !== null) {
    const punctIndex = m.index
    pushIssue(drafts, {
      start: punctIndex + 1,
      end: punctIndex + 2,
      type: 'punctuation-space',
      message: 'Add a space after this punctuation mark.',
      suggestion: ` ${m[1]}`,
      explanation: 'In English, put a space after a period, question mark, or exclamation mark.',
    })
  }

  // an + consonant sound → a (simple rule)
  const anConsonantRe = /\ban\s+([bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]\w*)/g
  while ((m = anConsonantRe.exec(text)) !== null) {
    pushIssue(drafts, {
      start: m.index,
      end: m.index + 2,
      type: 'article-a',
      message: 'Use “a” before consonant sounds here.',
      suggestion: 'a',
      explanation: 'We use “a” before most consonant sounds, and “an” before vowel sounds.',
    })
  }

  // a + vowel letter → an (simple rule)
  const aAnRe = /\ba\s+([aeiouAEIOU]\w*)/g
  while ((m = aAnRe.exec(text)) !== null) {
    const wordStart = m.index
    const word = m[1]
    pushIssue(drafts, {
      start: wordStart,
      end: wordStart + 1,
      type: 'article-an',
      message: 'Use “an” before a vowel sound here.',
      suggestion: 'an',
      explanation: 'We often use “an” before words that start with a vowel sound (a, e, i, o, u).',
    })
    // Also flag the following word if teacher wants full fix — keep span on "a" only for minimal reveal
    void word
  }

  // Double spaces
  const doubleSpaceRe = / {2,}/g
  while ((m = doubleSpaceRe.exec(text)) !== null) {
    pushIssue(drafts, {
      start: m.index,
      end: m.index + m[0].length,
      type: 'double-space',
      message: 'Use a single space between words.',
      suggestion: ' ',
      explanation: 'Extra spaces are usually typos — one space is enough between words.',
    })
  }

  // Third person: he/she/it + base verb (no -s)
  while ((m = THIRD_PERSON_PRONOUNS.exec(text)) !== null) {
    const verb = m[2].toLowerCase()
    if (THIRD_PERSON_AUX.has(verb)) continue
    if (verb.length > 1 && verb.endsWith('s')) continue
    const verbStart = m.index + m[0].indexOf(m[2])
    pushIssue(drafts, {
      start: verbStart,
      end: verbStart + m[2].length,
      type: 'third-person-verb',
      message: `With “${m[1]}”, the verb usually needs -s (he/she/it + verb-s).`,
      suggestion: `${m[2]}s`,
      explanation:
        'For he, she, and it, most action verbs take -s: “He goes”, not “He go”. (Irregular verbs like “has” are exceptions.)',
    })
  }

  drafts.sort((a, b) => a.start - b.start || a.end - b.end)

  return drafts.map((d) => ({
    ...d,
    id: issueId(d.type, d.start, d.end),
    status: 'hidden' as const,
  }))
}

export function grammarCheckPatch(text: string): {
  issues: GrammarIssue[]
  issueCount: number
  revealedCount: number
  revealIndex: number
  textUndoStack: { sharedText: string; issues: GrammarIssue[] }[]
} {
  const issues = analyzeText(text)
  return {
    issues,
    issueCount: issues.length,
    revealedCount: 0,
    revealIndex: -1,
    textUndoStack: [] as { sharedText: string; issues: GrammarIssue[] }[],
  }
}

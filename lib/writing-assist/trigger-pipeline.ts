import {
  applyCorrectionToText,
  getTokenBeforeCaret,
  type LastCorrection,
  type WritingAssistTriggerChar,
} from '@/lib/writing-assist/autocorrect'
import { suggestLonePronounI } from '@/lib/writing-assist/auto-capitalize'
import { capitalizeClosingSentence } from '@/lib/writing-assist/sentence-capitalization'
import type { CorrectionResult } from '@/lib/writing-assist/spell-engine'

const PUNCTUATION_TRIGGERS = new Set<string>(['.', ',', '!', '?'])

/** Collapse trailing spaces before punctuation (e.g. `word   |` + `.` → `word|`). */
export function normalizeBeforePunctuation(
  text: string,
  caret: number,
  trigger: WritingAssistTriggerChar,
): { text: string; caret: number } {
  if (!PUNCTUATION_TRIGGERS.has(trigger)) return { text, caret }
  let end = caret
  while (end > 0 && text[end - 1] === ' ') end--
  if (end === caret) return { text, caret }
  return {
    text: text.slice(0, end) + text.slice(caret),
    caret: end,
  }
}

function insertTriggerAtCaret(
  text: string,
  caret: number,
  trigger: WritingAssistTriggerChar,
): { text: string; caret: number; last: LastCorrection | null } {
  const inserted = text.slice(0, caret) + trigger + text.slice(caret)
  const nextCaret = caret + trigger.length
  const capped = capitalizeClosingSentence(inserted, nextCaret, trigger)
  return {
    text: capped.text,
    caret: capped.caret,
    last: null,
  }
}

function resolveCorrection(
  token: string,
  trigger: WritingAssistTriggerChar,
  suggest: (word: string) => CorrectionResult | null,
): CorrectionResult | null {
  if (trigger === ' ') {
    const loneI = suggestLonePronounI(token)
    if (loneI) return { from: token, to: loneI }
  }
  return suggest(token)
}

export function runTriggerAutocorrect(
  text: string,
  caret: number,
  trigger: WritingAssistTriggerChar,
  suggest: (word: string) => CorrectionResult | null,
): { text: string; caret: number; last: LastCorrection | null } {
  const normalized = normalizeBeforePunctuation(text, caret, trigger)
  const workingText = normalized.text
  const workingCaret = normalized.caret

  const token = getTokenBeforeCaret(workingText, workingCaret)
  if (!token) {
    return insertTriggerAtCaret(workingText, workingCaret, trigger)
  }

  const correction = resolveCorrection(token.token, trigger, suggest)
  if (!correction) {
    return insertTriggerAtCaret(workingText, workingCaret, trigger)
  }

  const applied = applyCorrectionToText(workingText, token, correction, trigger)
  const capped = capitalizeClosingSentence(applied.text, applied.caret, trigger)
  return {
    text: capped.text,
    caret: capped.caret,
    last: applied.last,
  }
}

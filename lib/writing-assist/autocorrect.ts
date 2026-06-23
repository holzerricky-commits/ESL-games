import type { CorrectionResult } from '@/lib/writing-assist/spell-engine'
import { preserveCase } from '@/lib/writing-assist/spell-engine'

export type LastCorrection = {
  start: number
  end: number
  original: string
  replacement: string
  spaceInserted: boolean
}

export type TokenBeforeCaret = {
  token: string
  start: number
  end: number
}

const WORD_CHAR = /[\w\u0027\u2018\u2019\u0060\u00b4\u02bc`´-]/

export function getTokenBeforeCaret(text: string, caret: number): TokenBeforeCaret | null {
  if (caret <= 0) return null
  let end = Math.min(caret, text.length)
  let start = end
  while (start > 0 && WORD_CHAR.test(text[start - 1] ?? '')) start--
  if (start === end) return null
  const token = text.slice(start, end)
  if (!token || !/\w/.test(token)) return null
  return { token, start, end }
}

/** Keys/chars that finalize the word under the caret and may trigger autocorrect. */
export const AUTOCORRECT_TRIGGER_KEYS = [' ', '.', '!', '?', ',', '\n'] as const
export type WritingAssistTriggerChar = (typeof AUTOCORRECT_TRIGGER_KEYS)[number]
/** @deprecated Use {@link WritingAssistTriggerChar} */
export type AutocorrectTriggerKey = WritingAssistTriggerChar

export function triggerCharFromKeyboardKey(key: string): WritingAssistTriggerChar | null {
  if (key === 'Enter') return '\n'
  if ((AUTOCORRECT_TRIGGER_KEYS as readonly string[]).includes(key)) {
    return key as WritingAssistTriggerChar
  }
  return null
}

export function isAutocorrectTriggerKey(key: string): key is WritingAssistTriggerChar {
  return triggerCharFromKeyboardKey(key) != null
}

export function applyCorrectionToText(
  text: string,
  token: TokenBeforeCaret,
  correction: CorrectionResult,
  afterToken = ' ',
): { text: string; caret: number; last: LastCorrection } {
  const { start, end } = token
  const next = text.slice(0, start) + correction.to + afterToken + text.slice(end)
  const caret = start + correction.to.length + afterToken.length
  return {
    text: next,
    caret,
    last: {
      start,
      end: caret,
      original: token.token,
      replacement: correction.to,
      spaceInserted: afterToken === ' ',
    },
  }
}

export function tryRevertLastCorrection(
  text: string,
  caret: number,
  last: LastCorrection | null,
): { text: string; caret: number; reverted: boolean } | null {
  if (!last) return null
  if (caret !== last.end) return null

  const restored =
    text.slice(0, last.start) + last.original + text.slice(last.end)
  const newCaret = last.start + last.original.length
  return { text: restored, caret: newCaret, reverted: true }
}

export function shouldClearLastCorrection(
  key: string,
  caret: number,
  last: LastCorrection | null,
): boolean {
  if (!last) return false
  if (key === 'Backspace' && caret === last.end) return false
  return true
}

export function matchTranspose2(a: string, b: string): boolean {
  if (a.length !== 2 || b.length !== 2) return false
  return a[0] === b[1] && a[1] === b[0]
}

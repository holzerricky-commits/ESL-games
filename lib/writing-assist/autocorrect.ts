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

const WORD_CHAR = /[\w''-]/

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

export function applyCorrectionToText(
  text: string,
  token: TokenBeforeCaret,
  correction: CorrectionResult,
  insertSpace: boolean,
): { text: string; caret: number; last: LastCorrection } {
  const { start, end } = token
  const next = text.slice(0, start) + correction.to + (insertSpace ? ' ' : '') + text.slice(end)
  const caret = start + correction.to.length + (insertSpace ? 1 : 0)
  return {
    text: next,
    caret,
    last: {
      start,
      end: caret,
      original: token.token,
      replacement: correction.to,
      spaceInserted: insertSpace,
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

import type { NormRect, PdfPageTextRun } from '@/lib/books/pdf-page-text-geometry'

/** A word (or short phrase) picked on the page, with the sentence it sits in. */
export type PdfPageWordPick = {
  word: string
  sentence: string
  /** Page-normalized boxes covering the picked text (for the highlight). */
  rects: NormRect[]
}

const WORD_CHAR = /[\p{L}\p{N}'’-]/u
const EDGE_PUNCT = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu
const SENTENCE_END = /[.!?]/
const MAX_SENTENCE_CHARS = 280

function cleanWord(text: string): string {
  return text.replace(/\s+/g, ' ').replace(EDGE_PUNCT, '').trim()
}

/** Joined page text plus the start offset of each run (same spacing rule as `runsToPlainText`). */
function joinRuns(runs: readonly PdfPageTextRun[]): { text: string; offsets: number[] } {
  let text = ''
  const offsets: number[] = []
  for (const run of runs) {
    if (text && !/\s$/.test(text) && !/^\s/.test(run.text)) text += ' '
    offsets.push(text.length)
    text += run.text
  }
  return { text, offsets }
}

/**
 * Sentence around [start, end) in `text`. Empty when no sentence end is found nearby
 * (titles, labels, OCR fragments).
 */
export function sentenceAroundRange(text: string, start: number, end: number): string {
  let to = -1
  for (let i = Math.max(end - 1, start); i < text.length && i - start <= MAX_SENTENCE_CHARS; i++) {
    if (SENTENCE_END.test(text[i]!)) {
      to = i + 1
      while (to < text.length && /["'’”)]/.test(text[to]!)) to++
      break
    }
  }
  if (to < 0) return ''
  let from = 0
  for (let i = start - 1; i >= 0; i--) {
    if (start - i > MAX_SENTENCE_CHARS) return ''
    if (SENTENCE_END.test(text[i]!) && (i + 1 >= text.length || /\s/.test(text[i + 1]!))) {
      from = i + 1
      break
    }
  }
  const sentence = text.slice(from, to).replace(/\s+/g, ' ').trim()
  return sentence.length > MAX_SENTENCE_CHARS ? '' : sentence
}

/** Character range of the word at a page-normalized x inside one run (proportional char width). */
export function wordRangeInRunAtX(run: PdfPageTextRun, nx: number): { start: number; end: number } | null {
  const text = run.text
  if (!text || !(run.w > 0)) return null
  const ratio = Math.min(1, Math.max(0, (nx - run.x) / run.w))
  let i = Math.min(text.length - 1, Math.floor(ratio * text.length))
  if (!WORD_CHAR.test(text[i]!)) {
    const right = text.slice(i).search(WORD_CHAR)
    const leftText = text.slice(0, i)
    let left = -1
    for (let j = leftText.length - 1; j >= 0; j--) {
      if (WORD_CHAR.test(leftText[j]!)) {
        left = j
        break
      }
    }
    if (right < 0 && left < 0) return null
    if (right < 0) i = left
    else if (left < 0) i = i + right
    else i = i + right - i < i - left ? i + right : left
  }
  let start = i
  let end = i + 1
  while (start > 0 && WORD_CHAR.test(text[start - 1]!)) start--
  while (end < text.length && WORD_CHAR.test(text[end]!)) end++
  return { start, end }
}

function subRunRect(run: PdfPageTextRun, start: number, end: number): NormRect {
  const len = Math.max(1, run.text.length)
  return {
    x: run.x + (run.w * start) / len,
    y: run.y,
    w: (run.w * (end - start)) / len,
    h: run.h,
  }
}

/** Click (or drag inside one run): whole words between the two x positions, not the whole run. */
export function pickWordAtPoint(
  runs: readonly PdfPageTextRun[],
  runIndex: number,
  nx: number,
  nxEnd: number = nx,
): PdfPageWordPick | null {
  const pos = runs.findIndex((r) => r.index === runIndex)
  if (pos < 0) return null
  const run = runs[pos]!
  const a = wordRangeInRunAtX(run, Math.min(nx, nxEnd))
  const b = wordRangeInRunAtX(run, Math.max(nx, nxEnd))
  if (!a || !b) return null
  const range = { start: Math.min(a.start, b.start), end: Math.max(a.end, b.end) }
  const word = cleanWord(run.text.slice(range.start, range.end))
  if (!word) return null
  const { text, offsets } = joinRuns(runs)
  const base = offsets[pos]!
  return {
    word,
    sentence: sentenceAroundRange(text, base + range.start, base + range.end),
    rects: [subRunRect(run, range.start, range.end)],
  }
}

/** Drag selection across one or more whole runs. */
export function pickSelectedRuns(
  runs: readonly PdfPageTextRun[],
  selection: readonly PdfPageTextRun[],
): PdfPageWordPick | null {
  if (selection.length === 0) return null
  const firstPos = runs.findIndex((r) => r.index === selection[0]!.index)
  const lastPos = runs.findIndex((r) => r.index === selection[selection.length - 1]!.index)
  if (firstPos < 0 || lastPos < 0) return null
  const { text, offsets } = joinRuns(runs)
  const start = offsets[firstPos]!
  const end = offsets[lastPos]! + runs[lastPos]!.text.length
  const word = cleanWord(text.slice(start, end))
  if (!word) return null
  return {
    word,
    sentence: sentenceAroundRange(text, start, end),
    rects: selection.map((run) => ({ x: run.x, y: run.y, w: run.w, h: run.h })),
  }
}

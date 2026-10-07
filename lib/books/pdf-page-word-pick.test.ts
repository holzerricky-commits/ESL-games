import { describe, expect, it } from 'vitest'
import type { PdfPageTextRun } from '@/lib/books/pdf-page-text-geometry'
import {
  pickSelectedRuns,
  pickWordAtPoint,
  sentenceAroundRange,
  wordRangeInRunAtX,
} from '@/lib/books/pdf-page-word-pick'

function run(index: number, text: string, y: number): PdfPageTextRun {
  return { index, text, x: 0.1, y, w: 0.8, h: 0.03 }
}

/** x position at the middle of a character inside a run. */
function xAtChar(r: PdfPageTextRun, charIndex: number): number {
  return r.x + (r.w * (charIndex + 0.5)) / r.text.length
}

describe('wordRangeInRunAtX', () => {
  it('finds the word under the pointer inside a long line', () => {
    const r = run(0, 'The seastar lives in the tide pool.', 0.1)
    const at = r.text.indexOf('seastar') + 3
    const range = wordRangeInRunAtX(r, xAtChar(r, at))
    expect(r.text.slice(range!.start, range!.end)).toBe('seastar')
  })

  it('snaps from a space to the nearest word', () => {
    const r = run(0, 'big  turtle', 0.1)
    const range = wordRangeInRunAtX(r, xAtChar(r, 4))
    expect(r.text.slice(range!.start, range!.end)).toBe('turtle')
  })
})

describe('sentenceAroundRange', () => {
  it('returns the sentence around the word', () => {
    const text = 'Turtles swim far. The seastar lives in the tide pool. It is small.'
    const start = text.indexOf('seastar')
    expect(sentenceAroundRange(text, start, start + 7)).toBe('The seastar lives in the tide pool.')
  })

  it('returns empty when there is no sentence end', () => {
    const text = 'Chapter 3 Sea Life'
    expect(sentenceAroundRange(text, 10, 13)).toBe('')
  })
})

describe('pickWordAtPoint', () => {
  it('builds the sentence across line runs', () => {
    const runs = [run(0, 'Linda saw a turtle. The seastar lives', 0.1), run(1, 'in the tide pool. Then it rained.', 0.15)]
    const at = runs[0]!.text.indexOf('seastar') + 1
    const pick = pickWordAtPoint(runs, 0, xAtChar(runs[0]!, at))
    expect(pick?.word).toBe('seastar')
    expect(pick?.sentence).toBe('The seastar lives in the tide pool.')
    expect(pick?.rects).toHaveLength(1)
    expect(pick!.rects[0]!.w).toBeLessThan(runs[0]!.w)
  })

  it('picks whole words between two points in one run', () => {
    const runs = [run(0, 'We found a tide pool today.', 0.1)]
    const t = runs[0]!.text
    const pick = pickWordAtPoint(runs, 0, xAtChar(runs[0]!, t.indexOf('tide') + 1), xAtChar(runs[0]!, t.indexOf('pool') + 2))
    expect(pick?.word).toBe('tide pool')
  })

  it('strips punctuation from the picked word', () => {
    const runs = [run(0, 'Look at the shell.', 0.1)]
    const at = runs[0]!.text.indexOf('shell') + 2
    expect(pickWordAtPoint(runs, 0, xAtChar(runs[0]!, at))?.word).toBe('shell')
  })
})

describe('pickSelectedRuns', () => {
  it('uses the selected runs as the word and finds the sentence', () => {
    const runs = [run(0, 'A', 0.1), run(1, 'tide', 0.1), run(2, 'pool.', 0.1)]
    const pick = pickSelectedRuns(runs, [runs[1]!, runs[2]!])
    expect(pick?.word).toBe('tide pool')
    expect(pick?.sentence).toBe('A tide pool.')
  })
})

import { describe, expect, it } from 'vitest'
import { filterBodyOcrWords, filterDecorativeOcrLines } from '@/lib/books/searchable-pdf-body-text'
import type { OcrLine, OcrWordBox } from '@/lib/books/searchable-pdf-text-layer'

function box(text: string, y0: number, y1: number, x0 = 10, x1 = 80): OcrWordBox {
  return { text, x0, y0, x1, y1 }
}

describe('filterBodyOcrWords', () => {
  it('keeps body-sized words and drops a tall title and a tiny label', () => {
    const words = [
      box('THE', 10, 50),
      box('WOLF', 10, 50, 90, 180),
      box('Once', 80, 100),
      box('upon', 80, 100, 90, 150),
      box('a', 80, 100, 160, 180),
      box('time', 80, 100, 190, 250),
      box('p.12', 400, 408, 10, 40),
    ]
    const kept = filterBodyOcrWords(words).map((w) => w.text)
    expect(kept).toEqual(['Once', 'upon', 'a', 'time'])
  })

  it('keeps all words when heights are similar', () => {
    const words = [
      box('The', 20, 40),
      box('cat', 21, 41, 50, 90),
      box('sat', 20, 40, 100, 140),
    ]
    expect(filterBodyOcrWords(words)).toHaveLength(3)
  })

  it('drops empty and degenerate boxes', () => {
    expect(
      filterBodyOcrWords([
        box('ok', 10, 30),
        { text: '', x0: 0, y0: 10, x1: 40, y1: 30 },
        { text: 'x', x0: 0, y0: 10, x1: 1, y1: 12 },
      ]),
    ).toHaveLength(1)
  })

  it('returns empty for no words', () => {
    expect(filterBodyOcrWords([])).toEqual([])
  })
})

describe('filterDecorativeOcrLines', () => {
  it('drops a short oversized title line', () => {
    const lines: OcrLine[] = [
      {
        words: [box('WOLF', 10, 50), box('STORY', 10, 50, 60, 140)],
        baseline: 50,
        lineHeight: 40,
      },
      {
        words: [box('Once', 80, 100), box('upon', 80, 100, 50, 100), box('a', 80, 100, 110, 130), box('time', 80, 100, 140, 200)],
        baseline: 100,
        lineHeight: 20,
      },
    ]
    const kept = filterDecorativeOcrLines(lines)
    expect(kept).toHaveLength(1)
    expect(kept[0]!.words.map((w) => w.text)).toEqual(['Once', 'upon', 'a', 'time'])
  })

  it('keeps short lines that match body height', () => {
    const lines: OcrLine[] = [
      {
        words: [box('He', 80, 100), box('ran.', 80, 100, 40, 90)],
        baseline: 100,
        lineHeight: 20,
      },
      {
        words: [box('Once', 120, 140), box('upon', 120, 140, 50, 100), box('a', 120, 140, 110, 130), box('time', 120, 140, 140, 200)],
        baseline: 140,
        lineHeight: 20,
      },
    ]
    expect(filterDecorativeOcrLines(lines)).toHaveLength(2)
  })
})

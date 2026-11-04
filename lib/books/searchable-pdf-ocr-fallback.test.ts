import { describe, expect, it } from 'vitest'
import {
  CLOUD_OCR_WORD_CONFIDENCE,
  OCR_PAGE_CONFIDENCE_MIN,
  medianOcrConfidence,
  pageNeedsCloudOcrFallback,
  parseCloudOcrWords,
  parseCloudOcrWordsFromModelText,
} from '@/lib/books/searchable-pdf-ocr-fallback'

/** Body-sized word on one text line (20px tall), spaced across the page. */
function bodyWord(index: number, confidence: number) {
  const x0 = 10 + index * 60
  return { text: `word${index}`, confidence, x0, y0: 100, x1: x0 + 50, y1: 120 }
}

describe('pageNeedsCloudOcrFallback', () => {
  it('asks for cloud OCR when the page has no words', () => {
    expect(pageNeedsCloudOcrFallback([])).toBe(true)
    expect(medianOcrConfidence([])).toBe(0)
  })

  it('asks for cloud OCR when fewer than 5 body words came back', () => {
    const words = [0, 1, 2, 3].map((i) => bodyWord(i, 95))
    expect(pageNeedsCloudOcrFallback(words)).toBe(true)
  })

  it('asks for cloud OCR when the body median confidence is under 65', () => {
    const words = [90, 40, 50, 45, 55].map((c, i) => bodyWord(i, c))
    expect(medianOcrConfidence(words)).toBe(50)
    expect(pageNeedsCloudOcrFallback(words)).toBe(true)
  })

  it('keeps local OCR when the body median is 65 or higher', () => {
    const words = [OCR_PAGE_CONFIDENCE_MIN, 70, 80, 90, 65].map((c, i) => bodyWord(i, c))
    expect(pageNeedsCloudOcrFallback(words)).toBe(false)
  })

  it('ignores low-confidence junk boxes from illustrations', () => {
    const body = [80, 85, 90, 75, 88].map((c, i) => bodyWord(i, c))
    const junk = [0, 1, 2, 3, 4, 5].map((i) => ({
      text: '~',
      confidence: 10,
      x0: 400 + i * 20,
      y0: 400,
      x1: 410 + i * 20,
      y1: 460,
    }))
    expect(medianOcrConfidence([...body, ...junk])).toBeLessThan(OCR_PAGE_CONFIDENCE_MIN)
    expect(pageNeedsCloudOcrFallback([...body, ...junk])).toBe(false)
  })
})

describe('parseCloudOcrWords', () => {
  it('scales 0–1 boxes onto the page image', () => {
    const words = parseCloudOcrWords(
      {
        words: [
          { text: 'upon', x0: 0.2, y0: 0.1, x1: 0.4, y1: 0.2 },
          { text: 'Once', x0: 0.05, y0: 0.1, x1: 0.15, y1: 0.2 },
        ],
      },
      1000,
      2000,
    )
    expect(words.map((w) => w.text)).toEqual(['Once', 'upon'])
    expect(words[0]).toMatchObject({
      text: 'Once',
      confidence: CLOUD_OCR_WORD_CONFIDENCE,
      x0: 50,
      y0: 200,
      x1: 150,
      y1: 400,
    })
  })

  it('treats coordinates above 1.5 as pixels', () => {
    const words = parseCloudOcrWords(
      { words: [{ text: 'wolf', x0: 10, y0: 20, x1: 80, y1: 50 }] },
      1000,
      2000,
    )
    expect(words[0]).toMatchObject({ x0: 10, y0: 20, x1: 80, y1: 50 })
  })

  it('drops empty text and boxes that collapse to a line', () => {
    const words = parseCloudOcrWords(
      {
        words: [
          { text: '  ', x0: 0.1, y0: 0.1, x1: 0.2, y1: 0.2 },
          { text: 'a', x0: 0.1, y0: 0.1, x1: 0.1, y1: 0.2 },
          { text: 'time', x0: 0.3, y0: 0.1, x1: 0.5, y1: 0.2 },
        ],
      },
      1000,
      2000,
    )
    expect(words.map((w) => w.text)).toEqual(['time'])
  })

  it('reads a fenced model reply', () => {
    const text = '```json\n{"words":[{"text":"sat","x0":0.1,"y0":0.2,"x1":0.2,"y1":0.3}]}\n```'
    const words = parseCloudOcrWordsFromModelText(text, 100, 100)
    expect(words).toHaveLength(1)
    expect(words[0]?.text).toBe('sat')
  })

  it('returns nothing for broken JSON', () => {
    expect(parseCloudOcrWordsFromModelText('not json', 100, 100)).toEqual([])
  })
})

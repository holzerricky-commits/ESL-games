import { describe, expect, it } from 'vitest'
import {
  CLOUD_OCR_WORD_CONFIDENCE,
  OCR_PAGE_CONFIDENCE_MIN,
  medianOcrConfidence,
  pageNeedsCloudOcrFallback,
  parseCloudOcrWords,
  parseCloudOcrWordsFromModelText,
} from '@/lib/books/searchable-pdf-ocr-fallback'

describe('pageNeedsCloudOcrFallback', () => {
  it('asks for cloud OCR when the page has no words', () => {
    expect(pageNeedsCloudOcrFallback([])).toBe(true)
    expect(medianOcrConfidence([])).toBe(0)
  })

  it('asks for cloud OCR when the median confidence is under 65', () => {
    const words = [{ confidence: 90 }, { confidence: 40 }, { confidence: 50 }]
    expect(medianOcrConfidence(words)).toBe(50)
    expect(pageNeedsCloudOcrFallback(words)).toBe(true)
  })

  it('keeps local OCR when the median confidence is 65 or higher', () => {
    expect(pageNeedsCloudOcrFallback([{ confidence: OCR_PAGE_CONFIDENCE_MIN }])).toBe(false)
    expect(pageNeedsCloudOcrFallback([{ confidence: 80 }, { confidence: 70 }, { confidence: 90 }])).toBe(
      false,
    )
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

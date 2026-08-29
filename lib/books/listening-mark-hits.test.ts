import { describe, expect, it } from 'vitest'
import {
  parseListeningMarkHits,
  resolveListeningMarkPdfPage,
} from '@/lib/books/listening-mark-hits'

describe('resolveListeningMarkPdfPage', () => {
  const chunk = [47, 48] as const

  it('keeps a real PDF page in the chunk', () => {
    expect(resolveListeningMarkPdfPage(47, chunk)).toBe(47)
    expect(resolveListeningMarkPdfPage(48, chunk)).toBe(48)
  })

  it('maps 1-based image indexes to chunk PDF pages', () => {
    expect(resolveListeningMarkPdfPage(1, chunk)).toBe(47)
    expect(resolveListeningMarkPdfPage(2, chunk)).toBe(48)
  })

  it('drops invalid pages', () => {
    expect(resolveListeningMarkPdfPage(3, chunk)).toBeNull()
    expect(resolveListeningMarkPdfPage(99, chunk)).toBeNull()
    expect(resolveListeningMarkPdfPage(0, chunk)).toBeNull()
    expect(resolveListeningMarkPdfPage(NaN, chunk)).toBeNull()
  })

  it('maps index 1 when the real PDF page is also 1', () => {
    expect(resolveListeningMarkPdfPage(1, [1, 2])).toBe(1)
  })
})

describe('parseListeningMarkHits', () => {
  it('remaps image-order pages and keeps labels', () => {
    const hits = parseListeningMarkHits(
      {
        hits: [
          { pdfPage: 1, label: '001', x: 0.2, y: 0.3 },
          { pdfPage: 2, label: '002', x: 0.8, y: 0.9 },
          { pdfPage: 47, label: '003', x: 0.1, y: 0.1 },
          { pdfPage: 9, label: 'bad', x: 0.5, y: 0.5 },
          { pdfPage: 1, label: '  ', x: 0.5, y: 0.5 },
        ],
      },
      [47, 48],
    )
    expect(hits).toEqual([
      { pdfPage: 47, label: '001', x: 0.2, y: 0.3 },
      { pdfPage: 48, label: '002', x: 0.8, y: 0.9 },
      { pdfPage: 47, label: '003', x: 0.1, y: 0.1 },
    ])
  })
})

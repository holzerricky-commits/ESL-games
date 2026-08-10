import { describe, expect, it } from 'vitest'
import {
  PASTED_TEXT_MAX_LENGTH,
  readPlainTextFromClipboardData,
  sanitizePastedPlainText,
  textPasteNormPoint,
} from '@/lib/books/clipboard-text'

describe('sanitizePastedPlainText', () => {
  it('trims and normalizes line endings', () => {
    expect(sanitizePastedPlainText('  hello\r\nworld  ')).toBe('hello\nworld')
  })

  it('returns null for whitespace-only input', () => {
    expect(sanitizePastedPlainText('   \n  ')).toBeNull()
  })

  it('caps length', () => {
    const long = 'a'.repeat(PASTED_TEXT_MAX_LENGTH + 50)
    const out = sanitizePastedPlainText(long)
    expect(out).toHaveLength(PASTED_TEXT_MAX_LENGTH)
  })
})

describe('readPlainTextFromClipboardData', () => {
  it('reads plain text when no image is present', () => {
    const clipboard = {
      items: [{ type: 'text/plain' }],
      getData: (type: string) => (type === 'text/plain' ? 'Copied sentence' : ''),
    } as unknown as DataTransfer
    expect(readPlainTextFromClipboardData(clipboard)).toBe('Copied sentence')
  })

  it('skips text when an image item is on the clipboard', () => {
    const clipboard = {
      items: [{ type: 'image/png' }, { type: 'text/plain' }],
      getData: (type: string) => (type === 'text/plain' ? 'caption' : ''),
    } as unknown as DataTransfer
    expect(readPlainTextFromClipboardData(clipboard)).toBeNull()
  })
})

describe('textPasteNormPoint', () => {
  it('centers horizontally and in the visible viewport band when no anchor is set', () => {
    const point = textPasteNormPoint(2000, 400, 800)
    expect(point.x).toBe(0.5)
    expect(point.y).toBeCloseTo((800 + 200) / 2000, 5)
  })
})

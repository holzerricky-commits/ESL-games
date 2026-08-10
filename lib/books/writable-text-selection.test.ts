import { describe, expect, it } from 'vitest'
import {
  isMeaningfulWritableSelectionText,
  normalizeWritableSelectionText,
  writableSelectionContext,
  writableTextareaSubstring,
  WRITABLE_TEXT_SELECTION_MAX_CHARS,
} from '@/lib/books/writable-text-selection'

describe('writable-text-selection', () => {
  it('normalizes and caps selected text', () => {
    expect(normalizeWritableSelectionText('  hello  ')).toBe('hello')
    const long = 'a'.repeat(WRITABLE_TEXT_SELECTION_MAX_CHARS + 20)
    expect(normalizeWritableSelectionText(long)).toHaveLength(WRITABLE_TEXT_SELECTION_MAX_CHARS)
  })

  it('rejects whitespace-only selections', () => {
    expect(isMeaningfulWritableSelectionText('   ')).toBe(false)
    expect(isMeaningfulWritableSelectionText('word')).toBe(true)
  })

  it('uses full field value as context for substring lookups', () => {
    const field = 'The cat sat on the mat.'
    expect(writableSelectionContext(field, 'cat')).toBe(field)
    expect(writableSelectionContext(field, field)).toBe('')
    expect(writableSelectionContext(field, 'dog')).toBe('')
    expect(writableSelectionContext('', 'cat')).toBe('')
  })

  it('reads substring from textarea selection indices', () => {
    const value = 'The quick brown fox'
    expect(writableTextareaSubstring(value, 4, 9)).toBe('quick')
    expect(writableTextareaSubstring(value, 9, 4)).toBe('quick')
    expect(writableTextareaSubstring(value, 3, 3)).toBeNull()
    expect(writableTextareaSubstring(value, 0, 3)).toBe('The')
  })
})

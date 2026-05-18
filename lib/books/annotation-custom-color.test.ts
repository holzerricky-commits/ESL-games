import { describe, expect, it } from 'vitest'
import { isValidCustomHex, normalizeCustomHex, parseCustomHexInput } from '@/lib/books/annotation-custom-color'

describe('annotation-custom-color', () => {
  it('validates and normalizes hex', () => {
    expect(isValidCustomHex('#AABBCC')).toBe(true)
    expect(normalizeCustomHex('#AABBCC')).toBe('#aabbcc')
    expect(isValidCustomHex('aabbcc')).toBe(false)
    expect(isValidCustomHex('#abc')).toBe(false)
  })

  it('parses hex input variants', () => {
    expect(parseCustomHexInput('aabbcc')).toBe('#aabbcc')
    expect(parseCustomHexInput('#AABBCC')).toBe('#aabbcc')
    expect(parseCustomHexInput('not-a-color')).toBeNull()
  })
})

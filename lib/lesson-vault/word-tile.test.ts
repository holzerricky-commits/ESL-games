import { describe, expect, it } from 'vitest'
import { wordTileIndex, wordTileLetter } from './word-tile'

describe('vault word tile', () => {
  it('uses the first letter, upper case', () => {
    expect(wordTileLetter('  investigation')).toBe('I')
    expect(wordTileLetter('"élan"')).toBe('É')
    expect(wordTileLetter('...')).toBe('')
  })

  it('gives a word the same colour slot every time, ignoring case', () => {
    expect(wordTileIndex('Bamboo', 8)).toBe(wordTileIndex('bamboo ', 8))
    expect(wordTileIndex('bamboo', 8)).toBeGreaterThanOrEqual(0)
    expect(wordTileIndex('bamboo', 8)).toBeLessThan(8)
    expect(wordTileIndex('x', 0)).toBe(0)
  })
})

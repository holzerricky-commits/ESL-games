import { describe, expect, it } from 'vitest'
import { parseVisionPickIndex } from '@/lib/quiz-image-vision-pick-parse'

describe('parseVisionPickIndex', () => {
  it('reads a plain JSON index', () => {
    expect(parseVisionPickIndex('{"index":3}', 8)).toBe(3)
  })

  it('accepts fenced JSON', () => {
    expect(parseVisionPickIndex('```json\n{"index":1}\n```', 5)).toBe(1)
  })

  it('rejects out of range or bad JSON', () => {
    expect(parseVisionPickIndex('{"index":9}', 5)).toBeNull()
    expect(parseVisionPickIndex('not json', 5)).toBeNull()
    expect(parseVisionPickIndex('{"index":0}', 0)).toBeNull()
  })
})

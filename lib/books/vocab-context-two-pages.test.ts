import { describe, expect, it } from 'vitest'
import { pdfTwoPageWindowForVocabPart } from '@/lib/books/vocab-context-two-pages'

describe('pdfTwoPageWindowForVocabPart', () => {
  it('uses start and start+1 when end missing', () => {
    expect(pdfTwoPageWindowForVocabPart(10, undefined)).toEqual({ start: 10, end: 11 })
  })

  it('uses start and end when span is two pages', () => {
    expect(pdfTwoPageWindowForVocabPart(10, 11)).toEqual({ start: 10, end: 11 })
  })

  it('clamps to first two pages when span is wider', () => {
    expect(pdfTwoPageWindowForVocabPart(10, 20)).toEqual({ start: 10, end: 11 })
  })

  it('defaults when hints missing', () => {
    expect(pdfTwoPageWindowForVocabPart(undefined, undefined)).toEqual({ start: 1, end: 2 })
  })
})

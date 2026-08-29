import { describe, expect, it } from 'vitest'
import {
  resolveTocExtractProfile,
  resolveTocExtractProfileFromLabels,
  tocChunkLabelStyleForProfile,
  tocExtractPromptForProfile,
} from '@/lib/books/toc-extract-profile'

describe('resolveTocExtractProfile', () => {
  it('defaults unknown books to generic (not Journeys)', () => {
    expect(resolveTocExtractProfile({})).toBe('generic')
    expect(resolveTocExtractProfile({ title: 'Reading Explorer 3' })).toBe('generic')
  })

  it('picks Journeys when series or name cues say so', () => {
    expect(resolveTocExtractProfile({ title: 'Journeys Grade 3' })).toBe('journeys')
    expect(resolveTocExtractProfile({ series: 'Journeys' })).toBe('journeys')
    expect(resolveTocExtractProfile({ id: 'journeys-g3-book-1' })).toBe('journeys')
  })

  it('picks Workshop from role or filename', () => {
    expect(resolveTocExtractProfile({ series: 'Wonders', role: 'Workshop' })).toBe('wonders_workshop')
    expect(resolveTocExtractProfile({ id: 'readingwriting-workshop-g2' })).toBe('wonders_workshop')
  })

  it('picks Literature from role or anthology/literature name', () => {
    expect(resolveTocExtractProfile({ series: 'Wonders', role: 'Literature' })).toBe('wonders_literature')
    expect(resolveTocExtractProfile({ id: 'literature-anthology-g2' })).toBe('wonders_literature')
  })

  it('infers from messy titles without saved catalog fields', () => {
    expect(resolveTocExtractProfileFromLabels({ title: 'Wonders Grade 2 Workshop' })).toBe(
      'wonders_workshop',
    )
    expect(resolveTocExtractProfileFromLabels({ title: 'Wonders G2 Literature Anthology' })).toBe(
      'wonders_literature',
    )
  })

  it('maps label style and prompts per profile', () => {
    expect(tocChunkLabelStyleForProfile('journeys')).toBe('lesson')
    expect(tocChunkLabelStyleForProfile('generic')).toBe('plain')
    expect(tocChunkLabelStyleForProfile('wonders_workshop')).toBe('week')
    expect(tocChunkLabelStyleForProfile('wonders_literature')).toBe('week')
    expect(tocExtractPromptForProfile('wonders_workshop')).toMatch(/Week/i)
    expect(tocExtractPromptForProfile('wonders_literature')).toMatch(/Anchor/i)
    expect(tocExtractPromptForProfile('journeys')).toMatch(/red shield/i)
    expect(tocExtractPromptForProfile('generic')).toMatch(/NOT Journeys/i)
    expect(tocExtractPromptForProfile('generic')).toMatch(/set startPrintedPage to null/i)
    expect(tocExtractPromptForProfile('generic')).not.toMatch(/Ignore rows without page numbers/i)
  })
})

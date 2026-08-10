import { describe, expect, it } from 'vitest'
import {
  proposeTocPdfRange,
  scoreTocCandidatePage,
  shouldEarlyStopTocScan,
} from '@/lib/books/toc-page-detect'

const READING_EXPLORER_CONTENTS = `
CONTENTS
Scope and Sequence 4
Introduction 6
Unit 1 Amazing Animals 7
Unit 2 Travel and Adventure 21
Unit 3 The Power of Music 35
Unit 4 Into Space 49
Unit 5 City Life 63
Unit 6 Backyard Discoveries 77
Unit 7 When Dinosaurs Ruled 91
Unit 8 Stories and Storytellers 105
Unit 9 Unusual Jobs 117
Unit 10 Uncovering the Past 131
Unit 11 Plastic Planet 145
Unit 12 Vanished! 159
Credits and Acknowledgments 173
`

const SCOPE_AND_SEQUENCE = `
SCOPE AND SEQUENCE
UNIT THEME READING VIDEO
1 Amazing Animals
A: The Incredible Dolphin
B: Master of Disguise
A Chameleon's Colors
2 Travel and Adventure
A: Adventure Vacations
B: Mystery of Nazca
Adventure Vacations: Extreme Edition
7 When Dinosaurs Ruled
A: The Truth about Dinosaurs
B: Mystery of the Terrible Hand
Dinosaurs: A Brief History
`

const STORY_PAGE = `
The Incredible Dolphin
Dolphins are among the most intelligent animals in the ocean.
They live in groups called pods and communicate with clicks and whistles.
Scientists have studied dolphin behavior for many years and continue
to learn new things about how these animals think and play together.
In this reading you will learn about dolphin intelligence and social life.
`

describe('scoreTocCandidatePage', () => {
  it('scores Reading Explorer–style contents highly', () => {
    const { score, reasons } = scoreTocCandidatePage(READING_EXPLORER_CONTENTS)
    expect(score).toBeGreaterThanOrEqual(50)
    expect(reasons.some((r) => r === 'contents' || r.startsWith('units_'))).toBe(true)
  })

  it('scores scope and sequence highly', () => {
    const { score, reasons } = scoreTocCandidatePage(SCOPE_AND_SEQUENCE)
    expect(score).toBeGreaterThanOrEqual(40)
    expect(reasons).toContain('scope_and_sequence')
  })

  it('scores story prose low', () => {
    const { score } = scoreTocCandidatePage(STORY_PAGE)
    expect(score).toBeLessThan(22)
  })
})

describe('proposeTocPdfRange', () => {
  it('proposes contiguous front-matter pages and ignores later story', () => {
    const proposal = proposeTocPdfRange([
      { pdfPage: 1, text: 'Cover Reading Explorer' },
      { pdfPage: 2, text: 'Title page' },
      { pdfPage: 3, text: READING_EXPLORER_CONTENTS },
      { pdfPage: 4, text: SCOPE_AND_SEQUENCE },
      { pdfPage: 5, text: 'ACADEMIC SKILLS\nREADING SKILL VOCABULARY BUILDING\nUnit rows A: Skimming B: Main Ideas' },
      { pdfPage: 6, text: STORY_PAGE },
      { pdfPage: 7, text: STORY_PAGE },
    ])
    expect(proposal).not.toBeNull()
    expect(proposal!.from).toBe(3)
    expect(proposal!.to).toBeGreaterThanOrEqual(4)
    expect(proposal!.to).toBeLessThanOrEqual(5)
    expect(['high', 'medium']).toContain(proposal!.confidence)
  })

  it('returns null when no page clears the bar', () => {
    expect(
      proposeTocPdfRange([
        { pdfPage: 1, text: STORY_PAGE },
        { pdfPage: 2, text: STORY_PAGE },
      ]),
    ).toBeNull()
  })
})

describe('shouldEarlyStopTocScan', () => {
  it('stops after TOC block when the next page is low', () => {
    expect(
      shouldEarlyStopTocScan({
        pdfPage: 6,
        pageScore: 8,
        tocStartPage: 3,
        tocEndPage: 5,
      }),
    ).toBe(true)
  })

  it('does not stop before a TOC run exists', () => {
    expect(
      shouldEarlyStopTocScan({
        pdfPage: 2,
        pageScore: 0,
        tocStartPage: null,
        tocEndPage: null,
      }),
    ).toBe(false)
  })
})

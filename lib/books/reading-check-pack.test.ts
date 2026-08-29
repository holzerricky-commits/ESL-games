import { describe, expect, it } from 'vitest'
import {
  approveReadingCheckPack,
  createEmptyReadingCheckPack,
  createEmptyReadingCheckStop,
  demoteReadingCheckPackToDraft,
  getLiveEligibleReadingCheckPack,
  listReadingCheckLivePinsOnSpread,
  readingCheckPackCanApprove,
  sanitizeReadingCheckPack,
} from '@/lib/books/reading-check-pack'

describe('reading-check-pack', () => {
  it('sanitizes mcq and true/false questions', () => {
    const pack = sanitizeReadingCheckPack({
      storyId: 's1',
      bookId: 'b1',
      unitId: 'u1',
      status: 'draft',
      stops: [
        {
          id: 'stop-1',
          label: 'After market',
          displayPage: 16,
          midPageNote: 'end of paragraph',
          hotspot: { pdfPage: null, pageSide: 'right', x: 1.2, y: -0.1 },
          questions: [
            {
              id: 'q1',
              kind: 'true_false',
              prompt: 'Tillie is happy?',
              choices: [],
              correctIndex: null,
              correctTrue: false,
              evidenceSnippet: null,
              evidenceHighlight: null,
            },
            {
              id: 'q2',
              kind: 'mcq',
              prompt: 'Where is school?',
              choices: ['Town', 'Farm'],
              correctIndex: 0,
              correctTrue: null,
              evidenceSnippet: null,
              evidenceHighlight: null,
            },
          ],
        },
      ],
    })
    expect(pack?.stops).toHaveLength(1)
    expect(pack?.stops[0]?.questions[0]?.kind).toBe('true_false')
    expect(pack?.stops[0]?.questions[1]?.kind).toBe('mcq')
    expect(pack?.stops[0]?.questions[1]?.choices).toEqual(['Town', 'Farm'])
    expect(pack?.stops[0]?.hotspot).toEqual({ pdfPage: null, pageSide: 'right', x: 1, y: 0 })
  })

  it('keeps pdfPage on new hotspots and matches spread by pdf page', () => {
    const pack = sanitizeReadingCheckPack({
      storyId: 's1',
      bookId: 'b1',
      unitId: 'u1',
      stops: [
        {
          id: 'stop-1',
          label: 'Beat',
          displayPage: 521,
          midPageNote: null,
          hotspot: { pdfPage: 42, pageSide: 'left', x: 0.94, y: 0.1 },
          questions: [
            {
              id: 'q1',
              kind: 'true_false',
              prompt: 'Q',
              choices: [],
              correctIndex: null,
              correctTrue: true,
              evidenceSnippet: null,
              evidenceHighlight: null,
            },
          ],
        },
      ],
    })
    expect(pack?.stops[0]?.hotspot).toEqual({
      pdfPage: 42,
      pageSide: 'left',
      x: 0.94,
      y: 0.1,
    })
  })

  it('lists live pins on the matching spread using stored hotspot coords', () => {
    const pack = sanitizeReadingCheckPack({
      storyId: 's1',
      bookId: 'b1',
      unitId: 'u1',
      stops: [
        {
          id: 'stop-1',
          label: 'Market',
          displayPage: 16,
          midPageNote: null,
          hotspot: { pdfPage: 20, pageSide: 'left', x: 0.72, y: 0.31 },
          questions: [
            {
              id: 'q1',
              kind: 'true_false',
              prompt: 'Q',
              choices: [],
              correctIndex: null,
              correctTrue: true,
              evidenceSnippet: null,
              evidenceHighlight: null,
            },
          ],
        },
      ],
    })
    const pins = listReadingCheckLivePinsOnSpread(pack?.stops ?? [], {
      leftPdfPage: 20,
      rightPdfPage: 21,
      leftDisplayPage: 16,
      rightDisplayPage: 17,
    })
    expect(pins).toHaveLength(1)
    expect(pins[0]?.pdfPage).toBe(20)
    expect(pins[0]?.x).toBe(0.72)
    expect(pins[0]?.y).toBe(0.31)
    expect(listReadingCheckLivePinsOnSpread(pack?.stops ?? [], {
      leftPdfPage: 22,
      rightPdfPage: 23,
      leftDisplayPage: 18,
      rightDisplayPage: 19,
    })).toEqual([])
  })

  it('puts Generate default pins on the printed page even when stored pdfPage is one off', () => {
    const pack = sanitizeReadingCheckPack({
      storyId: 's1',
      bookId: 'b1',
      unitId: 'u1',
      stops: [
        {
          id: 'stop-1',
          label: 'Gloria',
          displayPage: 434,
          midPageNote: null,
          hotspot: { pdfPage: 435, pageSide: 'left', x: 0.5, y: 0.9 },
          questions: [
            {
              id: 'q1',
              kind: 'true_false',
              prompt: 'Gloria takes pictures?',
              choices: [],
              correctIndex: null,
              correctTrue: true,
              evidenceSnippet: null,
              evidenceHighlight: null,
            },
          ],
        },
      ],
    })
    const pins = listReadingCheckLivePinsOnSpread(pack?.stops ?? [], {
      leftPdfPage: 436,
      rightPdfPage: 437,
      leftDisplayPage: 434,
      rightDisplayPage: 435,
    })
    expect(pins).toHaveLength(1)
    expect(pins[0]?.pdfPage).toBe(436)
    expect(pins[0]?.side).toBe('left')
    expect(listReadingCheckLivePinsOnSpread(pack?.stops ?? [], {
      leftPdfPage: 434,
      rightPdfPage: 435,
      leftDisplayPage: 432,
      rightDisplayPage: 433,
    })).toEqual([])
  })

  it('staggers stacked default pins on the same page', () => {
    const pack = sanitizeReadingCheckPack({
      storyId: 's1',
      bookId: 'b1',
      unitId: 'u1',
      stops: [
        {
          id: 'stop-1',
          label: 'A',
          displayPage: 436,
          midPageNote: null,
          hotspot: { pdfPage: 438, pageSide: 'left', x: 0.5, y: 0.9 },
          questions: [
            {
              id: 'q1',
              kind: 'true_false',
              prompt: 'One',
              choices: [],
              correctIndex: null,
              correctTrue: true,
              evidenceSnippet: null,
              evidenceHighlight: null,
            },
          ],
        },
        {
          id: 'stop-2',
          label: 'B',
          displayPage: 436,
          midPageNote: null,
          hotspot: { pdfPage: 438, pageSide: 'left', x: 0.5, y: 0.9 },
          questions: [
            {
              id: 'q2',
              kind: 'true_false',
              prompt: 'Two',
              choices: [],
              correctIndex: null,
              correctTrue: true,
              evidenceSnippet: null,
              evidenceHighlight: null,
            },
          ],
        },
      ],
    })
    const pins = listReadingCheckLivePinsOnSpread(pack?.stops ?? [], {
      leftPdfPage: 438,
      rightPdfPage: 439,
      leftDisplayPage: 436,
      rightDisplayPage: 437,
    })
    expect(pins).toHaveLength(2)
    expect(pins[0]?.y).not.toBe(pins[1]?.y)
  })

  it('keeps evidence highlight only when it appears in the snippet', () => {
    const kept = sanitizeReadingCheckPack({
      storyId: 's1',
      bookId: 'b1',
      unitId: 'u1',
      stops: [
        {
          id: 'stop-1',
          label: 'Beat',
          displayPage: null,
          midPageNote: null,
          hotspot: null,
          questions: [
            {
              id: 'q1',
              kind: 'true_false',
              prompt: 'Is Tillie brave?',
              choices: [],
              correctIndex: null,
              correctTrue: true,
              evidenceSnippet: 'Tillie took a deep breath and jumped.',
              evidenceHighlight: 'jumped',
            },
          ],
        },
      ],
    })
    expect(kept?.stops[0]?.questions[0]?.evidenceSnippet).toBe(
      'Tillie took a deep breath and jumped.',
    )
    expect(kept?.stops[0]?.questions[0]?.evidenceHighlight).toBe('jumped')

    const caseFold = sanitizeReadingCheckPack({
      storyId: 's1',
      bookId: 'b1',
      unitId: 'u1',
      stops: [
        {
          id: 'stop-1',
          label: 'Beat',
          displayPage: null,
          midPageNote: null,
          hotspot: null,
          questions: [
            {
              id: 'q1',
              kind: 'true_false',
              prompt: 'Q',
              choices: [],
              correctIndex: null,
              correctTrue: true,
              evidenceSnippet: 'She loved the Market Square.',
              evidenceHighlight: 'market square',
            },
          ],
        },
      ],
    })
    expect(caseFold?.stops[0]?.questions[0]?.evidenceHighlight).toBe('Market Square')

    const dropped = sanitizeReadingCheckPack({
      storyId: 's1',
      bookId: 'b1',
      unitId: 'u1',
      stops: [
        {
          id: 'stop-1',
          label: 'Beat',
          displayPage: null,
          midPageNote: null,
          hotspot: null,
          questions: [
            {
              id: 'q1',
              kind: 'true_false',
              prompt: 'Q',
              choices: [],
              correctIndex: null,
              correctTrue: true,
              evidenceSnippet: 'Tillie walked home.',
              evidenceHighlight: 'not in the text',
            },
          ],
        },
      ],
    })
    expect(dropped?.stops[0]?.questions[0]?.evidenceSnippet).toBe('Tillie walked home.')
    expect(dropped?.stops[0]?.questions[0]?.evidenceHighlight).toBeNull()
  })

  it('defaults new MCQ questions to four choice slots', () => {
    const stop = createEmptyReadingCheckStop(14, 'mcq')
    expect(stop.questions[0]?.kind).toBe('mcq')
    expect(stop.questions[0]?.choices).toHaveLength(4)
  })

  it('only approved packs with usable stops are live-eligible', () => {
    const empty = createEmptyReadingCheckPack({ storyId: 's', bookId: 'b', unitId: 'u' })
    expect(getLiveEligibleReadingCheckPack(empty)).toBeNull()
    expect(readingCheckPackCanApprove(empty)).toBe(false)

    const withStop: typeof empty = {
      ...empty,
      stops: [
        {
          ...createEmptyReadingCheckStop(14),
          label: 'Check 1',
          questions: [
            {
              id: 'q1',
              kind: 'true_false',
              prompt: 'Did they go to school?',
              choices: [],
              correctIndex: null,
              correctTrue: true,
              evidenceSnippet: null,
              evidenceHighlight: null,
            },
          ],
        },
      ],
    }
    expect(readingCheckPackCanApprove(withStop)).toBe(true)
    expect(getLiveEligibleReadingCheckPack(withStop)).toBeNull()

    const approved = approveReadingCheckPack(withStop)
    expect(approved?.status).toBe('approved')
    expect(getLiveEligibleReadingCheckPack(approved)).not.toBeNull()

    const draftAgain = demoteReadingCheckPackToDraft(approved!)
    expect(draftAgain.status).toBe('draft')
    expect(getLiveEligibleReadingCheckPack(draftAgain)).toBeNull()
  })
})

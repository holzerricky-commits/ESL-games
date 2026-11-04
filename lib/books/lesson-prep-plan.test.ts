import { describe, expect, it } from 'vitest'
import type { ReadingCheckPack } from '@/lib/books/reading-check-pack'
import type { ReadingStoryPdfRange } from '@/lib/books/reading-story-map'
import type { ReadingStoryTextRecord } from '@/lib/books/reading-story-text'
import {
  decideLessonPrepChecks,
  planLessonPrepPart,
  storyTextIsComplete,
} from '@/lib/books/lesson-prep-plan'

function range(overrides: Partial<ReadingStoryPdfRange> = {}): ReadingStoryPdfRange {
  return {
    startPdfPage: 10,
    endPdfPage: 11,
    startDisplayPage: 10,
    endDisplayPage: 11,
    source: 'outline',
    rangeConfirmed: false,
    ...overrides,
  }
}

function text(body: string): ReadingStoryTextRecord {
  return {
    storyId: 's',
    bookId: 'b',
    unitId: 'u',
    text: body,
    source: 'gemini',
    startPdfPage: 10,
    endPdfPage: 11,
    startDisplayPage: 10,
    endDisplayPage: 11,
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

const page10 = '<<<page display="10" pdf="10">>>\nOnce upon a time.'
const page11 = '<<<page display="11" pdf="11">>>\nThe end.'

function pack(overrides: Partial<ReadingCheckPack> = {}): ReadingCheckPack {
  return {
    storyId: 's',
    bookId: 'b',
    unitId: 'u',
    status: 'draft',
    stops: [],
    updatedAt: '2026-01-01T00:00:00.000Z',
    approvedAt: null,
    ...overrides,
  }
}

describe('planLessonPrepPart', () => {
  it('skips everything else when the part has no pages', () => {
    expect(planLessonPrepPart({ range: range({ source: 'none' }), text: null })).toEqual({
      pages: 'missing',
      text: null,
    })
  })

  it('confirms an outline range and runs a full scan when there is no text', () => {
    expect(planLessonPrepPart({ range: range(), text: null })).toEqual({ pages: 'confirm', text: 'full' })
  })

  it('continues a partial scan', () => {
    const plan = planLessonPrepPart({ range: range({ rangeConfirmed: true }), text: text(page10) })
    expect(plan).toEqual({ pages: 'skip', text: 'continue' })
  })

  it('skips text that covers every page', () => {
    const plan = planLessonPrepPart({
      range: range({ rangeConfirmed: true }),
      text: text(`${page10}\n${page11}`),
    })
    expect(plan).toEqual({ pages: 'skip', text: 'skip' })
  })
})

describe('storyTextIsComplete', () => {
  it('treats pasted text without page markers as complete', () => {
    expect(storyTextIsComplete(text('Pasted story text.'))).toBe(true)
  })

  it('is false for empty text', () => {
    expect(storyTextIsComplete(text('   '))).toBe(false)
    expect(storyTextIsComplete(null)).toBe(false)
  })
})

describe('decideLessonPrepChecks', () => {
  const usableStop = {
    id: 'stop-1',
    title: 'Stop 1',
    questions: [{ id: 'q1', prompt: 'Who is the main character?' }],
  } as unknown as ReadingCheckPack['stops'][number]

  it('never touches an approved pack', () => {
    expect(decideLessonPrepChecks({ pack: pack({ status: 'approved' }), textComplete: true })).toBe(
      'skip-approved',
    )
  })

  it('leaves a draft with questions alone', () => {
    expect(decideLessonPrepChecks({ pack: pack({ stops: [usableStop] }), textComplete: true })).toBe(
      'skip-draft',
    )
  })

  it('is blocked without complete text', () => {
    expect(decideLessonPrepChecks({ pack: null, textComplete: false })).toBe('blocked')
  })

  it('generates when there is no usable pack and the text is complete', () => {
    expect(decideLessonPrepChecks({ pack: null, textComplete: true })).toBe('generate')
    expect(decideLessonPrepChecks({ pack: pack(), textComplete: true })).toBe('generate')
  })
})

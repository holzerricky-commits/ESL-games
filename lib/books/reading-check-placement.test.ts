import { describe, expect, it } from 'vitest'
import {
  applyStoryEvidencePagesToStops,
  createDefaultReadingCheckHotspot,
  ensureReadingCheckStopPlacement,
  isDefaultReadingCheckHotspotCoords,
} from '@/lib/books/reading-check-placement'
import { createEmptyReadingCheckStop } from '@/lib/books/reading-check-pack'
import {
  buildPlaceholderChunkForPdfPages,
  coveredPdfPagesFromStoryText,
  formatReadingStoryPageMarker,
  isIllustrationOnlySectionText,
  parseReadingStoryPageSections,
  READING_STORY_ILLUSTRATION_ONLY_PLACEHOLDER,
  remainingScanPdfPages,
  resolvePageFromStoryEvidence,
  storyTextScanCanContinue,
  tagScannedChunkText,
} from '@/lib/books/reading-story-page-markers'

describe('reading-story-page-markers', () => {
  it('tags legacy --- Page N --- headers with display+pdf markers', () => {
    const tagged = tagScannedChunkText('--- Page 42 ---\nHello world\n\n--- Page 43 ---\nMore', {
      chunkStartPdfPage: 42,
      chunkEndPdfPage: 43,
      range: { startPdfPage: 40, startDisplayPage: 520, endDisplayPage: 530 },
    })
    expect(tagged).toContain(formatReadingStoryPageMarker({ displayPage: 522, pdfPage: 42 }))
    expect(tagged).toContain(formatReadingStoryPageMarker({ displayPage: 523, pdfPage: 43 }))
    expect(tagged).toContain('Hello world')
  })

  it('resolves evidence to a unique tagged page', () => {
    const story = [
      formatReadingStoryPageMarker({ displayPage: 10, pdfPage: 12 }),
      'Tillie walked to the market.',
      formatReadingStoryPageMarker({ displayPage: 11, pdfPage: 13 }),
      'Then she saw the fox near the dam.',
    ].join('\n')
    const hit = resolvePageFromStoryEvidence(story, 'she saw the fox near the dam')
    expect(hit).toEqual({ displayPage: 11, pdfPage: 13 })
    expect(parseReadingStoryPageSections(story)).toHaveLength(2)
  })

  it('collects covered pdf pages from markers and --- Pages A–B ---', () => {
    const story = [
      formatReadingStoryPageMarker({ displayPage: 100, pdfPage: 10 }),
      '--- Pages 10–11 ---',
      'Lights like stars.',
      '--- Page 12 ---',
      'More rain.',
    ].join('\n')
    const covered = coveredPdfPagesFromStoryText(story)
    expect([...covered].sort((a, b) => a - b)).toEqual([10, 11, 12])
    expect(remainingScanPdfPages([10, 11, 12, 13, 14], covered)).toEqual([13, 14])
  })

  it('storyTextScanCanContinue is false for paste-only or complete coverage', () => {
    expect(
      storyTextScanCanContinue({
        text: 'Just pasted prose with no page tags.',
        startPdfPage: 1,
        endPdfPage: 5,
      }),
    ).toBe(false)

    const partial = [
      formatReadingStoryPageMarker({ displayPage: 1, pdfPage: 1 }),
      'Start of story.',
    ].join('\n')
    expect(
      storyTextScanCanContinue({ text: partial, startPdfPage: 1, endPdfPage: 4 }),
    ).toBe(true)

    const full = [
      formatReadingStoryPageMarker({ displayPage: 1, pdfPage: 1 }),
      'A',
      formatReadingStoryPageMarker({ displayPage: 2, pdfPage: 2 }),
      'B',
    ].join('\n')
    expect(storyTextScanCanContinue({ text: full, startPdfPage: 1, endPdfPage: 2 })).toBe(false)
  })

  it('builds illustration-only placeholder markers for each pdf page', () => {
    const chunk = buildPlaceholderChunkForPdfPages(42, 43, {
      startPdfPage: 40,
      startDisplayPage: 520,
      endDisplayPage: 530,
    })
    expect(chunk).toContain(formatReadingStoryPageMarker({ displayPage: 522, pdfPage: 42 }))
    expect(chunk).toContain(formatReadingStoryPageMarker({ displayPage: 523, pdfPage: 43 }))
    expect(chunk).toContain(READING_STORY_ILLUSTRATION_ONLY_PLACEHOLDER)
    const sections = parseReadingStoryPageSections(chunk)
    expect(sections).toHaveLength(2)
    expect(sections.every((s) => isIllustrationOnlySectionText(s.text))).toBe(true)
    const covered = coveredPdfPagesFromStoryText(chunk)
    expect([...covered].sort((a, b) => a - b)).toEqual([42, 43])
  })

  it('detects illustration-only section text', () => {
    expect(isIllustrationOnlySectionText(READING_STORY_ILLUSTRATION_ONLY_PLACEHOLDER)).toBe(true)
    expect(isIllustrationOnlySectionText('')).toBe(true)
    expect(isIllustrationOnlySectionText('Tillie walked home.')).toBe(false)
  })
})

describe('reading-check-placement', () => {
  it('creates bottom-center default hotspot', () => {
    const spot = createDefaultReadingCheckHotspot({ displayPage: 16, pdfPage: 20 })
    expect(isDefaultReadingCheckHotspotCoords(spot)).toBe(true)
    expect(spot.y).toBe(0.9)
    expect(spot.x).toBe(0.5)
    expect(spot.pdfPage).toBe(20)
    expect(spot.pageSide).toBe('left')
  })

  it('ensures missing hotspot when display page is set', () => {
    const stop = createEmptyReadingCheckStop(21)
    expect(stop.hotspot).toBeNull()
    const next = ensureReadingCheckStopPlacement(stop, { resetHotspot: true })
    expect(next.hotspot).not.toBeNull()
    expect(isDefaultReadingCheckHotspotCoords(next.hotspot)).toBe(true)
  })

  it('fills page from evidence when AI page is missing', () => {
    const story = [
      formatReadingStoryPageMarker({ displayPage: 5, pdfPage: 8 }),
      'The river ran past the school.',
    ].join('\n')
    const stop = createEmptyReadingCheckStop(null)
    stop.label = 'River'
    stop.questions[0]!.prompt = 'Where did the river run?'
    stop.questions[0]!.evidenceSnippet = 'The river ran past the school.'
    const [placed] = applyStoryEvidencePagesToStops([stop], story, {
      startDisplayPage: 1,
      endDisplayPage: 20,
    })
    expect(placed?.displayPage).toBe(5)
    expect(placed?.hotspot?.pdfPage).toBe(8)
    expect(isDefaultReadingCheckHotspotCoords(placed?.hotspot)).toBe(true)
  })

  it('moves pin to evidence page when AI placed one page early inside the story', () => {
    const story = [
      formatReadingStoryPageMarker({ displayPage: 14, pdfPage: 20 }),
      'Young Thomas liked to ask questions.',
      formatReadingStoryPageMarker({ displayPage: 15, pdfPage: 21 }),
      'Edison invented the light bulb after many tries.',
    ].join('\n')
    const stop = createEmptyReadingCheckStop(14)
    stop.label = 'Light bulb'
    stop.questions[0]!.prompt = 'What did Edison invent?'
    stop.questions[0]!.evidenceSnippet = 'Edison invented the light bulb after many tries.'
    const [placed] = applyStoryEvidencePagesToStops([stop], story, {
      startDisplayPage: 12,
      endDisplayPage: 20,
    })
    expect(placed?.displayPage).toBe(15)
    expect(placed?.hotspot?.pdfPage).toBe(21)
  })

  it('keeps AI page when evidence cannot be matched uniquely', () => {
    const story = [
      formatReadingStoryPageMarker({ displayPage: 10, pdfPage: 10 }),
      'She smiled.',
      formatReadingStoryPageMarker({ displayPage: 11, pdfPage: 11 }),
      'She smiled again.',
    ].join('\n')
    const stop = createEmptyReadingCheckStop(10)
    stop.questions[0]!.prompt = 'Did she smile?'
    stop.questions[0]!.evidenceSnippet = 'She smiled.'
    const [placed] = applyStoryEvidencePagesToStops([stop], story, {
      startDisplayPage: 10,
      endDisplayPage: 12,
    })
    // Snippet appears on both pages → no unique hit → keep AI page
    expect(placed?.displayPage).toBe(10)
  })
})

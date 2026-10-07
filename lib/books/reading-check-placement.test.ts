import { describe, expect, it } from 'vitest'
import {
  applyStoryEvidencePagesToStops,
  createDefaultReadingCheckHotspot,
  ensureReadingCheckStopPlacement,
  isDefaultReadingCheckHotspotCoords,
} from '@/lib/books/reading-check-placement'
import { createEmptyReadingCheckStop } from '@/lib/books/reading-check-pack'
import type { BookRecord } from '@/lib/books/types'
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

  it('converts --- Pages A–B --- even when a later illustration <<<page>>> already exists', () => {
    const tagged = tagScannedChunkText(
      [
        '--- Pages 42–43 ---',
        'Hello from the story.',
        formatReadingStoryPageMarker({ displayPage: 523, pdfPage: 43 }),
        READING_STORY_ILLUSTRATION_ONLY_PLACEHOLDER,
      ].join('\n'),
      {
        chunkStartPdfPage: 42,
        chunkEndPdfPage: 43,
        range: { startPdfPage: 40, startDisplayPage: 520, endDisplayPage: 530 },
      },
    )
    const page42 = formatReadingStoryPageMarker({ displayPage: 522, pdfPage: 42 })
    const page43 = formatReadingStoryPageMarker({ displayPage: 523, pdfPage: 43 })
    expect(tagged).toContain(page42)
    expect(tagged).toContain(page43)
    expect(tagged.indexOf(page42)).toBeLessThan(tagged.indexOf('Hello from the story.'))
    const sections = parseReadingStoryPageSections(tagged)
    expect(sections.find((s) => s.pdfPage === 42)?.text).toContain('Hello from the story.')
    expect(sections.find((s) => s.pdfPage === 43)?.text).toContain(
      READING_STORY_ILLUSTRATION_ONLY_PLACEHOLDER,
    )
  })

  it('does not glue Jump!-style energy prose onto the previous illustration page', () => {
    const story = [
      formatReadingStoryPageMarker({ displayPage: 367, pdfPage: 375 }),
      READING_STORY_ILLUSTRATION_ONLY_PLACEHOLDER,
      '--- Pages 376–377 ---',
      "His name is Michael, and from the time he was a little boy, he always seemed to be in and out of mischief. But Michael? He just had a different kind of energy, and curiosity, too.",
      formatReadingStoryPageMarker({ displayPage: 369, pdfPage: 377 }),
      READING_STORY_ILLUSTRATION_ONLY_PLACEHOLDER,
    ].join('\n')

    const sections = parseReadingStoryPageSections(story)
    const energy = sections.find((s) => s.text.includes('different kind of energy'))
    expect(energy).toMatchObject({ displayPage: 368, pdfPage: 376 })
    expect(resolvePageFromStoryEvidence(story, 'He just had a different kind of energy')).toEqual({
      displayPage: 368,
      pdfPage: 376,
    })
  })

  it('resolves Jump! on-disk story text without rewriting the saved file', async () => {
    const { readFile } = await import('node:fs/promises')
    const { join } = await import('node:path')
    const raw = await readFile(
      join(
        process.cwd(),
        'data/reading-stories/text/journeys-g3-book-1_unit-3-3e7eaa87_lesson-2d6f0fe0_part-ab394f3e.json',
      ),
      'utf8',
    )
    const record = JSON.parse(raw) as { text: string }
    expect(record.text).toContain('--- Pages 376–377 ---')
    expect(resolvePageFromStoryEvidence(record.text, 'He just had a different kind of energy')).toEqual({
      displayPage: 368,
      pdfPage: 376,
    })
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

  it('moves Jump! energy pin off the previous illustration onto the evidence page', () => {
    const story = [
      formatReadingStoryPageMarker({ displayPage: 367, pdfPage: 375 }),
      READING_STORY_ILLUSTRATION_ONLY_PLACEHOLDER,
      '--- Pages 376–377 ---',
      "His name is Michael, and from the time he was a little boy, he always seemed to be in and out of mischief. But Michael? He just had a different kind of energy, and curiosity, too.",
      formatReadingStoryPageMarker({ displayPage: 369, pdfPage: 377 }),
      READING_STORY_ILLUSTRATION_ONLY_PLACEHOLDER,
    ].join('\n')
    const stop = createEmptyReadingCheckStop(367)
    stop.label = "Michael's energy"
    stop.questions[0]!.prompt = 'What kind of energy did Michael have?'
    stop.questions[0]!.evidenceSnippet =
      "But Michael? He just had a different kind of energy, and curiosity, too."
    stop.questions[0]!.evidenceHighlight = 'He just had a different kind of energy'
    const [placed] = applyStoryEvidencePagesToStops([stop], story, {
      startDisplayPage: 366,
      endDisplayPage: 384,
    })
    expect(placed?.displayPage).toBe(368)
    expect(placed?.hotspot?.pdfPage).toBe(376)
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

  it('matches evidence across line breaks in scanned story text', () => {
    const story = [
      formatReadingStoryPageMarker({ displayPage: 434, pdfPage: 436 }),
      'Gloria is an experienced\nphotographer, so she\ndecides to photograph\nwhat the team\ndiscovers underwater.',
    ].join('\n')
    const hit = resolvePageFromStoryEvidence(
      story,
      'Gloria is an experienced photographer, so she decides to photograph what the team discovers underwater.',
    )
    expect(hit).toEqual({ displayPage: 434, pdfPage: 436 })
  })

  it('maps Generate pins through the same page alignment the reader uses', () => {
    const unit: BookRecord['units'][number] = {
      id: 'unit-2',
      title: 'How on Earth?',
      filePath: 'book-library/wonders-g2-workshop/wonders-g2-workshop.pdf',
    }
    const book: BookRecord = {
      id: 'readingwriting-workshop-g2',
      title: 'Workshop',
      pageAlignmentByFile: {
        [unit.filePath]: {
          notCountedPdfPages: [],
          hiddenPdfPages: [1, 4, 5],
        },
      },
      units: [unit],
    }
    const stop = createEmptyReadingCheckStop(434)
    const placed = ensureReadingCheckStopPlacement(stop, {
      book,
      unit,
      totalPdfPages: 500,
      resetHotspot: true,
    })
    expect(placed.hotspot?.pdfPage).toBe(436)
  })
})

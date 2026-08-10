import { describe, expect, it } from 'vitest'
import {
  buildTaggedStopCheckExample,
  filterNewStopChecks,
  formatStopChecksForPrompt,
  harvestLooseStopAndCheck,
  parseReadingStoryStopChecks,
  stopChecksToReadingCheckStops,
} from '@/lib/books/reading-story-stop-checks'
import { createEmptyReadingCheckStop } from '@/lib/books/reading-check-pack'
import { formatReadingStoryPageMarker } from '@/lib/books/reading-story-page-markers'

describe('parseReadingStoryStopChecks', () => {
  it('parses tagged stop_check blocks', () => {
    const items = parseReadingStoryStopChecks(buildTaggedStopCheckExample())
    expect(items).toHaveLength(1)
    expect(items[0]?.displayPage).toBe(22)
    expect(items[0]?.pdfPage).toBe(24)
    expect(items[0]?.prompt).toContain('worried')
    expect(items[0]?.answerHint).toContain('Mr. Keene')
  })

  it('harvests loose Stop and Check headings', () => {
    const story = [
      formatReadingStoryPageMarker({ displayPage: 18, pdfPage: 20 }),
      'Tillie went to school.',
      '',
      'Stop and Check',
      'What did Tillie learn at school?',
      '',
      'More story text here.',
    ].join('\n')
    const items = harvestLooseStopAndCheck(story)
    expect(items.length).toBeGreaterThanOrEqual(1)
    expect(items[0]?.displayPage).toBe(18)
    expect(items[0]?.prompt.toLowerCase()).toContain('tillie')
  })

  it('converts harvest to draft stops and filters already imported', () => {
    const items = parseReadingStoryStopChecks(buildTaggedStopCheckExample())
    const stops = stopChecksToReadingCheckStops(items)
    expect(stops).toHaveLength(1)
    expect(stops[0]?.questions[0]?.prompt).toContain('worried')
    expect(formatStopChecksForPrompt(items)).toContain('Publisher Stop and Check')

    const existing = createEmptyReadingCheckStop(22)
    existing.questions[0]!.prompt = items[0]!.prompt
    expect(filterNewStopChecks(items, [existing])).toHaveLength(0)
  })
})

import { describe, expect, it } from 'vitest'
import {
  assembleTodaysClassPartBriefing,
  excerptStoryText,
  mergeBriefingWords,
  todaysClassBriefingKind,
  todaysClassWorkshopHref,
  toggleTrimmedItem,
} from '@/lib/students/todays-class-briefing'

describe('todays-class-briefing', () => {
  it('maps outline tags to briefing kinds', () => {
    expect(todaysClassBriefingKind('vocabulary_in_context')).toBe('vocabulary')
    expect(todaysClassBriefingKind('main_story')).toBe('story')
    expect(todaysClassBriefingKind('grammar')).toBe('grammar')
    expect(todaysClassBriefingKind('writing_narrate')).toBe('writing')
    expect(todaysClassBriefingKind('comprehension')).toBe('other')
    expect(todaysClassBriefingKind(null)).toBe('other')
  })

  it('excerpts long story text on a sentence or space', () => {
    const long = `${'The river ran. '.repeat(80)}The end.`
    const excerpt = excerptStoryText(long, 80)
    expect(excerpt.endsWith('…')).toBe(true)
    expect(excerpt.length).toBeLessThan(long.length)
    expect(excerptStoryText('  Hello river.  ')).toBe('Hello river.')
  })

  it('merges words without duplicates', () => {
    expect(
      mergeBriefingWords(
        [{ word: 'soar', definition: 'fly high' }],
        [{ word: 'Soar', definition: 'ignored' }],
        ['ambition', 'soar'],
      ),
    ).toEqual([
      { word: 'soar', definition: 'fly high' },
      { word: 'ambition', definition: '' },
    ])
  })

  it('toggles starred words and skipped parts', () => {
    expect(toggleTrimmedItem(['river'], 'River')).toEqual([])
    expect(toggleTrimmedItem(['river'], 'valley')).toEqual(['river', 'valley'])
    expect(toggleTrimmedItem(['a', 'b'], '  ')).toEqual(['a', 'b'])
  })

  it('jumps story parts to Stories and others to the part in Books', () => {
    expect(
      todaysClassWorkshopHref({
        bookId: 'b1',
        unitId: 'u1',
        lessonId: 'l1',
        partId: 'p1',
        storyId: 's1',
        kind: 'story',
      }),
    ).toContain('tab=stories')
    expect(
      todaysClassWorkshopHref({
        bookId: 'b1',
        unitId: 'u1',
        lessonId: 'l1',
        partId: 'p1',
        kind: 'vocabulary',
      }),
    ).toContain('part=p1')
  })

  it('assembles saved fuel and stays empty when nothing is saved', () => {
    const empty = assembleTodaysClassPartBriefing({
      tag: 'grammar',
      bookId: 'b1',
      unitId: 'u1',
    })
    expect(empty.empty).toBe(true)
    expect(empty.emptyLabel).toMatch(/grammar/i)

    const filled = assembleTodaysClassPartBriefing({
      tag: 'vocabulary_in_context',
      bookId: 'b1',
      unitId: 'u1',
      partWords: [{ word: 'athlete', definition: 'a sports person' }],
      frameSkill: 'Cause and Effect',
    })
    expect(filled.empty).toBe(false)
    expect(filled.words[0]?.word).toBe('athlete')
    expect(filled.lines).toEqual([])
  })
})

import { afterEach, describe, expect, it } from 'vitest'
import {
  appendReadingCheckLiveMark,
  clearReadingCheckLiveMarksForTests,
  formatReadingCheckWrapLine,
  latestReadingCheckLiveMarkForStop,
  listReadingCheckLiveMarks,
  summarizeReadingCheckLiveMarksForClass,
} from '@/lib/books/reading-check-live-marks'
import {
  createEmptyReadingCheckPack,
  createEmptyReadingCheckQuestion,
  createEmptyReadingCheckStop,
} from '@/lib/books/reading-check-pack'

function packWithStops(storyId: string, stopCount: number) {
  const pack = createEmptyReadingCheckPack({ storyId, bookId: 'b1', unitId: 'u1' })
  pack.stops = Array.from({ length: stopCount }, (_, i) => {
    const stop = createEmptyReadingCheckStop(i + 1)
    stop.id = `stop-${i + 1}`
    stop.questions = [createEmptyReadingCheckQuestion('true_false')]
    stop.questions[0]!.prompt = `Q${i + 1}?`
    return stop
  })
  return pack
}

describe('reading-check-live-marks', () => {
  afterEach(() => {
    clearReadingCheckLiveMarksForTests()
  })

  it('appends and finds latest mark for a stop', () => {
    appendReadingCheckLiveMark({
      storyId: 'story-a',
      stopId: 'stop-1',
      result: 'incorrect',
      studentId: 'stu',
      selectedAnswer: 'A. The market',
      correctAnswer: 'B. The farm',
    })
    appendReadingCheckLiveMark({
      storyId: 'story-a',
      stopId: 'stop-1',
      result: 'correct',
      studentId: 'stu',
    })
    expect(listReadingCheckLiveMarks()).toHaveLength(2)
    expect(latestReadingCheckLiveMarkForStop('story-a', 'stop-1')?.result).toBe('correct')
    expect(latestReadingCheckLiveMarkForStop('story-a', 'stop-1')?.correctAnswer).toBeNull()
    expect(latestReadingCheckLiveMarkForStop('story-a', 'missing')).toBeNull()
  })

  it('stores classSessionId on marks', () => {
    const row = appendReadingCheckLiveMark({
      storyId: 'story-a',
      stopId: 'stop-1',
      result: 'correct',
      studentId: 'stu',
      classSessionId: 'class-1',
    })
    expect(row.classSessionId).toBe('class-1')
    expect(listReadingCheckLiveMarks()[0]?.classSessionId).toBe('class-1')
  })

  it('summarizes one class with latest-per-stop and pack total', () => {
    appendReadingCheckLiveMark({
      storyId: 'story-a',
      stopId: 'stop-1',
      result: 'incorrect',
      studentId: 'stu',
      classSessionId: 'class-1',
    })
    appendReadingCheckLiveMark({
      storyId: 'story-a',
      stopId: 'stop-1',
      result: 'correct',
      studentId: 'stu',
      classSessionId: 'class-1',
    })
    appendReadingCheckLiveMark({
      storyId: 'story-a',
      stopId: 'stop-2',
      result: 'skip',
      studentId: 'stu',
      classSessionId: 'class-1',
    })
    appendReadingCheckLiveMark({
      storyId: 'story-a',
      stopId: 'stop-3',
      result: 'incorrect',
      studentId: 'stu',
      classSessionId: 'class-1',
    })
    // Other class — ignored
    appendReadingCheckLiveMark({
      storyId: 'story-a',
      stopId: 'stop-9',
      result: 'correct',
      studentId: 'stu',
      classSessionId: 'class-2',
    })

    const summary = summarizeReadingCheckLiveMarksForClass({
      classSessionId: 'class-1',
      studentId: 'stu',
      packsByStoryId: { 'story-a': packWithStops('story-a', 20) },
    })
    expect(summary).toEqual({
      attempted: 3,
      correct: 1,
      incorrect: 1,
      skip: 1,
      storyIds: ['story-a'],
      totalInPack: 20,
    })
    expect(formatReadingCheckWrapLine(summary)).toBe('Checks: 3/20 · 1 right · 1 miss · 1 skip')
  })

  it('omits pack total when multiple stories were marked', () => {
    appendReadingCheckLiveMark({
      storyId: 'story-a',
      stopId: 'stop-1',
      result: 'correct',
      studentId: 'stu',
      classSessionId: 'class-1',
    })
    appendReadingCheckLiveMark({
      storyId: 'story-b',
      stopId: 'stop-1',
      result: 'incorrect',
      studentId: 'stu',
      classSessionId: 'class-1',
    })
    const summary = summarizeReadingCheckLiveMarksForClass({
      classSessionId: 'class-1',
      studentId: 'stu',
      packsByStoryId: {
        'story-a': packWithStops('story-a', 10),
        'story-b': packWithStops('story-b', 10),
      },
    })
    expect(summary.attempted).toBe(2)
    expect(summary.correct).toBe(1)
    expect(summary.incorrect).toBe(1)
    expect(summary.totalInPack).toBeNull()
    expect(formatReadingCheckWrapLine(summary)).toBe('Checks: 2 checks · 1 right · 1 miss')
  })

  it('returns empty summary and no wrap line when nothing attempted', () => {
    const summary = summarizeReadingCheckLiveMarksForClass({
      classSessionId: 'class-1',
      studentId: 'stu',
    })
    expect(summary.attempted).toBe(0)
    expect(formatReadingCheckWrapLine(summary)).toBeUndefined()
  })
})

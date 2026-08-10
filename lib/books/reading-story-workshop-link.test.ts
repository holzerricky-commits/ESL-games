import { describe, expect, it } from 'vitest'
import {
  sanitizeReadingStoryWorkshopLink,
  workshopLinkKey,
} from '@/lib/books/reading-story-workshop-link'
import {
  findPeerWorkshopBooks,
  isLiteratureReadingBook,
  listWorkshopLessonsForPicker,
} from '@/lib/books/reading-story-workshop-peers'
import type { BookRecord, BookUnitRecord } from '@/lib/books/types'

function book(partial: Partial<BookRecord> & Pick<BookRecord, 'id' | 'title'>): BookRecord {
  return {
    filePath: `${partial.id}.pdf`,
    units: [],
    ...partial,
  } as BookRecord
}

describe('sanitizeReadingStoryWorkshopLink', () => {
  it('requires story and workshop ids', () => {
    expect(sanitizeReadingStoryWorkshopLink({ storyId: 's1' })).toBeNull()
    expect(
      sanitizeReadingStoryWorkshopLink({
        storyId: 's1',
        workshopBookId: 'ws',
        workshopUnitId: 'u1',
        workshopLessonId: 'l1',
      }),
    ).toMatchObject({
      storyId: 's1',
      workshopBookId: 'ws',
      workshopUnitId: 'u1',
      workshopLessonId: 'l1',
    })
  })

  it('trims and builds a stable workshop key', () => {
    const link = sanitizeReadingStoryWorkshopLink({
      storyId: '  lit::u::story  ',
      workshopBookId: ' ws-book ',
      workshopUnitId: ' u2 ',
      workshopLessonId: ' week-3 ',
      workshopLessonTitle: '  Cause and Effect  ',
      updatedAt: '2026-08-05T12:00:00.000Z',
    })
    expect(link).not.toBeNull()
    expect(link!.storyId).toBe('lit::u::story')
    expect(link!.workshopLessonTitle).toBe('Cause and Effect')
    expect(workshopLinkKey(link!)).toBe('ws-book::u2::week-3')
  })
})

describe('findPeerWorkshopBooks / isLiteratureReadingBook', () => {
  const lit = book({
    id: 'wonders-g3-literature',
    title: 'Wonders Grade 3 Literature Anthology',
    series: 'Wonders',
    grade: '3',
  })
  const workshop = book({
    id: 'wonders-g3-workshop',
    title: 'Wonders Grade 3 Reading/Writing Workshop',
    series: 'Wonders',
    grade: '3',
  })
  const otherGrade = book({
    id: 'wonders-g4-workshop',
    title: 'Wonders Grade 4 Reading/Writing Workshop',
    series: 'Wonders',
    grade: '4',
  })
  const journeys = book({
    id: 'journeys-g3',
    title: 'Journeys Grade 3 Student Book',
    series: 'Journeys',
    grade: '3',
  })

  it('detects Literature role from title', () => {
    expect(isLiteratureReadingBook(lit)).toBe(true)
    expect(isLiteratureReadingBook(workshop)).toBe(false)
  })

  it('finds same series/grade Workshop peers only', () => {
    const peers = findPeerWorkshopBooks([lit, workshop, otherGrade, journeys], lit)
    expect(peers.map((b) => b.id)).toEqual(['wonders-g3-workshop'])
  })
})

describe('listWorkshopLessonsForPicker', () => {
  it('maps unit lessons for the picker', () => {
    const unit: BookUnitRecord = {
      id: 'u1',
      title: 'Unit 1',
      filePath: 'u1.pdf',
      lessons: [
        { id: 'l1', title: 'Week 1' },
        { id: 'l2', title: 'Week 2' },
      ],
    }
    expect(listWorkshopLessonsForPicker(unit)).toEqual([
      { id: 'l1', title: 'Week 1' },
      { id: 'l2', title: 'Week 2' },
    ])
  })
})

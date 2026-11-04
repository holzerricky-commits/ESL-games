import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { lessonRefsForTeachingWeek, lessonWeekNumber } from '@/lib/books/lesson-peer'
import type { BookLessonRecord, BookLibraryPayload, BookRecord, BookUnitRecord } from '@/lib/books/types'

function lesson(id: string, title: string): BookLessonRecord {
  return { id, title }
}

function unit(id: string, title: string, lessons: BookLessonRecord[] = []): BookUnitRecord {
  return { id, title, filePath: `${id}.pdf`, lessons }
}

function book(partial: Partial<BookRecord> & Pick<BookRecord, 'id' | 'title'>): BookRecord {
  return { units: [], ...partial }
}

describe('lessonWeekNumber', () => {
  it('reads Lesson and Week numbers and ignores handbook titles', () => {
    expect(lessonWeekNumber('Lesson 1: • Friends Help Friends')).toBe(1)
    expect(lessonWeekNumber('Week 12: TIME FOR KIDS')).toBe(12)
    expect(lessonWeekNumber('Grammar Handbook')).toBeNull()
    expect(lessonWeekNumber('Lesson')).toBeNull()
  })
})

describe('lessonRefsForTeachingWeek', () => {
  const workshop = book({
    id: 'workshop',
    title: 'Wonders Grade 2 — Workshop',
    series: 'Wonders',
    grade: 'G2',
    role: 'Workshop',
    units: [
      unit('ws-other', 'Animals and Nature', [lesson('ws-other-1', 'Lesson 1: Animals')]),
      unit('ws-friends', 'Friends and Family', [
        lesson('ws-1', 'Lesson 1: • Friends Help Friends'),
        lesson('ws-2', 'Lesson 2: • Families Around the World'),
        lesson('ws-handbook', 'Grammar Handbook'),
      ]),
    ],
  })
  const literature = book({
    id: 'literature',
    title: 'Wonders Grade 2 — Literature',
    series: 'Wonders',
    grade: 'G2',
    role: 'Literature',
    units: [
      unit('lit-friends', 'Friends and Family', [
        lesson('lit-1', 'Week 1: FRIENDS HELP FRIENDS'),
        lesson('lit-2', 'Week 2: FAMILIES AROUND THE WORLD'),
      ]),
      unit('lit-other', 'Animals and Nature', [lesson('lit-other-1', 'Week 1: ANIMALS AND NATURE')]),
    ],
  })
  const otherGrade = book({
    id: 'workshop-g3',
    title: 'Wonders Grade 3 — Workshop',
    series: 'Wonders',
    grade: 'G3',
    role: 'Workshop',
    units: [unit('g3', 'Friends and Family', [lesson('g3-1', 'Lesson 1: Friends')])],
  })
  const journeys = book({
    id: 'journeys',
    title: 'Journeys Grade 3',
    series: 'Journeys',
    grade: 'G3',
    role: 'Student book',
    units: [unit('j-u1', 'Unit 1', [lesson('j-1', 'Lesson 1')])],
  })

  const library = [workshop, literature, otherGrade, journeys]

  it('pairs a workshop week with the literature week of the same unit and number', () => {
    expect(lessonRefsForTeachingWeek(library, workshop, workshop.units[1]!, 'ws-1')).toEqual([
      { bookId: 'workshop', unitId: 'ws-friends', lessonId: 'ws-1' },
      { bookId: 'literature', unitId: 'lit-friends', lessonId: 'lit-1' },
    ])
    expect(lessonRefsForTeachingWeek(library, literature, literature.units[0]!, 'lit-2')).toEqual([
      { bookId: 'literature', unitId: 'lit-friends', lessonId: 'lit-2' },
      { bookId: 'workshop', unitId: 'ws-friends', lessonId: 'ws-2' },
    ])
  })

  it('matches the unit by theme title even when the books list that unit in a different order', () => {
    expect(lessonRefsForTeachingWeek(library, workshop, workshop.units[0]!, 'ws-other-1')).toEqual([
      { bookId: 'workshop', unitId: 'ws-other', lessonId: 'ws-other-1' },
      { bookId: 'literature', unitId: 'lit-other', lessonId: 'lit-other-1' },
    ])
  })

  it('falls back to the unit index when titles do not match', () => {
    const workshopPlain = book({
      id: 'ws-plain',
      title: 'Workshop',
      series: 'Wonders',
      grade: 'G1',
      role: 'Workshop',
      units: [
        unit('blank', 'Front matter'),
        unit('ws-u', 'Growing Up', [lesson('ws-w2', 'Lesson 2: Go, Pip!')]),
      ],
    })
    const literaturePlain = book({
      id: 'lit-plain',
      title: 'Literature',
      series: 'Wonders',
      grade: 'G1',
      role: 'Literature',
      units: [unit('lit-u', 'How We Grow', [lesson('lit-w2', 'Week 2: Go, Pip!')])],
    })
    expect(lessonRefsForTeachingWeek([workshopPlain, literaturePlain], workshopPlain, workshopPlain.units[1]!, 'ws-w2')).toEqual([
      { bookId: 'ws-plain', unitId: 'ws-u', lessonId: 'ws-w2' },
      { bookId: 'lit-plain', unitId: 'lit-u', lessonId: 'lit-w2' },
    ])
  })

  it('does not pair a handbook lesson or a week the other book is missing', () => {
    expect(lessonRefsForTeachingWeek(library, workshop, workshop.units[1]!, 'ws-handbook')).toEqual([
      { bookId: 'workshop', unitId: 'ws-friends', lessonId: 'ws-handbook' },
    ])
    const literatureShort = book({
      ...literature,
      units: [unit('lit-friends', 'Friends and Family', [lesson('lit-1', 'Week 1: FRIENDS HELP FRIENDS')])],
    })
    expect(lessonRefsForTeachingWeek([workshop, literatureShort], workshop, workshop.units[1]!, 'ws-2')).toEqual([
      { bookId: 'workshop', unitId: 'ws-friends', lessonId: 'ws-2' },
    ])
  })

  it('leaves a single-book series as one lesson', () => {
    expect(lessonRefsForTeachingWeek(library, journeys, journeys.units[0]!, 'j-1')).toEqual([
      { bookId: 'journeys', unitId: 'j-u1', lessonId: 'j-1' },
    ])
  })

  it('does not pair across grades', () => {
    const literatureG3 = book({
      id: 'lit-g3',
      title: 'Wonders Grade 3 — Literature',
      series: 'Wonders',
      grade: 'G3',
      role: 'Literature',
      units: [unit('g3-lit', 'Friends and Family', [lesson('g3-lit-1', 'Week 1: Friends')])],
    })
    expect(lessonRefsForTeachingWeek([otherGrade, literatureG3, literature], otherGrade, otherGrade.units[0]!, 'g3-1')).toEqual([
      { bookId: 'workshop-g3', unitId: 'g3', lessonId: 'g3-1' },
      { bookId: 'lit-g3', unitId: 'g3-lit', lessonId: 'g3-lit-1' },
    ])
  })
})

describe('lessonRefsForTeachingWeek with the library outlines', () => {
  const library = JSON.parse(readFileSync(resolve(process.cwd(), 'book-library/books.json'), 'utf8')) as BookLibraryPayload

  function bookById(id: string): BookRecord {
    const found = library.books.find((book) => book.id === id)
    if (!found) throw new Error(`Missing book ${id}`)
    return found
  }

  function weekLesson(book: BookRecord, unitTitle: string, week: number): { unit: BookUnitRecord; lessonId: string } {
    const unit = book.units.find((item) => item.title === unitTitle)
    const lesson = unit?.lessons?.find((item) => lessonWeekNumber(item.title) === week)
    if (!unit || !lesson) throw new Error(`Missing ${book.id} ${unitTitle} week ${week}`)
    return { unit, lessonId: lesson.id }
  }

  it('pairs each Wonders grade both ways and leaves Journeys as one lesson', () => {
    const pairs = [
      ['readingwriting-workshop-g2', 'literature-anthology-g2', 'Friends and Family'],
      ['other-g3-workshop', 'other-g3-literature', 'Growing and Learning'],
      ['other-g1-workshop', 'other-g1-literature', 'Unit 1'],
    ] as const
    for (const [workshopId, literatureId, unitTitle] of pairs) {
      const workshop = bookById(workshopId)
      const literature = bookById(literatureId)
      const workshopWeek = weekLesson(workshop, unitTitle, 1)
      const literatureWeek = weekLesson(literature, unitTitle, 1)
      expect(lessonRefsForTeachingWeek(library.books, workshop, workshopWeek.unit, workshopWeek.lessonId)).toEqual([
        { bookId: workshop.id, unitId: workshopWeek.unit.id, lessonId: workshopWeek.lessonId },
        { bookId: literature.id, unitId: literatureWeek.unit.id, lessonId: literatureWeek.lessonId },
      ])
      expect(lessonRefsForTeachingWeek(library.books, literature, literatureWeek.unit, literatureWeek.lessonId)).toEqual([
        { bookId: literature.id, unitId: literatureWeek.unit.id, lessonId: literatureWeek.lessonId },
        { bookId: workshop.id, unitId: workshopWeek.unit.id, lessonId: workshopWeek.lessonId },
      ])
    }

    const journeys = bookById('journeys-g3-book-1')
    const journeysUnit = journeys.units.find((unit) => (unit.lessons ?? []).length > 0)
    const journeysLesson = journeysUnit?.lessons?.[0]
    expect(journeysUnit && journeysLesson).toBeTruthy()
    expect(lessonRefsForTeachingWeek(library.books, journeys, journeysUnit!, journeysLesson!.id)).toEqual([
      { bookId: journeys.id, unitId: journeysUnit!.id, lessonId: journeysLesson!.id },
    ])
  })
})

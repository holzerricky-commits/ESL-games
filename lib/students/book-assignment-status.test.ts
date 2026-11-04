import { describe, expect, it } from 'vitest'
import {
  bookAssignmentStatusFor,
  bookSeriesGradeKey,
  inClassBookIds,
  inClassSiblingBookIds,
  pruneBookAssignmentStatus,
} from '@/lib/students/book-assignment-status'

const journeys = [
  { id: 'j3-student', series: 'Journeys', grade: 'G3' },
  { id: 'j3-workshop', series: 'Journeys', grade: 'G3' },
  { id: 'j2-student', series: 'Journeys', grade: 'G2' },
  { id: 'cambridge', series: 'Cambridge', grade: '' },
  { id: 'plain', title: 'Notes' },
]

describe('book assignment status', () => {
  it('treats a missing status as in class and keeps assignment order', () => {
    expect(bookAssignmentStatusFor(undefined, 'j3-student')).toBe('in_class')
    expect(bookAssignmentStatusFor({ 'j3-student': 'paused', mystery: 'nope' as 'paused' }, 'mystery')).toBe('in_class')
    expect(
      inClassBookIds(['j3-student', 'cambridge', 'j3-workshop'], {
        'j3-student': 'paused',
        'j3-workshop': 'finished',
      }),
    ).toEqual(['cambridge'])
  })

  it('matches siblings only when series and grade are both set', () => {
    expect(bookSeriesGradeKey(journeys[3])).toBeNull()
    expect(bookSeriesGradeKey(journeys[4])).toBeNull()
    expect(
      inClassSiblingBookIds({
        books: journeys,
        assignedBookIds: ['j3-student', 'j3-workshop', 'j2-student', 'cambridge', 'plain'],
        status: { 'j2-student': 'paused' },
        bookId: 'j3-student',
      }),
    ).toEqual(['j3-workshop'])
    expect(
      inClassSiblingBookIds({
        books: journeys,
        assignedBookIds: ['cambridge', 'plain'],
        status: undefined,
        bookId: 'cambridge',
      }),
    ).toEqual([])
  })

  it('drops removed books and leaves in-class books unset', () => {
    expect(
      pruneBookAssignmentStatus(
        { 'j3-student': 'paused', 'j3-workshop': 'in_class', cambridge: 'finished', gone: 'paused' },
        ['j3-student', 'j3-workshop', 'cambridge'],
      ),
    ).toEqual({ 'j3-student': 'paused', cambridge: 'finished' })
    expect(pruneBookAssignmentStatus({ 'j3-workshop': 'in_class' }, ['j3-workshop'])).toBeUndefined()
  })
})

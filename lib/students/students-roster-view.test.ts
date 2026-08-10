import { describe, expect, it } from 'vitest'
import {
  filterStudentsByRosterStatus,
  sortStudentsForRoster,
} from '@/lib/students/students-roster-view'
import type { StudentListItemView } from '@/lib/students/types'

function stub(partial: Partial<StudentListItemView> & Pick<StudentListItemView, 'id' | 'name'>): StudentListItemView {
  return {
    studentKey: partial.name.toLowerCase(),
    avatarUrl: undefined,
    levelLabel: 'Level 1',
    progressLabel: '0% progress',
    coinsLabel: 'Coins: 0',
    currentChallengeLabel: 'No challenges assigned yet',
    totalAttempts: 0,
    lastActiveLabel: 'No activity yet',
    nextClassLabel: 'No upcoming class',
    nextClassAt: null,
    curriculumBookLabel: '—',
    curriculumUnitLabel: '—',
    curriculumPageLabel: '—',
    curriculumThumbFilePath: null,
    curriculumThumbUnitId: null,
    curriculumThumbPage: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    needsSetup: false,
    setupHint: '',
    finishSetupHref: `/students/${partial.id}?setup=1`,
    openPlanHref: `/students/${partial.id}?tab=classes`,
    isOnBreak: false,
    ...partial,
  }
}

describe('students-roster-view', () => {
  const alex = stub({
    id: 'a',
    name: 'Alex',
    nextClassAt: '2026-07-28T10:00:00.000Z',
    needsSetup: false,
  })
  const mei = stub({
    id: 'm',
    name: 'Mei',
    nextClassAt: '2026-07-27T10:00:00.000Z',
    needsSetup: true,
  })
  const zoe = stub({
    id: 'z',
    name: 'Zoe',
    nextClassAt: null,
    needsSetup: false,
    isOnBreak: true,
  })

  it('filters by status', () => {
    const all = [alex, mei, zoe]
    expect(filterStudentsByRosterStatus(all, 'active').map((s) => s.id)).toEqual(['a', 'm'])
    expect(filterStudentsByRosterStatus(all, 'needsSetup').map((s) => s.id)).toEqual(['m'])
    expect(filterStudentsByRosterStatus(all, 'onBreak').map((s) => s.id)).toEqual(['z'])
  })

  it('sorts by name, next class, and needs setup', () => {
    const active = [alex, mei]
    expect(sortStudentsForRoster(active, 'name').map((s) => s.id)).toEqual(['a', 'm'])
    expect(sortStudentsForRoster(active, 'nextClass').map((s) => s.id)).toEqual(['m', 'a'])
    expect(sortStudentsForRoster(active, 'needsSetup').map((s) => s.id)).toEqual(['m', 'a'])
  })

  it('puts students without a next class after those with one', () => {
    const none = stub({ id: 'n', name: 'Nora', nextClassAt: null })
    expect(sortStudentsForRoster([alex, none], 'nextClass').map((s) => s.id)).toEqual(['a', 'n'])
  })
})

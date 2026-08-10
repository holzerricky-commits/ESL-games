import type { StudentListItemView } from '@/lib/students/types'
import type { StudentsRosterSort, StudentsRosterStatusFilter } from '@/lib/students/students-roster-prefs'

export function filterStudentsByRosterStatus(
  students: StudentListItemView[],
  status: StudentsRosterStatusFilter,
): StudentListItemView[] {
  switch (status) {
    case 'needsSetup':
      return students.filter((s) => !s.isOnBreak && s.needsSetup)
    case 'onBreak':
      return students.filter((s) => s.isOnBreak)
    case 'active':
    default:
      return students.filter((s) => !s.isOnBreak)
  }
}

export function sortStudentsForRoster(
  students: StudentListItemView[],
  sort: StudentsRosterSort,
): StudentListItemView[] {
  const copy = [...students]
  switch (sort) {
    case 'nextClass':
      return copy.sort((a, b) => {
        const aMs = a.nextClassAt ? new Date(a.nextClassAt).getTime() : Number.POSITIVE_INFINITY
        const bMs = b.nextClassAt ? new Date(b.nextClassAt).getTime() : Number.POSITIVE_INFINITY
        if (aMs !== bMs) return aMs - bMs
        return a.name.localeCompare(b.name)
      })
    case 'needsSetup':
      return copy.sort((a, b) => {
        const aSetup = a.needsSetup ? 0 : 1
        const bSetup = b.needsSetup ? 0 : 1
        if (aSetup !== bSetup) return aSetup - bSetup
        return a.name.localeCompare(b.name)
      })
    case 'name':
    default:
      return copy.sort((a, b) => a.name.localeCompare(b.name))
  }
}

export function bookPageLabelForStudent(student: StudentListItemView): string {
  if (student.curriculumPageLabel && student.curriculumPageLabel !== '—') {
    return `${student.curriculumBookLabel} · p. ${student.curriculumPageLabel}`
  }
  return student.curriculumBookLabel
}

export function openHrefForStudent(student: StudentListItemView): string {
  return student.needsSetup ? student.finishSetupHref : student.openPlanHref
}

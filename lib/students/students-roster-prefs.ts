export type StudentsRosterViewMode = 'list' | 'grid'
export type StudentsRosterStatusFilter = 'active' | 'needsSetup' | 'onBreak'
export type StudentsRosterSort = 'name' | 'nextClass' | 'needsSetup'

export interface StudentsRosterPrefs {
  viewMode: StudentsRosterViewMode
  statusFilter: StudentsRosterStatusFilter
  sort: StudentsRosterSort
}

export const STUDENTS_ROSTER_PREFS_KEY = 'esl_students_roster_prefs'

export const DEFAULT_STUDENTS_ROSTER_PREFS: StudentsRosterPrefs = {
  viewMode: 'list',
  statusFilter: 'active',
  sort: 'name',
}

function isViewMode(value: unknown): value is StudentsRosterViewMode {
  return value === 'list' || value === 'grid'
}

function isStatusFilter(value: unknown): value is StudentsRosterStatusFilter {
  return value === 'active' || value === 'needsSetup' || value === 'onBreak'
}

function isSort(value: unknown): value is StudentsRosterSort {
  return value === 'name' || value === 'nextClass' || value === 'needsSetup'
}

export function readStudentsRosterPrefs(): StudentsRosterPrefs {
  if (typeof window === 'undefined') return { ...DEFAULT_STUDENTS_ROSTER_PREFS }
  try {
    const raw = window.localStorage.getItem(STUDENTS_ROSTER_PREFS_KEY)
    if (!raw) return { ...DEFAULT_STUDENTS_ROSTER_PREFS }
    const parsed = JSON.parse(raw) as Partial<StudentsRosterPrefs>
    return {
      viewMode: isViewMode(parsed.viewMode) ? parsed.viewMode : DEFAULT_STUDENTS_ROSTER_PREFS.viewMode,
      statusFilter: isStatusFilter(parsed.statusFilter)
        ? parsed.statusFilter
        : DEFAULT_STUDENTS_ROSTER_PREFS.statusFilter,
      sort: isSort(parsed.sort) ? parsed.sort : DEFAULT_STUDENTS_ROSTER_PREFS.sort,
    }
  } catch {
    return { ...DEFAULT_STUDENTS_ROSTER_PREFS }
  }
}

export function writeStudentsRosterPrefs(prefs: StudentsRosterPrefs): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STUDENTS_ROSTER_PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // Ignore quota / private mode failures — prefs are convenience only.
  }
}

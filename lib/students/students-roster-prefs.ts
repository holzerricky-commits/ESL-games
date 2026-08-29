export type StudentsRosterViewMode = 'list' | 'grid'
export type StudentsRosterStatusFilter = 'active' | 'needsSetup' | 'onBreak'
export type StudentsRosterSort = 'name' | 'nextClass' | 'needsSetup'

export interface StudentsRosterPrefs {
  viewMode: StudentsRosterViewMode
  statusFilter: StudentsRosterStatusFilter
  sort: StudentsRosterSort
}

export const STUDENTS_ROSTER_PREFS_KEY = 'esl_students_roster_prefs'
export const STUDENTS_ROSTER_PREFS_COOKIE = 'esl_students_roster_prefs'
const STUDENTS_ROSTER_PREFS_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

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

export function normalizeStudentsRosterPrefs(raw: unknown): StudentsRosterPrefs {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_STUDENTS_ROSTER_PREFS }
  }
  const parsed = raw as Partial<StudentsRosterPrefs>
  return {
    viewMode: isViewMode(parsed.viewMode) ? parsed.viewMode : DEFAULT_STUDENTS_ROSTER_PREFS.viewMode,
    statusFilter: isStatusFilter(parsed.statusFilter)
      ? parsed.statusFilter
      : DEFAULT_STUDENTS_ROSTER_PREFS.statusFilter,
    sort: isSort(parsed.sort) ? parsed.sort : DEFAULT_STUDENTS_ROSTER_PREFS.sort,
  }
}

export function parseStudentsRosterPrefsCookie(value: string | undefined): StudentsRosterPrefs | null {
  if (!value) return null
  const candidates = [value]
  try {
    candidates.unshift(decodeURIComponent(value))
  } catch {
    /* already decoded */
  }
  for (const candidate of candidates) {
    try {
      return normalizeStudentsRosterPrefs(JSON.parse(candidate) as unknown)
    } catch {
      /* try next */
    }
  }
  return null
}

function readCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null
  const prefix = `${name}=`
  const parts = document.cookie.split(';')
  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed.startsWith(prefix)) continue
    try {
      return decodeURIComponent(trimmed.slice(prefix.length))
    } catch {
      return trimmed.slice(prefix.length)
    }
  }
  return null
}

function writeCookieValue(name: string, value: string): void {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${STUDENTS_ROSTER_PREFS_COOKIE_MAX_AGE}; SameSite=Lax`
}

function readLocalStorageRaw(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(STUDENTS_ROSTER_PREFS_KEY)
  } catch {
    return null
  }
}

export function hasStoredStudentsRosterPrefs(): boolean {
  if (readCookieValue(STUDENTS_ROSTER_PREFS_COOKIE)) return true
  const raw = readLocalStorageRaw()
  return Boolean(raw)
}

export function readStudentsRosterPrefs(): StudentsRosterPrefs {
  const cookieRaw = readCookieValue(STUDENTS_ROSTER_PREFS_COOKIE)
  const fromCookie = parseStudentsRosterPrefsCookie(cookieRaw ?? undefined)
  if (fromCookie) return fromCookie
  const raw = readLocalStorageRaw()
  if (!raw) return { ...DEFAULT_STUDENTS_ROSTER_PREFS }
  try {
    return normalizeStudentsRosterPrefs(JSON.parse(raw) as unknown)
  } catch {
    return { ...DEFAULT_STUDENTS_ROSTER_PREFS }
  }
}

export function writeStudentsRosterPrefs(prefs: StudentsRosterPrefs): void {
  const normalized = normalizeStudentsRosterPrefs(prefs)
  const serialized = JSON.stringify(normalized)
  writeCookieValue(STUDENTS_ROSTER_PREFS_COOKIE, serialized)
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STUDENTS_ROSTER_PREFS_KEY, serialized)
  } catch {
    // Cookie still holds the choice if browser storage is full.
  }
}

export function persistStudentsRosterPrefs(prefs: StudentsRosterPrefs): void {
  const normalized = normalizeStudentsRosterPrefs(prefs)
  writeStudentsRosterPrefs(normalized)
  if (typeof window === 'undefined') return
  void fetch('/api/local-data/roster-prefs', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(normalized),
  }).catch(() => {
    /* disk save is best-effort; cookie already holds the choice */
  })
}

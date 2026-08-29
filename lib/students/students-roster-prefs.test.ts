import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_STUDENTS_ROSTER_PREFS,
  hasStoredStudentsRosterPrefs,
  parseStudentsRosterPrefsCookie,
  persistStudentsRosterPrefs,
  readStudentsRosterPrefs,
  STUDENTS_ROSTER_PREFS_COOKIE,
  STUDENTS_ROSTER_PREFS_KEY,
  writeStudentsRosterPrefs,
} from '@/lib/students/students-roster-prefs'

const storage = new Map<string, string>()
let cookieJar = ''

function mockBrowserStorage() {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v),
      removeItem: (k: string) => storage.delete(k),
    },
  })
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: globalThis.localStorage },
  })
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      get cookie() {
        return cookieJar
      },
      set cookie(value: string) {
        const pair = value.split(';')[0] ?? ''
        const eq = pair.indexOf('=')
        const name = eq >= 0 ? pair.slice(0, eq) : pair
        cookieJar = `${name}=${eq >= 0 ? pair.slice(eq + 1) : ''}`
      },
    },
  })
}

afterEach(() => {
  storage.clear()
  cookieJar = ''
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('students-roster-prefs', () => {
  it('round-trips view mode so grid survives a reload', () => {
    mockBrowserStorage()

    writeStudentsRosterPrefs({
      ...DEFAULT_STUDENTS_ROSTER_PREFS,
      viewMode: 'grid',
    })

    expect(storage.get(STUDENTS_ROSTER_PREFS_KEY)).toContain('"viewMode":"grid"')
    expect(cookieJar).toContain(STUDENTS_ROSTER_PREFS_COOKIE)
    expect(readStudentsRosterPrefs().viewMode).toBe('grid')
    expect(hasStoredStudentsRosterPrefs()).toBe(true)
  })

  it('keeps grid from the cookie even if browser storage is full', () => {
    mockBrowserStorage()
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => {
          throw new Error('quota')
        },
        setItem: () => {
          throw new Error('quota')
        },
        removeItem: () => {
          throw new Error('quota')
        },
      },
    })
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { localStorage: globalThis.localStorage },
    })

    writeStudentsRosterPrefs({
      ...DEFAULT_STUDENTS_ROSTER_PREFS,
      viewMode: 'grid',
    })

    expect(readStudentsRosterPrefs().viewMode).toBe('grid')
  })

  it('parses a saved cookie so the server can reopen on grid', () => {
    expect(
      parseStudentsRosterPrefsCookie(
        JSON.stringify({ viewMode: 'grid', statusFilter: 'active', sort: 'name' }),
      )?.viewMode,
    ).toBe('grid')
    expect(
      parseStudentsRosterPrefsCookie(
        encodeURIComponent(JSON.stringify({ viewMode: 'grid', statusFilter: 'active', sort: 'name' })),
      )?.viewMode,
    ).toBe('grid')
    expect(parseStudentsRosterPrefsCookie(undefined)).toBeNull()
  })

  it('keeps sort and status with the view choice', () => {
    mockBrowserStorage()

    writeStudentsRosterPrefs({
      viewMode: 'grid',
      statusFilter: 'needsSetup',
      sort: 'nextClass',
    })

    expect(readStudentsRosterPrefs()).toEqual({
      viewMode: 'grid',
      statusFilter: 'needsSetup',
      sort: 'nextClass',
    })
  })

  it('falls back to list when nothing is saved', () => {
    mockBrowserStorage()
    expect(readStudentsRosterPrefs()).toEqual(DEFAULT_STUDENTS_ROSTER_PREFS)
    expect(hasStoredStudentsRosterPrefs()).toBe(false)
  })

  it('saves to disk in the background when toggling', () => {
    mockBrowserStorage()
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    persistStudentsRosterPrefs({
      ...DEFAULT_STUDENTS_ROSTER_PREFS,
      viewMode: 'grid',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/local-data/roster-prefs',
      expect.objectContaining({ method: 'PUT' }),
    )
    expect(readStudentsRosterPrefs().viewMode).toBe('grid')
  })
})

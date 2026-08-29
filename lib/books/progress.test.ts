import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  flushPendingUnitPageSave,
  getLatestSavedUnitPageForBook,
  getSavedUnitPage,
  peekSavedUnitPage,
  scheduleSaveUnitPage,
  saveUnitPage,
  UNIT_PAGE_SAVE_DEBOUNCE_MS,
} from '@/lib/books/progress'

const storage = new Map<string, string>()

function mockLocalStorage() {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v),
      removeItem: (k: string) => storage.delete(k),
      clear: () => storage.clear(),
    },
  })
}

describe('unit page progress debounce', () => {
  beforeEach(() => {
    mockLocalStorage()
    storage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    flushPendingUnitPageSave()
    vi.useRealTimers()
  })

  it('coalesces rapid scheduleSaveUnitPage calls', () => {
    scheduleSaveUnitPage('book-a', 'unit-1', 3)
    scheduleSaveUnitPage('book-a', 'unit-1', 5)
    scheduleSaveUnitPage('book-a', 'unit-1', 7)
    expect(getSavedUnitPage('book-a', 'unit-1')).toBe(1)
    vi.advanceTimersByTime(UNIT_PAGE_SAVE_DEBOUNCE_MS)
    expect(getSavedUnitPage('book-a', 'unit-1')).toBe(7)
  })

  it('flushPendingUnitPageSave writes immediately', () => {
    scheduleSaveUnitPage('book-a', 'unit-1', 12)
    flushPendingUnitPageSave()
    expect(getSavedUnitPage('book-a', 'unit-1')).toBe(12)
  })

  it('peekSavedUnitPage returns null until a page is stored', () => {
    expect(peekSavedUnitPage('book-a', 'unit-1')).toBeNull()
    saveUnitPage('book-a', 'unit-1', 9)
    expect(peekSavedUnitPage('book-a', 'unit-1')).toBe(9)
  })

  it('getLatestSavedUnitPageForBook picks the newest unit entry', () => {
    vi.setSystemTime(new Date('2026-05-01T12:00:00.000Z'))
    saveUnitPage('book-a', 'unit-1', 3)
    vi.setSystemTime(new Date('2026-05-02T12:00:00.000Z'))
    saveUnitPage('book-a', 'unit-2', 40)
    expect(getLatestSavedUnitPageForBook('book-a')).toMatchObject({
      unitId: 'unit-2',
      page: 40,
    })
  })
})

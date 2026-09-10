import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  applyBackupPayloadAsync,
  buildBackupPayloadAsync,
  LOCAL_DATA_BACKUP_KIND,
  validateBackupPayload,
} from '@/lib/local-data-backup'
import { mergeWeeklySchedulePutBody } from '@/lib/local-data/weekly-schedule-disk-types'

class LocalStorageMock {
  private map = new Map<string, string>()

  getItem(key: string) {
    return this.map.get(key) ?? null
  }

  key(index: number) {
    return Array.from(this.map.keys())[index] ?? null
  }

  removeItem(key: string) {
    this.map.delete(key)
  }

  setItem(key: string, value: string) {
    this.map.set(key, value)
  }

  get length() {
    return this.map.size
  }
}

function mockBrowser() {
  const storage = new LocalStorageMock()
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    writable: true,
    configurable: true,
  })
  Object.defineProperty(globalThis, 'window', {
    value: { localStorage: storage },
    writable: true,
    configurable: true,
  })
  return storage
}

function jsonOk(body: unknown) {
  return Promise.resolve({
    ok: true,
    json: async () => body,
  })
}

function jsonMiss() {
  return Promise.resolve({
    ok: false,
    json: async () => ({}),
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('validateBackupPayload', () => {
  it('accepts minimal valid payload', () => {
    const p = validateBackupPayload({
      kind: LOCAL_DATA_BACKUP_KIND,
      version: 1,
      exportedAt: '2026-05-02T12:00:00.000Z',
      localStorage: { esl_quizzes: '[]', esl_students: null },
    })
    expect(p).not.toBeNull()
    expect(p!.localStorage['esl_quizzes']).toBe('[]')
    expect(p!.localStorage['esl_students']).toBeNull()
  })

  it('rejects bad keys', () => {
    expect(
      validateBackupPayload({
        version: 1,
        localStorage: { evil: '{}' },
      }),
    ).toBeNull()
  })

  it('rejects non-string values', () => {
    expect(
      validateBackupPayload({
        version: 1,
        localStorage: { esl_quizzes: 123 },
      }),
    ).toBeNull()
  })
})

describe('weekly schedule exceptions in backup', () => {
  const cancelled = [
    { slotId: 'slot-1', localDate: '2026-09-14', type: 'cancelled' },
  ]

  it('copies cancelled class dates from disk into the backup file', async () => {
    mockBrowser()
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/local-data/weekly-schedule') {
          return jsonOk({
            ok: true,
            config: { startHour: 8 },
            assignments: [{ id: 'slot-1', studentId: 'stu-1' }],
            exceptions: cancelled,
          })
        }
        return jsonMiss()
      }),
    )

    const payload = await buildBackupPayloadAsync()
    expect(JSON.parse(payload.localStorage.esl_weekly_slot_exceptions ?? 'null')).toEqual(cancelled)
    expect(JSON.parse(payload.localStorage.esl_weekly_slot_assignments ?? 'null')).toEqual([
      { id: 'slot-1', studentId: 'stu-1' },
    ])
  })

  it('puts cancelled class dates back on disk when restoring, even with no ink backup', async () => {
    mockBrowser()
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        return jsonOk({ ok: true })
      }
      return jsonMiss()
    })
    vi.stubGlobal('fetch', fetchMock)

    await applyBackupPayloadAsync({
      kind: LOCAL_DATA_BACKUP_KIND,
      version: 1,
      exportedAt: '2026-09-10T11:00:00.000Z',
      localStorage: {
        esl_weekly_schedule_config: JSON.stringify({ startHour: 8 }),
        esl_weekly_slot_assignments: JSON.stringify([{ id: 'slot-1' }]),
        esl_weekly_slot_exceptions: JSON.stringify(cancelled),
      },
    })

    const schedulePut = fetchMock.mock.calls.find(
      ([url, init]) => url === '/api/local-data/weekly-schedule' && init?.method === 'PUT',
    )
    expect(schedulePut).toBeTruthy()
    const body = JSON.parse(String(schedulePut![1]?.body)) as { exceptions?: unknown[] }
    expect(body.exceptions).toEqual(cancelled)
  })
})

describe('mergeWeeklySchedulePutBody', () => {
  const current = {
    config: { startHour: 8 },
    assignments: [{ id: 'slot-1' }],
    exceptions: [{ slotId: 'slot-1', localDate: '2026-09-14', type: 'cancelled' }],
  }

  it('keeps existing cancellations when a PUT omits exceptions', () => {
    const merged = mergeWeeklySchedulePutBody(
      { config: { startHour: 9 }, assignments: [{ id: 'slot-1' }] },
      current,
    )
    expect(merged.exceptions).toEqual(current.exceptions)
    expect(merged.config).toEqual({ startHour: 9 })
  })

  it('replaces cancellations when the PUT includes exceptions', () => {
    const merged = mergeWeeklySchedulePutBody(
      { config: current.config, assignments: current.assignments, exceptions: [] },
      current,
    )
    expect(merged.exceptions).toEqual([])
  })
})

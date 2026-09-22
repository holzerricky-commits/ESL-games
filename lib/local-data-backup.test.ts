import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  applyDiskStudentRecordsFromBackup,
  LOCAL_DATA_BACKUP_KIND,
  validateBackupPayload,
  type LocalDataBackupPayload,
} from '@/lib/local-data-backup'

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

describe('applyDiskStudentRecordsFromBackup', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reports failure when disk student PUT is not ok (does not pretend success)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ ok: false, error: 'disk full' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
    const payload: LocalDataBackupPayload = {
      kind: LOCAL_DATA_BACKUP_KIND,
      version: 1,
      exportedAt: '2026-05-02T12:00:00.000Z',
      localStorage: {
        esl_students: JSON.stringify([{ id: 'stu_a', name: 'Ada' }]),
      },
    }
    const result = await applyDiskStudentRecordsFromBackup(payload)
    expect(result.attempted).toBe(true)
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/disk full|500/i)
  })

  it('succeeds when disk PUTs return ok', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const payload: LocalDataBackupPayload = {
      kind: LOCAL_DATA_BACKUP_KIND,
      version: 1,
      exportedAt: '2026-05-02T12:00:00.000Z',
      localStorage: {
        esl_students: JSON.stringify([{ id: 'stu_a', name: 'Ada' }]),
        esl_student_progress: JSON.stringify({ ada: { studentKey: 'ada', challenges: [] } }),
      },
    }
    const result = await applyDiskStudentRecordsFromBackup(payload)
    expect(result).toEqual({ attempted: true, ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

import { beforeEach, describe, expect, it } from 'vitest'
import { applyBackupPayload, LOCAL_DATA_BACKUP_KIND, validateBackupPayload } from '@/lib/local-data-backup'

describe('validateBackupPayload', () => {
  it('accepts minimal valid payload', () => {
    const p = validateBackupPayload({
      kind: LOCAL_DATA_BACKUP_KIND,
      version: 1,
      exportedAt: '2026-05-02T12:00:00.000Z',
      localStorage: { esl_quizzes: '[]', esl_students: '[{"id":"student-1"}]' },
    })
    expect(p).not.toBeNull()
    expect(p!.localStorage['esl_quizzes']).toBe('[]')
    expect(p!.localStorage['esl_students']).toBe('[{"id":"student-1"}]')
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

  it('rejects null values so restore cannot delete stored data', () => {
    expect(
      validateBackupPayload({
        version: 1,
        localStorage: { esl_students: null },
      }),
    ).toBeNull()
  })
})

describe('applyBackupPayload', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('only writes keys in the backup payload and leaves other app data alone', () => {
    localStorage.setItem('esl_students', '[{"id":"existing"}]')
    localStorage.setItem('esl_quizzes', '[{"id":"quiz-1"}]')

    const result = applyBackupPayload({
      kind: LOCAL_DATA_BACKUP_KIND,
      version: 1,
      exportedAt: '2026-05-02T12:00:00.000Z',
      localStorage: { esl_quizzes: '[]' },
    })

    expect(result.keysWritten).toBe(1)
    expect(localStorage.getItem('esl_quizzes')).toBe('[]')
    expect(localStorage.getItem('esl_students')).toBe('[{"id":"existing"}]')
  })
})

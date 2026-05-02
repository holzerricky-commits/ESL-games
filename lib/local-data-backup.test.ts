import { describe, expect, it } from 'vitest'
import { LOCAL_DATA_BACKUP_KIND, validateBackupPayload } from '@/lib/local-data-backup'

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

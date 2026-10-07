import { describe, expect, it } from 'vitest'
import {
  EMPTY_LESSON_VAULT_CARDS,
  getLessonVaultCardsForStudent,
} from '@/lib/lesson-vault/disk-client'

describe('getLessonVaultCardsForStudent', () => {
  it('returns the same empty array when a student has no cards', () => {
    const first = getLessonVaultCardsForStudent('student-without-vault')
    const second = getLessonVaultCardsForStudent('student-without-vault')
    expect(first).toBe(EMPTY_LESSON_VAULT_CARDS)
    expect(second).toBe(first)
  })

  it('returns the same empty array for a blank student id', () => {
    expect(getLessonVaultCardsForStudent('  ')).toBe(EMPTY_LESSON_VAULT_CARDS)
    expect(getLessonVaultCardsForStudent('')).toBe(getLessonVaultCardsForStudent('   '))
  })
})

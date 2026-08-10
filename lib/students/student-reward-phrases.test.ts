import { describe, expect, it } from 'vitest'
import {
  STUDENT_REWARD_PHRASES,
  pickStudentRewardPhrase,
} from '@/lib/students/student-reward-phrases'

describe('pickStudentRewardPhrase', () => {
  it('returns a phrase from the pool', () => {
    const phrase = pickStudentRewardPhrase()
    expect(STUDENT_REWARD_PHRASES).toContain(phrase)
  })

  it('does not repeat the last phrase when alternatives exist', () => {
    const last = STUDENT_REWARD_PHRASES[0]!
    for (let i = 0; i < 20; i++) {
      expect(pickStudentRewardPhrase(last)).not.toBe(last)
    }
  })
})

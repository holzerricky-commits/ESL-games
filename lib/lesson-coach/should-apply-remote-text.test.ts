import { describe, expect, it } from 'vitest'
import { shouldApplyRemoteSharedText } from '@/lib/lesson-coach/should-apply-remote-text'

describe('shouldApplyRemoteSharedText', () => {
  it('rejects stale shorter server text while typing ahead', () => {
    expect(shouldApplyRemoteSharedText('hel', 'hello', 'hel')).toBe(false)
  })

  it('accepts coach apply-fix that extends text', () => {
    expect(shouldApplyRemoteSharedText('he goes', 'he go', 'he go')).toBe(true)
  })

  it('skips when already matches local', () => {
    expect(shouldApplyRemoteSharedText('hello', 'hello', 'hello')).toBe(false)
  })
})

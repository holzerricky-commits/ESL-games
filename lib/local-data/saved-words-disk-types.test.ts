import { describe, expect, it } from 'vitest'
import {
  isSavedWordsDiskPayloadEmpty,
  normalizeSavedWordsDiskPayload,
  SAVED_WORDS_LEGACY_SCOPE,
} from '@/lib/local-data/saved-words-disk-types'

describe('saved-words-disk-types', () => {
  it('normalizes legacy bare array into __legacy__ scope', () => {
    const payload = normalizeSavedWordsDiskPayload([{ id: '1', source: 'hi', chinese: '你好' }])
    expect(payload.byStudent[SAVED_WORDS_LEGACY_SCOPE]).toHaveLength(1)
  })

  it('normalizes byStudent map', () => {
    const payload = normalizeSavedWordsDiskPayload({
      byStudent: { 'stu-1': [{ id: 'a' }], 'stu-2': [] },
    })
    expect(payload.byStudent['stu-1']).toHaveLength(1)
    expect(payload.byStudent['stu-2']).toEqual([])
  })

  it('detects empty payload', () => {
    expect(isSavedWordsDiskPayloadEmpty({ byStudent: {} })).toBe(true)
    expect(isSavedWordsDiskPayloadEmpty({ byStudent: { a: [] } })).toBe(true)
    expect(isSavedWordsDiskPayloadEmpty({ byStudent: { a: [{}] } })).toBe(false)
  })
})

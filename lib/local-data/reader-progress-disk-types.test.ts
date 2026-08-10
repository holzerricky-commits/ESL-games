import { describe, expect, it } from 'vitest'
import {
  isReaderProgressDiskPayloadEmpty,
  normalizeReaderProgressDiskPayload,
} from '@/lib/local-data/reader-progress-disk-types'

describe('reader-progress-disk-types', () => {
  it('normalizes legacy bare progress map', () => {
    const payload = normalizeReaderProgressDiskPayload({
      'book-a': { 'unit-1': { page: 4, updatedAt: '2026-01-01T00:00:00.000Z' } },
    })
    expect(payload.progress['book-a']?.['unit-1']?.page).toBe(4)
  })

  it('normalizes { progress } payload', () => {
    const payload = normalizeReaderProgressDiskPayload({
      progress: { 'book-a': { 'unit-1': { page: 9, updatedAt: '2026-01-01T00:00:00.000Z' } } },
    })
    expect(payload.progress['book-a']?.['unit-1']?.page).toBe(9)
  })

  it('detects empty payload', () => {
    expect(isReaderProgressDiskPayloadEmpty({ progress: {} })).toBe(true)
    expect(
      isReaderProgressDiskPayloadEmpty({
        progress: { 'book-a': { 'unit-1': { page: 2 } } },
      }),
    ).toBe(false)
  })
})

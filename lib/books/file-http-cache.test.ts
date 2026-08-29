import { describe, expect, it } from 'vitest'
import { fileEtag, ifNoneMatchHits } from '@/lib/books/file-http-cache'

describe('fileEtag', () => {
  it('changes when size or mtime changes', () => {
    const a = fileEtag({ size: 10, mtimeMs: 1000 })
    const b = fileEtag({ size: 11, mtimeMs: 1000 })
    const c = fileEtag({ size: 10, mtimeMs: 2000 })
    expect(a).not.toBe(b)
    expect(a).not.toBe(c)
  })
})

describe('ifNoneMatchHits', () => {
  it('matches a stored etag', () => {
    const etag = fileEtag({ size: 8, mtimeMs: 1 })
    expect(ifNoneMatchHits(etag, etag)).toBe(true)
    expect(ifNoneMatchHits(`W/${etag}, "other"`, etag)).toBe(true)
    expect(ifNoneMatchHits('"nope"', etag)).toBe(false)
    expect(ifNoneMatchHits(null, etag)).toBe(false)
  })
})

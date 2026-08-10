import { describe, expect, it, vi } from 'vitest'
import {
  fetchBoardImageBytes,
  isAllowedBoardImageImportHost,
  normalizeBoardImageMimeType,
  parseBoardImageImportUrl,
} from '@/lib/board-image-import'

describe('board-image-import', () => {
  it('isAllowedBoardImageImportHost allows Pixabay and Giphy CDNs', () => {
    expect(isAllowedBoardImageImportHost('cdn.pixabay.com')).toBe(true)
    expect(isAllowedBoardImageImportHost('pixabay.com')).toBe(true)
    expect(isAllowedBoardImageImportHost('media0.giphy.com')).toBe(true)
    expect(isAllowedBoardImageImportHost('media.tenor.com')).toBe(true)
    expect(isAllowedBoardImageImportHost('example.com')).toBe(false)
    expect(isAllowedBoardImageImportHost('localhost')).toBe(false)
  })

  it('parseBoardImageImportUrl rejects non-https and unknown hosts', () => {
    expect(parseBoardImageImportUrl('')).toEqual({ ok: false, reason: 'invalid' })
    expect(parseBoardImageImportUrl('not-a-url')).toEqual({ ok: false, reason: 'invalid' })
    expect(parseBoardImageImportUrl('http://cdn.pixabay.com/a.jpg')).toEqual({
      ok: false,
      reason: 'blocked',
    })
    expect(parseBoardImageImportUrl('https://evil.example/photo.jpg')).toEqual({
      ok: false,
      reason: 'blocked',
    })
  })

  it('parseBoardImageImportUrl accepts https Pixabay URLs', () => {
    const parsed = parseBoardImageImportUrl('https://cdn.pixabay.com/photo/2024/01/01/fly.jpg')
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.url.hostname).toBe('cdn.pixabay.com')
    }
  })

  it('normalizeBoardImageMimeType accepts common image types', () => {
    expect(normalizeBoardImageMimeType('image/jpeg; charset=binary')).toBe('image/jpeg')
    expect(normalizeBoardImageMimeType('image/png')).toBe('image/png')
    expect(normalizeBoardImageMimeType('text/html')).toBeNull()
  })

  it('fetchBoardImageBytes enforces size and mime limits', async () => {
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0x00])
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) => {
          if (name === 'content-type') return 'image/jpeg'
          if (name === 'content-length') return String(jpegBytes.byteLength)
          return null
        },
      },
      arrayBuffer: async () => jpegBytes.buffer,
    } as Response)

    const ok = await fetchBoardImageBytes(new URL('https://cdn.pixabay.com/test.jpg'), {
      fetchImpl,
    })
    expect(ok.ok).toBe(true)
    if (ok.ok) {
      expect(ok.mimeType).toBe('image/jpeg')
      expect(ok.bytes.byteLength).toBe(4)
    }

    const tooLarge = await fetchBoardImageBytes(new URL('https://cdn.pixabay.com/big.jpg'), {
      fetchImpl: vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: (name: string) => {
            if (name === 'content-type') return 'image/jpeg'
            if (name === 'content-length') return String(9_000_000)
            return null
          },
        },
        arrayBuffer: async () => new ArrayBuffer(0),
      } as Response),
      maxBytes: 100,
    })
    expect(tooLarge).toEqual({ ok: false, reason: 'too_large' })

    const badMime = await fetchBoardImageBytes(new URL('https://cdn.pixabay.com/page.html'), {
      fetchImpl: vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: (name: string) => (name === 'content-type' ? 'text/html' : null),
        },
        arrayBuffer: async () => new ArrayBuffer(8),
      } as Response),
    })
    expect(badMime).toEqual({ ok: false, reason: 'invalid_type' })
  })
})

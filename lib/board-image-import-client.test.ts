import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchBoardImageAsFile } from '@/lib/board-image-import-client'

describe('fetchBoardImageAsFile', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns null for failed import responses', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response)
    await expect(fetchBoardImageAsFile('https://cdn.pixabay.com/a.jpg')).resolves.toBeNull()
  })

  it('returns a File when import succeeds', async () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0x00])
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      blob: async () => new Blob([bytes], { type: 'image/jpeg' }),
    } as Response)

    const file = await fetchBoardImageAsFile('https://cdn.pixabay.com/a.jpg')
    expect(file).not.toBeNull()
    expect(file?.type).toBe('image/jpeg')
    expect(file?.name).toBe('board-image.jpg')
    expect(fetch).toHaveBeenCalledWith(
      '/api/board-image-import?url=' + encodeURIComponent('https://cdn.pixabay.com/a.jpg'),
    )
  })
})

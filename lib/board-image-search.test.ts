import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  parseBoardImageSearchLimit,
  parseBoardImageSearchPage,
  parseBoardImageSearchParams,
  searchBoardStaticImages,
} from '@/lib/board-image-search'
import { scoreAndMergePixabayHits } from '@/lib/quiz-image-pixabay'

describe('board-image-search params', () => {
  it('parseBoardImageSearchLimit clamps to 1–24', () => {
    expect(parseBoardImageSearchLimit(null)).toBe(12)
    expect(parseBoardImageSearchLimit('0')).toBe(1)
    expect(parseBoardImageSearchLimit('100')).toBe(24)
    expect(parseBoardImageSearchLimit('8')).toBe(8)
    expect(parseBoardImageSearchLimit('nope')).toBe(12)
  })

  it('parseBoardImageSearchPage clamps to non-negative', () => {
    expect(parseBoardImageSearchPage(null)).toBe(0)
    expect(parseBoardImageSearchPage('-1')).toBe(0)
    expect(parseBoardImageSearchPage('2')).toBe(2)
  })

  it('parseBoardImageSearchParams returns empty for blank q', () => {
    expect(parseBoardImageSearchParams(new URLSearchParams(''))).toBe('empty')
    expect(parseBoardImageSearchParams(new URLSearchParams('q=   '))).toBe('empty')
  })

  it('parseBoardImageSearchParams accepts gif type', () => {
    const params = parseBoardImageSearchParams(new URLSearchParams('q=jump&type=gif'))
    expect(params).not.toBe('empty')
    if (params === 'empty') throw new Error('expected params object')
    expect(params.mediaType).toBe('gif')
  })

  it('parseBoardImageSearchParams parses static search fields', () => {
    const params = parseBoardImageSearchParams(
      new URLSearchParams('q=fly&limit=6&style=Photo&sq=house+fly+insect&page=1&v=abc'),
    )
    expect(params).not.toBe('empty')
    if (params === 'empty') throw new Error('expected params object')
    expect(params.q).toBe('fly')
    expect(params.limit).toBe(6)
    expect(params.styleKey).toBe('photo')
    expect(params.imageSearchQuery).toBe('house fly insect')
    expect(params.page).toBe(1)
    expect(params.variant).toBe('abc')
    expect(params.mediaType).toBe('static')
  })
})

describe('scoreAndMergePixabayHits', () => {
  it('dedupes by URL and sorts by relevance', () => {
    const merged = scoreAndMergePixabayHits(
      'fly',
      [
        {
          id: 1,
          tags: 'airplane airport travel',
          previewURL: 'https://cdn.example/thumb-a.jpg',
          largeImageURL: 'https://cdn.example/full-a.jpg',
          user: 'Alice',
        },
        {
          id: 2,
          tags: 'house fly insect macro',
          previewURL: 'https://cdn.example/thumb-b.jpg',
          largeImageURL: 'https://cdn.example/full-b.jpg',
          user: 'Bob',
        },
        {
          id: 3,
          tags: 'duplicate',
          previewURL: 'https://cdn.example/thumb-a2.jpg',
          largeImageURL: 'https://cdn.example/full-a.jpg',
          user: 'Alice',
        },
      ],
      'photo',
    )
    expect(merged).toHaveLength(2)
    expect(merged[0]?.id).toBe('2')
    expect(merged[0]?.score).toBeGreaterThan(merged[1]?.score ?? 0)
  })
})

describe('searchBoardStaticImages', () => {
  const baseParams = {
    q: 'fly',
    limit: 12,
    mediaType: 'static' as const,
    styleKey: 'photo' as const,
    page: 0,
    variant: '0',
  }

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns no_key when Pixabay key is missing', async () => {
    const res = await searchBoardStaticImages(baseParams, undefined)
    expect(res.results).toEqual([])
    expect(res.fallback).toBe('no_key')
  })

  it('maps Pixabay hits into scored board results', async () => {
    const fetchMock = vi.mocked(fetch)
    const pixabayPayload = {
      hits: [
        {
          id: 101,
          tags: 'fly insect nature',
          previewURL: 'https://pixabay.com/thumb-101.jpg',
          largeImageURL: 'https://pixabay.com/large-101.jpg',
          user: 'TeacherPix',
        },
        {
          id: 102,
          tags: 'airplane aviation',
          previewURL: 'https://pixabay.com/thumb-102.jpg',
          largeImageURL: 'https://pixabay.com/large-102.jpg',
          user: 'SkyCam',
        },
      ],
    }
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => pixabayPayload,
    } as Response)

    const res = await searchBoardStaticImages(baseParams, 'test-key')
    expect(res.fallback).toBeUndefined()
    expect(res.results.length).toBeGreaterThanOrEqual(1)
    expect(res.results[0]).toMatchObject({
      id: '101',
      thumbUrl: 'https://pixabay.com/thumb-101.jpg',
      fullUrl: 'https://pixabay.com/large-101.jpg',
      source: 'pixabay',
      attribution: 'Photo by TeacherPix on Pixabay',
    })
    expect(fetchMock).toHaveBeenCalled()
    const calledUrl = String(fetchMock.mock.calls[0]?.[0] ?? '')
    expect(calledUrl).toContain('pixabay.com/api/')
    expect(calledUrl).toContain('safesearch=true')
  })

  it('returns no_results when Pixabay responds empty', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ hits: [] }),
    } as Response)

    const res = await searchBoardStaticImages(baseParams, 'test-key')
    expect(res.results).toEqual([])
    expect(res.fallback).toBe('no_results')
  })
})

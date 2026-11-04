import { describe, expect, it } from 'vitest'
import type { PixabayHit } from '@/lib/quiz-image-pixabay'
import { buildVaultSearchSteps, searchVaultPictures } from './picture-search'

const hit = (id: number, tags: string): PixabayHit => ({
  id,
  tags,
  previewURL: `https://cdn.example/${id}_150.png`,
  largeImageURL: `https://cdn.example/${id}_1280.png`,
})

describe('vault picture search', () => {
  it('keeps queries short and drops photo / style words from the phrase', () => {
    expect(buildVaultSearchSteps('World', 'world globe map earth simple stock photo')).toEqual([
      { query: 'globe map world cartoon', imageType: 'illustration' },
      { query: 'world cartoon', imageType: 'illustration' },
      { query: 'world', imageType: 'illustration' },
      { query: 'globe map world', imageType: 'all' },
      { query: 'world', imageType: 'all' },
    ])
    expect(buildVaultSearchSteps('apple', 'apple')).toEqual([
      { query: 'apple cartoon', imageType: 'illustration' },
      { query: 'apple', imageType: 'illustration' },
      { query: 'apple', imageType: 'all' },
    ])
    expect(buildVaultSearchSteps('  ', 'x')).toEqual([])
  })

  it('falls through empty steps and stops once illustrations are found', async () => {
    const asked: string[] = []
    const res = await searchVaultPictures('world', 'earth globe', 5, async (query, type) => {
      asked.push(`${query}|${type}`)
      if (query === 'world cartoon') return [hit(1, 'world, globe, cartoon'), hit(2, 'flower, garden')]
      return []
    })
    expect(res.results.map((r) => r.id)).toEqual(['1'])
    expect(res.fallback).toBeUndefined()
    expect(asked).toEqual(['earth globe world cartoon|illustration', 'world cartoon|illustration', 'world|illustration'])
  })

  it('reports no_results with every query tried', async () => {
    const res = await searchVaultPictures('world', '', 5, async () => [])
    expect(res.fallback).toBe('no_results')
    expect(res.tried).toHaveLength(3)
  })
})

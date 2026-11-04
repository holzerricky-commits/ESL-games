import type { BoardImageSearchResult } from '@/lib/board-image-search'
import { pixabayAttribution, scoreAndMergePixabayHits, type PixabayHit } from '@/lib/quiz-image-pixabay'
import { STATIC_IMAGE_MIN_ACCEPT_SCORE } from '@/lib/quiz-image-relevance'

export type VaultSearchStep = { query: string; imageType: 'illustration' | 'all' }

export type VaultPictureSearchResponse = {
  results: BoardImageSearchResult[]
  fallback?: 'no_key' | 'empty_query' | 'no_results'
  /** Queries tried, in order (for the dev log). */
  tried: string[]
}

/** Style / stock words that only narrow Pixabay's all-words match. */
const NOISE = new Set(
  `a an the of on in at with and or for to cartoon cartoons clipart clip art illustration illustrated drawing
  vector icon picture image photo photos stock isolated white background plain clean simple simply centered
  single subject studio colorful colourful cute child children kids friendly style flat 2d`
    .split(/\s+/)
    .filter(Boolean),
)

function words(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2)
}

/**
 * Short queries first (Pixabay needs every word to match): word + up to 2 meaning words + cartoon,
 * then the word as a cartoon, then any illustration, then any picture.
 */
export function buildVaultSearchSteps(word: string, phrase: string): VaultSearchStep[] {
  const w = words(word).join(' ')
  if (!w) return []
  const own = new Set(w.split(' '))
  const extra = [...new Set(words(phrase))].filter((t) => !NOISE.has(t) && !own.has(t)).slice(0, 2)
  const steps: VaultSearchStep[] = []
  const push = (query: string, imageType: VaultSearchStep['imageType']) => {
    if (!steps.some((s) => s.query === query && s.imageType === imageType)) steps.push({ query, imageType })
  }
  if (extra.length > 0) push(`${[...extra, w].join(' ')} cartoon`, 'illustration')
  push(`${w} cartoon`, 'illustration')
  push(w, 'illustration')
  if (extra.length > 0) push(`${[...extra, w].join(' ')}`, 'all')
  push(w, 'all')
  return steps
}

/**
 * Walks the steps until `limit` hits pass the relevance bar; earlier (more cartoon) steps rank first.
 * Any-picture steps only run when no illustration was found, so choices keep one look.
 */
export async function searchVaultPictures(
  word: string,
  phrase: string,
  limit: number,
  fetchHits: (query: string, imageType: VaultSearchStep['imageType']) => Promise<PixabayHit[]>,
): Promise<VaultPictureSearchResponse> {
  const steps = buildVaultSearchSteps(word, phrase)
  if (steps.length === 0) return { results: [], fallback: 'empty_query', tried: [] }
  const scoreWord = words(word).join(' ')
  const results: BoardImageSearchResult[] = []
  const seen = new Set<string>()
  const tried: string[] = []
  for (const step of steps) {
    if (step.imageType === 'all' && results.length > 0) break
    tried.push(`${step.query} (${step.imageType})`)
    const hits = await fetchHits(step.query, step.imageType).catch(() => [] as PixabayHit[])
    for (const hit of scoreAndMergePixabayHits(scoreWord, hits, 'flat2d')) {
      if (hit.score < STATIC_IMAGE_MIN_ACCEPT_SCORE || seen.has(hit.id)) continue
      seen.add(hit.id)
      results.push({
        id: hit.id,
        thumbUrl: hit.thumbUrl,
        fullUrl: hit.fullUrl,
        source: 'pixabay',
        attribution: pixabayAttribution(hit.user),
      })
      if (results.length >= limit) return { results, tried }
    }
  }
  return results.length > 0 ? { results, tried } : { results, fallback: 'no_results', tried }
}

import { buildStaticSearchQuery } from '@/lib/quiz-image-queries'
import {
  fetchPixabayHits,
  pixabayAttribution,
  scoreAndMergePixabayHits,
  variantHash,
} from '@/lib/quiz-image-pixabay'
import {
  applyStyleToStaticBaseQuery,
  buildStaticFallbackQueries,
  getPixabayImageType,
  parseImageStyleParam,
  styleMinScoreForRetry,
  type ImageStyleKey,
} from '@/lib/quiz-image-style'

export type BoardImageSearchResult = {
  id: string
  thumbUrl: string
  fullUrl: string
  source: 'pixabay' | 'giphy'
  attribution?: string
}

export type BoardImageSearchFallback =
  | 'no_key'
  | 'empty_query'
  | 'unsupported_type'
  | 'no_results'

export type BoardImageSearchResponse = {
  results: BoardImageSearchResult[]
  fallback?: BoardImageSearchFallback
}

export type BoardImageSearchParams = {
  q: string
  limit: number
  mediaType: 'static' | 'gif'
  styleKey: ImageStyleKey
  imageSearchQuery?: string
  /** 0-based page for pagination / refresh. */
  page: number
  variant: string
}

const DEFAULT_LIMIT = 12
const MAX_LIMIT = 24

export function parseBoardImageSearchLimit(raw: string | null | undefined): number {
  if (raw == null || raw.trim() === '') return DEFAULT_LIMIT
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n)) return DEFAULT_LIMIT
  return Math.min(MAX_LIMIT, Math.max(1, n))
}

export function parseBoardImageSearchPage(raw: string | null | undefined): number {
  if (raw == null || raw.trim() === '') return 0
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.min(50, n)
}

export function parseBoardImageSearchParams(
  searchParams: URLSearchParams,
): BoardImageSearchParams | 'empty' {
  const rawQ = searchParams.get('q')?.trim() ?? ''
  if (!rawQ) return 'empty'

  const typeParam = searchParams.get('type')?.trim().toLowerCase()
  const mediaType: 'static' | 'gif' = typeParam === 'gif' ? 'gif' : 'static'

  const styleRaw = searchParams.get('style') ?? searchParams.get('st')
  const sqRaw = searchParams.get('sq')?.trim() ?? ''
  const imageSearchQuery = sqRaw.slice(0, 240) || undefined

  return {
    q: rawQ.slice(0, 120),
    limit: parseBoardImageSearchLimit(searchParams.get('limit')),
    mediaType,
    styleKey: parseImageStyleParam(styleRaw),
    imageSearchQuery,
    page: parseBoardImageSearchPage(searchParams.get('page')),
    variant: (searchParams.get('v') || '0').slice(0, 64),
  }
}

function toBoardResults(scored: ReturnType<typeof scoreAndMergePixabayHits>, limit: number): BoardImageSearchResult[] {
  return scored.slice(0, limit).map((hit) => ({
    id: hit.id,
    thumbUrl: hit.thumbUrl,
    fullUrl: hit.fullUrl,
    source: 'pixabay' as const,
    attribution: pixabayAttribution(hit.user),
  }))
}

/**
 * Multi-result static image search for the lesson board picker (Phase 1).
 * Requires `PIXABAY_API_KEY`; returns an empty list with `fallback: 'no_key'` otherwise.
 */
export async function searchBoardStaticImages(
  params: BoardImageSearchParams,
  pixabayApiKey: string | undefined,
): Promise<BoardImageSearchResponse> {
  const key = pixabayApiKey?.trim()
  if (!key) {
    return { results: [], fallback: 'no_key' }
  }

  const { q, limit, styleKey, imageSearchQuery, page, variant } = params
  const queryOpts = imageSearchQuery ? { imageSearchQuery } : undefined
  const baseStatic = buildStaticSearchQuery(q, queryOpts)
  const pxImageType = getPixabayImageType(styleKey)
  const scoreFloor = styleMinScoreForRetry(styleKey)
  const maxPxVariants = scoreFloor == null ? 1 : 2

  const perPage = Math.min(200, Math.max(limit * 2, 24))
  const pixabayPage = page + 1 + (variantHash(`${variant}\0${page}`) % 3)

  const merged = new Map<string, ReturnType<typeof scoreAndMergePixabayHits>[number]>()

  const absorb = (batch: ReturnType<typeof scoreAndMergePixabayHits>) => {
    for (const hit of batch) {
      const existing = merged.get(hit.id)
      if (!existing || hit.score > existing.score) {
        merged.set(hit.id, hit)
      }
    }
  }

  try {
    for (let qv = 0; qv < maxPxVariants; qv += 1) {
      const searchQuery = applyStyleToStaticBaseQuery(baseStatic, styleKey, variant, qv)
      const hits = await fetchPixabayHits(key, searchQuery, {
        imageType: pxImageType,
        perPage,
        page: pixabayPage + qv,
      })
      absorb(scoreAndMergePixabayHits(q, hits, styleKey))

      if (merged.size >= limit) break
      if (scoreFloor == null) break
      const best = [...merged.values()].sort((a, b) => b.score - a.score)[0]
      if (best && best.score >= scoreFloor) break
    }

    if (merged.size < limit) {
      const fallbacks = buildStaticFallbackQueries(q, baseStatic)
      for (const fq of fallbacks) {
        const hits = await fetchPixabayHits(key, fq, {
          imageType: 'all',
          perPage,
          page: pixabayPage,
        })
        absorb(scoreAndMergePixabayHits(q, hits, styleKey))
        if (merged.size >= limit) break
      }
    }
  } catch {
    return { results: [], fallback: 'no_results' }
  }

  const sorted = [...merged.values()].sort((a, b) => b.score - a.score)
  const results = toBoardResults(sorted, limit)
  if (results.length === 0) {
    return { results: [], fallback: 'no_results' }
  }
  return { results }
}

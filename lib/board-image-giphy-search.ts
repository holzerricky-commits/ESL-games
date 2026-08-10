import { buildGifSearchQuery } from '@/lib/quiz-image-queries'
import { variantHash } from '@/lib/quiz-image-pixabay'
import { scoreGifMetadata } from '@/lib/quiz-image-relevance'
import {
  applyStyleToGifSearchString,
  type ImageStyleKey,
} from '@/lib/quiz-image-style'
import type { BoardImageSearchResponse } from '@/lib/board-image-search'

const GIPHY_FETCH_TIMEOUT_MS = 15_000
const GIF_SCORE_HARD_REJECT = -18

type GiphyImageSet = {
  fixed_height?: { url?: string }
  fixed_width?: { url?: string }
  downsized_medium?: { url?: string }
  downsized?: { url?: string }
  original?: { url?: string }
  preview_gif?: { url?: string }
}

type GiphyGifItem = {
  id?: string
  title?: string
  slug?: string
  username?: string
  alt_text?: string
  images?: GiphyImageSet
}

export type BoardGifSearchParams = {
  q: string
  limit: number
  styleKey: ImageStyleKey
  imageSearchQuery?: string
  page: number
  variant: string
}

function minimumGifScoreFor(word: string): number {
  const w = word.toLowerCase().trim()
  const actionWords = new Set([
    'jump',
    'run',
    'walk',
    'fly',
    'swim',
    'dance',
    'clap',
    'wave',
    'sit',
    'stand',
    'eat',
    'drink',
    'sleep',
    'laugh',
    'cry',
  ])
  return actionWords.has(w) ? 4 : 6
}

function pickGifUrlFromItem(item: GiphyGifItem): string | null {
  const im = item.images
  if (!im) return null
  return (
    im.fixed_height?.url ||
    im.fixed_width?.url ||
    im.downsized_medium?.url ||
    im.downsized?.url ||
    im.original?.url ||
    im.preview_gif?.url ||
    null
  )
}

function pickGifThumbUrlFromItem(item: GiphyGifItem): string | null {
  const im = item.images
  if (!im) return null
  return (
    im.fixed_height?.url ||
    im.downsized?.url ||
    im.preview_gif?.url ||
    im.downsized_medium?.url ||
    pickGifUrlFromItem(item)
  )
}

async function fetchWithRetry(url: string): Promise<Response | null> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(GIPHY_FETCH_TIMEOUT_MS),
      })
      if (res.ok) return res
      if ((res.status === 429 || res.status === 503) && attempt === 0) {
        await new Promise((r) => setTimeout(r, 400))
        continue
      }
      return res
    } catch {
      if (attempt === 0) await new Promise((r) => setTimeout(r, 400))
    }
  }
  return null
}

function buildGifSearchTiers(
  rawWord: string,
  imageSearchQuery: string | null | undefined,
  styleKey: ImageStyleKey,
  variant: string,
): string[] {
  const q = rawWord.toLowerCase().trim().slice(0, 100)
  const opts = imageSearchQuery?.trim() ? { imageSearchQuery } : undefined
  const tier1Base = buildGifSearchQuery(rawWord, opts)
  const tier1 = applyStyleToGifSearchString(tier1Base, styleKey, variant, 0)
  const tier2Base = q.length > 0 ? q : 'nature'
  const tier2 = applyStyleToGifSearchString(tier2Base, styleKey, variant, 1)
  const tier3Base =
    variantHash(`${rawWord}\0gif-tier3\0${styleKey}`) % 2 === 0 ? `${tier2Base} loop` : `${tier2Base} nature`
  const tier3 = applyStyleToGifSearchString(tier3Base, styleKey, variant, 2)
  const tiers: string[] = [tier1]
  if (tier2 !== tier1) tiers.push(tier2)
  if (tier3 !== tier2 && tier3 !== tier1) tiers.push(tier3)
  return tiers
}

async function fetchGiphySearch(
  apiKey: string,
  searchQuery: string,
  offset: number,
): Promise<GiphyGifItem[]> {
  const url =
    `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(apiKey)}` +
    `&q=${encodeURIComponent(searchQuery)}&limit=25&offset=${offset}&rating=g&lang=en`
  const res = await fetchWithRetry(url)
  if (!res?.ok) return []
  const data = (await res.json()) as { data?: GiphyGifItem[] }
  return data?.data ?? []
}

function giphyItemId(item: GiphyGifItem, fullUrl: string): string {
  if (item.id) return `giphy-${item.id}`
  if (item.slug) return `giphy-${item.slug}`
  return `giphy-${variantHash(fullUrl)}`
}

function scoreGiphyItem(q: string, item: GiphyGifItem, styleKey: ImageStyleKey): number {
  return scoreGifMetadata(q, item, styleKey)
}

/**
 * Multi-result GIPHY search for the lesson board picker (Phase 5).
 */
export async function searchBoardGifImages(
  params: BoardGifSearchParams,
  giphyApiKey: string | undefined,
): Promise<BoardImageSearchResponse> {
  const key = giphyApiKey?.trim()
  if (!key) {
    return { results: [], fallback: 'no_key' }
  }

  const { q, limit, styleKey, imageSearchQuery, page, variant } = params
  const minScore = minimumGifScoreFor(q)
  const merged = new Map<string, { score: number; item: GiphyGifItem; fullUrl: string; thumbUrl: string }>()

  try {
    const tiers = buildGifSearchTiers(q, imageSearchQuery, styleKey, variant)
    for (const tier of tiers) {
      const offset =
        page * 25 + (variantHash(`${tier}\0${variant}\0${styleKey}\0${page}`) % 15)
      const items = await fetchGiphySearch(key, tier, offset)
      for (const item of items) {
        const fullUrl = pickGifUrlFromItem(item)
        const thumbUrl = pickGifThumbUrlFromItem(item)
        if (!fullUrl || !thumbUrl) continue
        const score = scoreGiphyItem(q, item, styleKey)
        if (score <= GIF_SCORE_HARD_REJECT) continue
        const id = giphyItemId(item, fullUrl)
        const existing = merged.get(id)
        if (!existing || score > existing.score) {
          merged.set(id, { score, item, fullUrl, thumbUrl })
        }
      }
      if (merged.size >= limit) break
    }
  } catch {
    return { results: [], fallback: 'no_results' }
  }

  const sorted = [...merged.values()]
    .filter((row) => row.score >= minScore || row.score > GIF_SCORE_HARD_REJECT)
    .sort((a, b) => b.score - a.score)

  const pool = sorted.length > 0 ? sorted : [...merged.values()].sort((a, b) => b.score - a.score)

  const results = pool.slice(0, limit).map((row) => ({
    id: giphyItemId(row.item, row.fullUrl),
    thumbUrl: row.thumbUrl,
    fullUrl: row.fullUrl,
    source: 'giphy' as const,
    attribution: row.item.username ? `GIF by ${row.item.username} on GIPHY` : 'GIF from GIPHY',
  }))

  if (results.length === 0) {
    return { results: [], fallback: 'no_results' }
  }
  return { results }
}

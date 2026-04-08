import { NextRequest, NextResponse } from 'next/server'
import { buildGifSearchQuery, buildStaticSearchQuery } from '@/lib/quiz-image-queries'
import {
  applyStyleToGifSearchString,
  applyStyleToStaticBaseQuery,
  buildStaticFallbackQueries,
  getPixabayImageType,
  parseImageStyleParam,
  styleMinScoreForRetry,
  type ImageStyleKey,
} from '@/lib/quiz-image-style'
import { scoreGifMetadata, scoreTextRelevance } from '@/lib/quiz-image-relevance'

const IMAGE_CACHE_TTL_MS = 30 * 60_000
const IMAGE_CACHE_MAX_ENTRIES = 300
const imageUrlCache = new Map<string, { expires: number; url: string }>()

/** Stable hash for lock/page offsets from variant string. */
function variantHash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i += 1) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function buildImageCacheKey(
  query: string,
  mediaType: 'static' | 'gif',
  variant: string,
  searchQueryExtra: string,
  styleKey: ImageStyleKey,
  prevComparable: string
): string {
  const sq = searchQueryExtra.trim().toLowerCase().slice(0, 120)
  const sqPart = sq ? `|${variantHash(sq)}` : ''
  const v = variant.trim().slice(0, 64)
  const pPart = prevComparable ? `|p${variantHash(prevComparable)}` : ''
  return `${mediaType}|${query.toLowerCase().trim()}|${v}${sqPart}|${styleKey}${pPart}`
}

/** Compare final image URLs (strip query) so we can skip the previous hit when style changes. */
function normalizeComparableImageUrl(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  if (t.startsWith('data:')) return t.slice(0, 240)
  try {
    const u = new URL(t)
    return `${u.hostname.toLowerCase()}${(u.pathname || '/').replace(/\/$/, '') || '/'}`
  } catch {
    return t.toLowerCase().slice(0, 320)
  }
}

type ScoredUrl = { url: string; score: number }

function mergeScoredCandidate(map: Map<string, ScoredUrl>, url: string, score: number): void {
  const k = normalizeComparableImageUrl(url)
  if (!k) return
  const ex = map.get(k)
  if (!ex || score > ex.score) map.set(k, { url, score })
}

function pickBestExcluding(map: Map<string, ScoredUrl>, prevNorm: string | null): ScoredUrl | null {
  const arr = [...map.values()].sort((a, b) => b.score - a.score)
  if (arr.length === 0) return null
  if (!prevNorm) return arr[0]
  const alt = arr.find((x) => normalizeComparableImageUrl(x.url) !== prevNorm)
  return alt ?? arr[0]
}

/** Reuse a recent static hit for the same word + style (e.g. after API hiccup). */
function tryStaleStaticCache(
  q: string,
  styleKey: ImageStyleKey,
  prevNorm: string | null
): NextResponse | null {
  const staleStaticKeyPrefix = `static|${q.toLowerCase().trim()}|${styleKey}|`
  for (const [k, hit] of imageUrlCache) {
    if (k.startsWith(staleStaticKeyPrefix) && hit.url) {
      const hn = normalizeComparableImageUrl(hit.url)
      if (prevNorm && hn === prevNorm) continue
      return NextResponse.redirect(hit.url, 302)
    }
  }
  return null
}

function getCachedImageUrl(cacheKey: string): string | null {
  const hit = imageUrlCache.get(cacheKey)
  if (!hit) return null
  if (hit.expires <= Date.now()) {
    imageUrlCache.delete(cacheKey)
    return null
  }
  return hit.url
}

function cacheImageUrl(cacheKey: string, url: string): void {
  imageUrlCache.set(cacheKey, { expires: Date.now() + IMAGE_CACHE_TTL_MS, url })
  if (imageUrlCache.size <= IMAGE_CACHE_MAX_ENTRIES) return
  for (const [k, v] of imageUrlCache) {
    if (v.expires <= Date.now()) imageUrlCache.delete(k)
  }
  while (imageUrlCache.size > IMAGE_CACHE_MAX_ENTRIES) {
    const oldest = imageUrlCache.keys().next().value
    if (!oldest) break
    imageUrlCache.delete(oldest)
  }
}

/** LoremFlickr tags from the vocabulary word (max a few tags). */
function flickrTagParts(query: string): string[] {
  const parts = query
    .toLowerCase()
    .trim()
    .split(/[\s,]+/)
    .map((s) => s.replace(/[^a-z0-9-]/g, ''))
    .filter((s) => s.length >= 1)
    .slice(0, 4)
  return parts.length > 0 ? parts : ['nature']
}

function flickrTagsForStyle(styleKey: ImageStyleKey, wordTags: string[]): string {
  const extra =
    styleKey === 'flat2d'
      ? 'cartoon'
      : styleKey === 'render3d'
        ? 'computer'
        : styleKey === 'photo'
          ? null
          : null
  let tags = [...wordTags]
  if (extra && !tags.includes(extra)) {
    if (tags.length >= 4) tags = tags.slice(0, 3)
    tags.push(extra)
  }
  return tags.join(',')
}

function loremFlickrRedirect(query: string, variant: string, styleKey: ImageStyleKey): NextResponse {
  const tags = flickrTagsForStyle(styleKey, flickrTagParts(query))
  const lock = variantHash(`${variant}\0${styleKey}`) % 10_000
  const url = `https://loremflickr.com/g/800/500/${tags}?lock=${lock}`
  return NextResponse.redirect(url, 302)
}

function noGifFoundSvgMarkup(word: string): string {
  const safeWord = word.replace(/</g, '&lt;').replace(/>/g, '&gt;').slice(0, 40)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
<rect width="800" height="500" fill="#0f172a"/>
<rect x="20" y="20" width="760" height="460" rx="20" fill="#111827" stroke="#334155"/>
<text x="400" y="210" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" fill="#e2e8f0">No classroom-safe GIF found</text>
<text x="400" y="260" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" fill="#93c5fd">${safeWord}</text>
<text x="400" y="305" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#94a3b8">Use Static Picture for this word</text>
</svg>`
}

function noStaticFoundSvgMarkup(word: string): string {
  const safeWord = word.replace(/</g, '&lt;').replace(/>/g, '&gt;').slice(0, 40)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
<rect width="800" height="500" fill="#0b1220"/>
<rect x="20" y="20" width="760" height="460" rx="20" fill="#0f172a" stroke="#334155"/>
<text x="400" y="210" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" fill="#e2e8f0">No relevant static image found</text>
<text x="400" y="260" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" fill="#93c5fd">${safeWord}</text>
<text x="400" y="305" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#94a3b8">Try another image or adjust wording</text>
</svg>`
}

function svgResponse(svgMarkup: string): NextResponse {
  return new NextResponse(svgMarkup, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

function classifyWord(word: string): 'object' | 'action' {
  const actions = new Set(['run', 'walk', 'jump', 'swim', 'eat', 'drink', 'sleep', 'read', 'write', 'dance', 'sing', 'play'])
  return actions.has(word.toLowerCase()) ? 'action' : 'object'
}

/** Minimum score for strict pick; higher for objects when we have more candidates from multi-fetch. */
function minimumGifScoreFor(word: string): number {
  return classifyWord(word) === 'action' ? 4 : 6
}

/** Reject only clearly bad results (heavy meme/celebrity signals). */
const GIF_SCORE_HARD_REJECT = -18

const GIPHY_FETCH_TIMEOUT_MS = 15_000
const STATIC_FETCH_TIMEOUT_MS = 15_000

type GiphyImageSet = {
  fixed_height?: { url?: string }
  fixed_width?: { url?: string }
  downsized_medium?: { url?: string }
  downsized?: { url?: string }
  original?: { url?: string }
  preview_gif?: { url?: string }
}

type GiphyGifItem = {
  title?: string
  slug?: string
  username?: string
  alt_text?: string
  images?: GiphyImageSet
}

/** Prefer display-sized GIF URLs; fall back across GIPHY rendition fields. */
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

/** Tier 1: descriptive query; tier 2: word-only; tier 3: literal-friendly (no "cute" — avoids people/memes). */
function buildGifSearchTiers(
  rawWord: string,
  imageSearchQuery: string | null | undefined,
  styleKey: ImageStyleKey,
  variant: string
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
  offset: number
): Promise<GiphyGifItem[]> {
  const url =
    `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(apiKey)}` +
    `&q=${encodeURIComponent(searchQuery)}&limit=25&offset=${offset}&rating=g&lang=en`
  const res = await fetchWithRetry(url)
  if (!res?.ok) return []
  const data = (await res.json()) as { data?: GiphyGifItem[] }
  return data?.data ?? []
}

/** If best score in first page is weak, fetch another page for better literal matches (user accepts latency). */
async function fetchGiphyTierWithOptionalSecondPage(
  apiKey: string,
  searchQuery: string,
  vocabWord: string,
  v: string,
  styleKey: ImageStyleKey
): Promise<GiphyGifItem[]> {
  const offset = variantHash(`${searchQuery}\0${v}\0${styleKey}`) % 15
  let items = await fetchGiphySearch(apiKey, searchQuery, offset)
  const withUrl = items.filter((it) => pickGifUrlFromItem(it))
  const maxScore =
    withUrl.length > 0
      ? Math.max(...withUrl.map((it) => scoreGifMetadata(vocabWord, it, styleKey)))
      : -Infinity
  if (maxScore < 5 && items.length > 0) {
    const more = await fetchGiphySearch(apiKey, searchQuery, offset + 25)
    const seen = new Set(items.map((i) => `${i.slug ?? ''}\0${i.title ?? ''}`))
    for (const m of more) {
      const k = `${m.slug ?? ''}\0${m.title ?? ''}`
      if (!seen.has(k)) {
        items.push(m)
        seen.add(k)
      }
    }
  }
  return items
}

function selectBestGifUrl(
  vocabWord: string,
  items: GiphyGifItem[],
  styleKey: ImageStyleKey,
  prevNorm: string | null
): string | null {
  const scored = items
    .map((item) => ({
      item,
      score: scoreGifMetadata(vocabWord, item, styleKey),
      url: pickGifUrlFromItem(item),
    }))
    .filter((x): x is { item: GiphyGifItem; score: number; url: string } => Boolean(x.url))

  if (scored.length === 0) return null

  const minStrict = minimumGifScoreFor(vocabWord)
  const pickFirstExcluding = (arr: typeof scored): (typeof scored)[number] | undefined => {
    const sorted = [...arr].sort((a, b) => b.score - a.score)
    if (!prevNorm) return sorted[0]
    return sorted.find((x) => normalizeComparableImageUrl(x.url) !== prevNorm) ?? sorted[0]
  }

  const strictPool = scored.filter((x) => x.score >= minStrict)
  const softPool = scored.filter((x) => x.score > GIF_SCORE_HARD_REJECT)

  const strictBest = pickFirstExcluding(strictPool)
  const softBest = pickFirstExcluding(softPool)
  const anyBest = pickFirstExcluding(scored)

  const chosen = strictBest ?? softBest ?? anyBest
  return chosen?.url ?? null
}

/**
 * Keyword-relevant quiz media:
 * - type=static: Pixabay when `PIXABAY_API_KEY` is set; otherwise stale cache, then LoremFlickr.
 * - type=gif: GIPHY search when `GIPHY_API_KEY` is set, otherwise SVG placeholder.
 *
 * Query: q = vocabulary term, v = variant id (new seed per "Try another image"), type=static|gif.
 */
export async function GET(req: NextRequest) {
  const rawQ = req.nextUrl.searchParams.get('q')?.trim() || 'nature'
  const q = rawQ.slice(0, 120)
  const v = (req.nextUrl.searchParams.get('v') || '0').slice(0, 64)
  const sqRaw = req.nextUrl.searchParams.get('sq')?.trim() ?? ''
  const imageSearchQuery = sqRaw.slice(0, 240) || undefined
  const styleRaw = req.nextUrl.searchParams.get('style') ?? req.nextUrl.searchParams.get('st')
  const styleKey = parseImageStyleParam(styleRaw)
  const typeParam = req.nextUrl.searchParams.get('type')
  const mediaType: 'static' | 'gif' = typeParam === 'gif' ? 'gif' : 'static'
  const prevRaw = req.nextUrl.searchParams.get('prev')?.trim().slice(0, 800) ?? ''
  const prevNorm = prevRaw ? normalizeComparableImageUrl(prevRaw) : null

  const giphyApiKey = process.env.GIPHY_API_KEY?.trim()
  const pixabayApiKey = process.env.PIXABAY_API_KEY?.trim()
  const queryOpts = imageSearchQuery ? { imageSearchQuery } : undefined
  const cacheKey = buildImageCacheKey(q, mediaType, v, imageSearchQuery ?? '', styleKey, prevNorm ?? '')
  const cached = getCachedImageUrl(cacheKey)
  if (cached) {
    return NextResponse.redirect(cached, 302)
  }

  if (mediaType === 'gif') {
    if (giphyApiKey) {
      try {
        const tiers = buildGifSearchTiers(q, imageSearchQuery, styleKey, v)
        for (const searchQuery of tiers) {
          const items = await fetchGiphyTierWithOptionalSecondPage(
            giphyApiKey,
            searchQuery,
            q,
            v,
            styleKey
          )
          const withUrl = items.filter((it) => pickGifUrlFromItem(it))
          if (withUrl.length === 0) {
            console.warn(
              `[quiz-image] GIPHY empty for tier "${searchQuery.slice(0, 80)}"; trying next`
            )
            continue
          }
          const gifUrl = selectBestGifUrl(q, withUrl, styleKey, prevNorm)
          if (gifUrl) {
            cacheImageUrl(cacheKey, gifUrl)
            return NextResponse.redirect(gifUrl, 302)
          }
        }
      } catch {
        /* fall through to fallback */
      }
    }
    return svgResponse(noGifFoundSvgMarkup(q))
  }

  if (pixabayApiKey) {
    try {
      const baseStatic = buildStaticSearchQuery(q, queryOpts)
      const pxImageType = getPixabayImageType(styleKey)
      const scoreFloor = styleMinScoreForRetry(styleKey)
      const maxPxVariants = scoreFloor == null ? 1 : 2
      const pxCandidates = new Map<string, ScoredUrl>()

      for (let qv = 0; qv < maxPxVariants; qv += 1) {
        const searchQuery = applyStyleToStaticBaseQuery(baseStatic, styleKey, v, qv)
        const pixabayUrl =
          `https://pixabay.com/api/?key=${encodeURIComponent(pixabayApiKey)}` +
          `&q=${encodeURIComponent(searchQuery)}` +
          `&image_type=${encodeURIComponent(pxImageType)}&safesearch=true&orientation=horizontal&per_page=18`
        const pxRes = await fetch(pixabayUrl, {
          signal: AbortSignal.timeout(STATIC_FETCH_TIMEOUT_MS),
        })
        if (!pxRes.ok) continue
        const pxData = (await pxRes.json()) as {
          hits?: Array<{ tags?: string; largeImageURL?: string; webformatURL?: string }>
        }
        let bestPx: { url: string; score: number } | null = null
        for (const hit of pxData?.hits ?? []) {
          const pxImageUrl = hit.largeImageURL || hit.webformatURL
          if (!pxImageUrl) continue
          const s = scoreTextRelevance(q, hit.tags ?? '', styleKey)
          mergeScoredCandidate(pxCandidates, pxImageUrl, s)
          if (!bestPx || s > bestPx.score) bestPx = { url: pxImageUrl, score: s }
        }
        if (scoreFloor == null) break
        if (bestPx && bestPx.score >= scoreFloor) break
      }
      if (pxCandidates.size === 0) {
        const fallbacks = buildStaticFallbackQueries(q, baseStatic)
        for (const fq of fallbacks) {
          const pixabayUrl =
            `https://pixabay.com/api/?key=${encodeURIComponent(pixabayApiKey)}` +
            `&q=${encodeURIComponent(fq)}` +
            `&image_type=all&safesearch=true&orientation=horizontal&per_page=18`
          const pxRes = await fetch(pixabayUrl, {
            signal: AbortSignal.timeout(STATIC_FETCH_TIMEOUT_MS),
          })
          if (!pxRes.ok) continue
          const pxData = (await pxRes.json()) as {
            hits?: Array<{ tags?: string; largeImageURL?: string; webformatURL?: string }>
          }
          for (const hit of pxData?.hits ?? []) {
            const pxImageUrl = hit.largeImageURL || hit.webformatURL
            if (!pxImageUrl) continue
            const s = scoreTextRelevance(q, hit.tags ?? '', styleKey)
            mergeScoredCandidate(pxCandidates, pxImageUrl, s)
          }
          if (pxCandidates.size > 0) break
        }
      }
      const bestPxOverall = pickBestExcluding(pxCandidates, prevNorm)
      if (bestPxOverall) {
        cacheImageUrl(cacheKey, bestPxOverall.url)
        return NextResponse.redirect(bestPxOverall.url, 302)
      }
    } catch {
      /* fall through */
    }
    const staleHit = tryStaleStaticCache(q, styleKey, prevNorm)
    if (staleHit) return staleHit
    return svgResponse(noStaticFoundSvgMarkup(q))
  }

  const staleNoKey = tryStaleStaticCache(q, styleKey, prevNorm)
  if (staleNoKey) return staleNoKey
  return loremFlickrRedirect(q, v, styleKey)
}

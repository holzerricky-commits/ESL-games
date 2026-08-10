import { scoreTextRelevance } from '@/lib/quiz-image-relevance'
import type { ImageStyleKey } from '@/lib/quiz-image-style'

export const PIXABAY_FETCH_TIMEOUT_MS = 15_000

export type PixabayHit = {
  id: number
  tags?: string
  previewURL?: string
  webformatURL?: string
  largeImageURL?: string
  pageURL?: string
  user?: string
}

export type ScoredPixabayHit = {
  id: string
  score: number
  thumbUrl: string
  fullUrl: string
  pageUrl?: string
  user?: string
}

/** Stable hash for lock/page offsets from variant string. */
export function variantHash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i += 1) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

/** Compare final image URLs (strip query) for dedupe. */
export function normalizeComparableImageUrl(raw: string): string {
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

export async function fetchPixabayHits(
  apiKey: string,
  searchQuery: string,
  options: {
    imageType?: string
    perPage?: number
    /** Pixabay page index (1-based). */
    page?: number
    timeoutMs?: number
  } = {},
): Promise<PixabayHit[]> {
  const imageType = options.imageType ?? 'all'
  const perPage = Math.min(200, Math.max(3, options.perPage ?? 18))
  const page = Math.max(1, options.page ?? 1)
  const timeoutMs = options.timeoutMs ?? PIXABAY_FETCH_TIMEOUT_MS

  const pixabayUrl =
    `https://pixabay.com/api/?key=${encodeURIComponent(apiKey)}` +
    `&q=${encodeURIComponent(searchQuery)}` +
    `&image_type=${encodeURIComponent(imageType)}&safesearch=true&orientation=horizontal` +
    `&per_page=${perPage}&page=${page}`

  const pxRes = await fetch(pixabayUrl, {
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!pxRes.ok) return []

  const pxData = (await pxRes.json()) as { hits?: PixabayHit[] }
  return pxData?.hits ?? []
}

export function mapPixabayHitToScored(
  vocabWord: string,
  hit: PixabayHit,
  styleKey: ImageStyleKey,
): ScoredPixabayHit | null {
  const fullUrl = hit.largeImageURL || hit.webformatURL
  if (!fullUrl) return null
  const thumbUrl = hit.previewURL || hit.webformatURL || fullUrl
  const score = scoreTextRelevance(vocabWord, hit.tags ?? '', styleKey)
  return {
    id: String(hit.id),
    score,
    thumbUrl,
    fullUrl,
    pageUrl: hit.pageURL,
    user: hit.user,
  }
}

/** Score Pixabay hits and dedupe by comparable full URL, keeping the best score per asset. */
export function scoreAndMergePixabayHits(
  vocabWord: string,
  hits: PixabayHit[],
  styleKey: ImageStyleKey,
): ScoredPixabayHit[] {
  const byUrl = new Map<string, ScoredPixabayHit>()
  for (const hit of hits) {
    const scored = mapPixabayHitToScored(vocabWord, hit, styleKey)
    if (!scored) continue
    const key = normalizeComparableImageUrl(scored.fullUrl)
    if (!key) continue
    const existing = byUrl.get(key)
    if (!existing || scored.score > existing.score) {
      byUrl.set(key, scored)
    }
  }
  return [...byUrl.values()].sort((a, b) => b.score - a.score)
}

export function pixabayAttribution(user?: string): string | undefined {
  const name = user?.trim()
  if (!name) return 'Image from Pixabay'
  return `Photo by ${name} on Pixabay`
}

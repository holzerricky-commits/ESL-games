import type { ImageStyleKey } from '@/lib/quiz-image-style'
import type { BoardImageSearchResponse } from '@/lib/board-image-search'

export type BoardImageMediaType = 'static' | 'gif'

export const BOARD_IMAGE_SEARCH_STYLE_STORAGE_KEY = 'lesson-board:image-search-style-v1'
export const BOARD_IMAGE_SEARCH_MEDIA_STORAGE_KEY = 'lesson-board:image-search-media-v1'

export function readBoardImageSearchStyle(): ImageStyleKey {
  try {
    const stored = globalThis.sessionStorage?.getItem(BOARD_IMAGE_SEARCH_STYLE_STORAGE_KEY)
    if (stored === 'flat2d' || stored === 'render3d' || stored === 'photo') return stored
  } catch {
    /* ignore */
  }
  return 'photo'
}

export function writeBoardImageSearchStyle(style: ImageStyleKey): void {
  try {
    globalThis.sessionStorage?.setItem(BOARD_IMAGE_SEARCH_STYLE_STORAGE_KEY, style)
  } catch {
    /* ignore */
  }
}

export function readBoardImageSearchMediaType(): BoardImageMediaType {
  try {
    const stored = globalThis.sessionStorage?.getItem(BOARD_IMAGE_SEARCH_MEDIA_STORAGE_KEY)
    if (stored === 'gif') return 'gif'
  } catch {
    /* ignore */
  }
  return 'static'
}

export function writeBoardImageSearchMediaType(mediaType: BoardImageMediaType): void {
  try {
    globalThis.sessionStorage?.setItem(BOARD_IMAGE_SEARCH_MEDIA_STORAGE_KEY, mediaType)
  } catch {
    /* ignore */
  }
}

export async function fetchBoardImageSearch(params: {
  q: string
  limit?: number
  page?: number
  variant?: string
  style?: ImageStyleKey
  searchHint?: string
  mediaType?: BoardImageMediaType
}): Promise<BoardImageSearchResponse> {
  const trimmed = params.q.trim()
  if (!trimmed) return { results: [], fallback: 'empty_query' }

  const mediaType = params.mediaType ?? 'static'
  const searchParams = new URLSearchParams({
    q: trimmed,
    type: mediaType,
  })
  if (params.limit != null) searchParams.set('limit', String(params.limit))
  if (params.page != null) searchParams.set('page', String(params.page))
  if (params.variant) searchParams.set('v', String(params.variant))
  if (params.style && mediaType === 'static') searchParams.set('style', params.style)
  if (mediaType === 'gif' && params.style) searchParams.set('style', params.style)
  const hint = params.searchHint?.trim()
  if (hint) searchParams.set('sq', hint.slice(0, 240))

  try {
    const res = await fetch(`/api/board-image-search?${searchParams.toString()}`)
    if (!res.ok) return { results: [], fallback: 'no_results' }
    return (await res.json()) as BoardImageSearchResponse
  } catch {
    return { results: [], fallback: 'no_results' }
  }
}

export function boardImageSearchEmptyMessage(
  fallback?: BoardImageSearchResponse['fallback'],
  mediaType: BoardImageMediaType = 'static',
): string {
  if (fallback === 'no_key') {
    return mediaType === 'gif'
      ? 'GIF search needs a GIPHY API key in your environment settings.'
      : 'Picture search needs a Pixabay API key in your environment settings.'
  }
  if (fallback === 'empty_query') return 'Type a word to search.'
  if (fallback === 'unsupported_type') return 'That search type is not supported.'
  return mediaType === 'gif'
    ? 'No GIFs found — try another word.'
    : 'No pictures found — try another word.'
}

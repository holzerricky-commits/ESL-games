import { NextRequest, NextResponse } from 'next/server'
import { searchBoardGifImages } from '@/lib/board-image-giphy-search'
import { parseBoardImageSearchParams, searchBoardStaticImages } from '@/lib/board-image-search'

/**
 * Lesson board picture picker — multi-result search.
 *
 * Query: q (term), limit (1–24, default 12), type=static|gif, style, sq (hint), page, v (variant).
 * Static requires PIXABAY_API_KEY; GIF requires GIPHY_API_KEY.
 */
export async function GET(req: NextRequest) {
  const parsed = parseBoardImageSearchParams(req.nextUrl.searchParams)

  if (parsed === 'empty') {
    return NextResponse.json({ results: [], fallback: 'empty_query' })
  }

  const body =
    parsed.mediaType === 'gif'
      ? await searchBoardGifImages(parsed, process.env.GIPHY_API_KEY?.trim())
      : await searchBoardStaticImages(parsed, process.env.PIXABAY_API_KEY?.trim())

  return NextResponse.json(body, {
    headers: {
      'Cache-Control': 'private, max-age=60',
    },
  })
}

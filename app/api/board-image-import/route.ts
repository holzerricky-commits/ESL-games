import { NextRequest, NextResponse } from 'next/server'
import { fetchBoardImageBytes, parseBoardImageImportUrl } from '@/lib/board-image-import'

/**
 * Server-side fetch for lesson board image insert (avoids browser CORS on Pixabay/Giphy CDN URLs).
 *
 * Query: url — https image URL from an allowlisted host (Pixabay / Giphy).
 * Returns raw image bytes with Content-Type, or JSON error for invalid/blocked URLs.
 */
export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get('url') ?? ''
  const parsed = parseBoardImageImportUrl(rawUrl)

  if (!parsed.ok) {
    const status = parsed.reason === 'invalid' ? 400 : 403
    return NextResponse.json({ error: parsed.reason }, { status })
  }

  const fetched = await fetchBoardImageBytes(parsed.url)
  if (!fetched.ok) {
    const status =
      fetched.reason === 'too_large'
        ? 413
        : fetched.reason === 'invalid_type'
          ? 415
          : fetched.reason === 'empty'
            ? 422
            : 502
    return NextResponse.json({ error: fetched.reason }, { status })
  }

  return new NextResponse(fetched.bytes, {
    status: 200,
    headers: {
      'Content-Type': fetched.mimeType,
      'Cache-Control': 'private, no-store',
    },
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { loadBookLibrary } from '@/lib/books/server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const library = await loadBookLibrary()
    const syncCovers = request.nextUrl.searchParams.get('syncCovers') === '1'
    if (!syncCovers) {
      return NextResponse.json(library)
    }
    try {
      const { syncMissingBookCoversAndPersist } = await import('@/lib/books/book-cover-sync')
      const synced = await syncMissingBookCoversAndPersist(library)
      return NextResponse.json(synced)
    } catch (coverError) {
      console.warn('[api/books] Cover sync skipped; returning library without new covers.', coverError)
      return NextResponse.json(library)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load book library'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

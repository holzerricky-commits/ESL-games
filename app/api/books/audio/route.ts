import { NextResponse } from 'next/server'
import { deleteBookAudioTrack, listBookAudioTracks } from '@/lib/books/book-audio-server'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const bookId = url.searchParams.get('bookId')?.trim() ?? ''
    if (!bookId) {
      return NextResponse.json({ ok: false, error: 'bookId is required.' }, { status: 400 })
    }
    const items = await listBookAudioTracks(bookId)
    if (items == null) {
      return NextResponse.json({ ok: false, error: 'Book not found.' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, items })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to load audio tracks.' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url)
    const bookId = url.searchParams.get('bookId')?.trim() ?? ''
    const trackId = url.searchParams.get('trackId')?.trim() ?? ''
    if (!bookId || !trackId) {
      return NextResponse.json({ ok: false, error: 'bookId and trackId are required.' }, { status: 400 })
    }
    const result = await deleteBookAudioTrack(bookId, trackId)
    if ('error' in result) {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.status })
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to delete audio track.' }, { status: 500 })
  }
}

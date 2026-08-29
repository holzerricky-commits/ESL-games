import { NextResponse } from 'next/server'
import { LISTENING_MARK_MAX_FILE_BYTES } from '@/lib/books/book-audio'
import {
  deleteListeningMark,
  getListeningMarkMeta,
  readListeningMarkBytes,
  saveListeningMark,
} from '@/lib/books/book-audio-server'

export const runtime = 'nodejs'

const IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])

function isAllowedImage(file: File): boolean {
  const type = (file.type || '').toLowerCase()
  if (IMAGE_TYPES.has(type)) return true
  const name = (file.name || '').toLowerCase()
  return /\.(jpe?g|png|webp)$/.test(name)
}

/** GET ?bookId= — metadata, or ?bookId=&raw=1 for the image bytes. */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const bookId = url.searchParams.get('bookId')?.trim() ?? ''
    const raw = url.searchParams.get('raw') === '1'
    if (!bookId) {
      return NextResponse.json({ ok: false, error: 'bookId is required.' }, { status: 400 })
    }

    if (raw) {
      const result = await readListeningMarkBytes(bookId)
      if (result && 'error' in result) {
        return NextResponse.json({ ok: false, error: result.error }, { status: result.status })
      }
      if (!result) {
        return NextResponse.json({ ok: false, error: 'No listening mark saved.' }, { status: 404 })
      }
      return new NextResponse(new Uint8Array(result.bytes), {
        status: 200,
        headers: {
          'Content-Type': result.contentType,
          'Cache-Control': 'no-store',
        },
      })
    }

    const meta = await getListeningMarkMeta(bookId)
    if ('error' in meta) {
      return NextResponse.json({ ok: false, error: meta.error }, { status: meta.status })
    }
    return NextResponse.json(meta)
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to load listening mark.' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const bookId = String(form.get('bookId') ?? '').trim()
    const file = form.get('file')
    if (!bookId || !(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'bookId and file are required.' }, { status: 400 })
    }
    if (!isAllowedImage(file)) {
      return NextResponse.json(
        { ok: false, error: 'Use a JPEG, PNG, or WebP crop of the listening mark.' },
        { status: 400 },
      )
    }
    if (file.size <= 0) {
      return NextResponse.json({ ok: false, error: 'Image is empty.' }, { status: 400 })
    }
    if (file.size > LISTENING_MARK_MAX_FILE_BYTES) {
      return NextResponse.json({ ok: false, error: 'Mark image exceeds 2 MB limit.' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await saveListeningMark({
      bookId,
      buffer,
      contentType: file.type || 'image/jpeg',
    })
    if ('error' in result) {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.status })
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to save listening mark.' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url)
    const bookId = url.searchParams.get('bookId')?.trim() ?? ''
    if (!bookId) {
      return NextResponse.json({ ok: false, error: 'bookId is required.' }, { status: 400 })
    }
    const result = await deleteListeningMark(bookId)
    if ('error' in result) {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.status })
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to delete listening mark.' }, { status: 500 })
  }
}

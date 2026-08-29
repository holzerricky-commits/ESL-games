import path from 'node:path'
import { NextResponse } from 'next/server'
import {
  BOOK_AUDIO_MAX_FILE_BYTES,
  bookAudioContentType,
  isBookAudioExtension,
} from '@/lib/books/book-audio'
import { saveBookAudioTrack } from '@/lib/books/book-audio-server'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const bookId = String(form.get('bookId') ?? '').trim()
    const file = form.get('file')
    if (!bookId || !(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'bookId and file are required.' }, { status: 400 })
    }
    if (file.size <= 0) {
      return NextResponse.json({ ok: false, error: 'Uploaded file is empty.' }, { status: 400 })
    }
    if (file.size > BOOK_AUDIO_MAX_FILE_BYTES) {
      return NextResponse.json({ ok: false, error: 'File exceeds 50MB upload limit.' }, { status: 400 })
    }

    const ext = path.extname(file.name || '').toLowerCase()
    if (!isBookAudioExtension(ext)) {
      return NextResponse.json(
        { ok: false, error: 'Only mp3, m4a, wav, ogg, and aac files are allowed.' },
        { status: 400 },
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await saveBookAudioTrack({
      bookId,
      fileName: file.name || `track${ext}`,
      buffer,
      contentType: bookAudioContentType(ext, file.type),
    })

    if ('error' in result) {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.status })
    }

    return NextResponse.json({ ok: true, item: result })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to upload audio file.' }, { status: 500 })
  }
}

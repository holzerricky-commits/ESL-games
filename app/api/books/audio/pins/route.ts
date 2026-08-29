import { NextResponse } from 'next/server'
import {
  createBookAudioPin,
  deleteBookAudioPin,
  deleteBookAudioPinsByTrackId,
  deleteBookAudioPinsForScope,
  listBookAudioPins,
  updateBookAudioPin,
} from '@/lib/books/book-audio-server'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const bookId = url.searchParams.get('bookId')?.trim() ?? ''
    const unitId = url.searchParams.get('unitId')?.trim() || null
    if (!bookId) {
      return NextResponse.json({ ok: false, error: 'bookId is required.' }, { status: 400 })
    }
    const items = await listBookAudioPins(bookId, unitId)
    if (items == null) {
      return NextResponse.json({ ok: false, error: 'Book not found.' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, items })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to load audio pins.' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      bookId?: string
      trackId?: string
      unitId?: string
      pdfPage?: number
      center?: [number, number]
    } | null
    const bookId = String(body?.bookId ?? '').trim()
    const trackId = String(body?.trackId ?? '').trim()
    const unitId = String(body?.unitId ?? '').trim()
    const pdfPage = Number(body?.pdfPage)
    const center = body?.center
    if (!bookId || !trackId || !unitId) {
      return NextResponse.json(
        { ok: false, error: 'bookId, trackId, and unitId are required.' },
        { status: 400 },
      )
    }
    if (!Array.isArray(center) || center.length < 2) {
      return NextResponse.json({ ok: false, error: 'center [x, y] is required.' }, { status: 400 })
    }
    const result = await createBookAudioPin({
      bookId,
      trackId,
      unitId,
      pdfPage,
      center: [Number(center[0]), Number(center[1])],
    })
    if ('error' in result) {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.status })
    }
    return NextResponse.json({ ok: true, item: result })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to create audio pin.' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      bookId?: string
      pinId?: string
      unitId?: string
      pdfPage?: number
      center?: [number, number]
    } | null
    const bookId = String(body?.bookId ?? '').trim()
    const pinId = String(body?.pinId ?? '').trim()
    const unitId = String(body?.unitId ?? '').trim() || undefined
    const pdfPage = Number(body?.pdfPage)
    const center = body?.center
    if (!bookId || !pinId) {
      return NextResponse.json({ ok: false, error: 'bookId and pinId are required.' }, { status: 400 })
    }
    if (!Array.isArray(center) || center.length < 2) {
      return NextResponse.json({ ok: false, error: 'center [x, y] is required.' }, { status: 400 })
    }
    if (!Number.isFinite(pdfPage)) {
      return NextResponse.json({ ok: false, error: 'pdfPage is required.' }, { status: 400 })
    }
    const result = await updateBookAudioPin({
      bookId,
      pinId,
      unitId,
      pdfPage,
      center: [Number(center[0]), Number(center[1])],
    })
    if ('error' in result) {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.status })
    }
    return NextResponse.json({ ok: true, item: result })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to move audio pin.' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url)
    const bookId = url.searchParams.get('bookId')?.trim() ?? ''
    const pinId = url.searchParams.get('pinId')?.trim() ?? ''
    const trackId = url.searchParams.get('trackId')?.trim() ?? ''
    const scope = url.searchParams.get('scope')?.trim() ?? ''
    const unitId = url.searchParams.get('unitId')?.trim() || null
    if (!bookId) {
      return NextResponse.json({ ok: false, error: 'bookId is required.' }, { status: 400 })
    }

    // Clear all pins for the book, or only one unit (auto-place redo).
    if (scope === 'all' || (unitId && !pinId && !trackId)) {
      if (scope === 'all' && unitId) {
        return NextResponse.json(
          { ok: false, error: 'Use scope=all without unitId, or unitId without scope=all.' },
          { status: 400 },
        )
      }
      const result = await deleteBookAudioPinsForScope(
        bookId,
        scope === 'all' ? null : unitId,
      )
      if ('error' in result) {
        return NextResponse.json({ ok: false, error: result.error }, { status: result.status })
      }
      return NextResponse.json({ ok: true, removed: result.removed })
    }

    if (!pinId && !trackId) {
      return NextResponse.json(
        { ok: false, error: 'bookId and pinId, trackId, unitId, or scope=all are required.' },
        { status: 400 },
      )
    }
    const result = pinId
      ? await deleteBookAudioPin(bookId, pinId)
      : await deleteBookAudioPinsByTrackId(bookId, trackId)
    if ('error' in result) {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.status })
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to delete audio pin.' }, { status: 500 })
  }
}

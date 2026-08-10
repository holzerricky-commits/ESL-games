import { NextRequest, NextResponse } from 'next/server'
import { normalizeBookAnnotationsDiskPayload } from '@/lib/local-data/book-annotations-disk-types'
import {
  readBookAnnotationsFromDisk,
  writeBookAnnotationsToDisk,
} from '@/lib/local-data/book-annotations-disk-server'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const payload = await readBookAnnotationsFromDisk()
    return NextResponse.json({ ok: true, ...payload })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'Expected annotation payload object.' }, { status: 400 })
  }
  const payload = normalizeBookAnnotationsDiskPayload(body)
  try {
    await writeBookAnnotationsToDisk(payload)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

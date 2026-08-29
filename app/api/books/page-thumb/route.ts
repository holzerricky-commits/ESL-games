import { readFile, stat } from 'node:fs/promises'
import { NextRequest, NextResponse } from 'next/server'
import { fileEtag, ifNoneMatchHits, IMAGE_REVALIDATE_CACHE_CONTROL } from '@/lib/books/file-http-cache'
import { clampPageThumbPage } from '@/lib/books/persisted-page-thumb-path'
import {
  findExistingPersistedPageThumb,
  isJpegBuffer,
  PersistedPageThumbError,
  savePersistedPageThumbJpeg,
} from '@/lib/books/persisted-page-thumb-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_JPEG_BYTES = 1.5 * 1024 * 1024

async function jpegResponse(req: NextRequest, absThumb: string) {
  const fileStat = await stat(absThumb)
  const etag = fileEtag(fileStat)
  if (ifNoneMatchHits(req.headers.get('if-none-match'), etag)) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        'Cache-Control': IMAGE_REVALIDATE_CACHE_CONTROL,
        ETag: etag,
      },
    })
  }
  const bytes = await readFile(absThumb)
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Cache-Control': IMAGE_REVALIDATE_CACHE_CONTROL,
      'Content-Type': 'image/jpeg',
      'Content-Length': String(bytes.length),
      ETag: etag,
    },
  })
}

function thumbErrorResponse(error: unknown) {
  if (error instanceof PersistedPageThumbError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  const message = error instanceof Error ? error.message : 'Page thumb failed.'
  return NextResponse.json({ error: message }, { status: 500 })
}

/** Serve a saved page picture only — never opens the PDF. */
export async function GET(req: NextRequest) {
  const rawPath = req.nextUrl.searchParams.get('path')
  const rawPage = req.nextUrl.searchParams.get('page')
  if (!rawPath) {
    return NextResponse.json({ error: 'Missing path query param.' }, { status: 400 })
  }
  const page = clampPageThumbPage(Number(rawPage))
  if (page == null) {
    return NextResponse.json({ error: 'Invalid page.' }, { status: 400 })
  }

  try {
    const absThumb = await findExistingPersistedPageThumb(rawPath, page)
    if (!absThumb) {
      return NextResponse.json({ error: 'Not cached.' }, { status: 404 })
    }
    return await jpegResponse(req, absThumb)
  } catch (error) {
    return thumbErrorResponse(error)
  }
}

/** Save a JPEG drawn in the browser. */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const rawPath = String(form.get('path') ?? '').trim()
    const page = clampPageThumbPage(Number(form.get('page')))
    const file = form.get('file')
    if (!rawPath || page == null || !(file instanceof File)) {
      return NextResponse.json({ error: 'path, page, and file are required.' }, { status: 400 })
    }
    if (file.size <= 0 || file.size > MAX_JPEG_BYTES) {
      return NextResponse.json({ error: 'Image is empty or too large.' }, { status: 400 })
    }
    const buffer = Buffer.from(await file.arrayBuffer())
    if (!isJpegBuffer(buffer)) {
      return NextResponse.json({ error: 'File must be a JPEG.' }, { status: 400 })
    }
    const absThumb = await savePersistedPageThumbJpeg(rawPath, page, buffer)
    const fileStat = await stat(absThumb)
    return NextResponse.json({ ok: true, etag: fileEtag(fileStat) })
  } catch (error) {
    return thumbErrorResponse(error)
  }
}

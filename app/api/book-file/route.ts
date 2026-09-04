import path from 'node:path'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { NextRequest, NextResponse } from 'next/server'
import { getBookLibraryRoot } from '@/lib/books/server'
import { fileEtag, ifNoneMatchHits, IMAGE_REVALIDATE_CACHE_CONTROL } from '@/lib/books/file-http-cache'
import { resolveBookFileServeAbsolutePath } from '@/lib/books/resolve-book-file-serve-path'

export const runtime = 'nodejs'

function parseRangeHeader(rangeHeader: string, totalSize: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim())
  if (!match) return null
  const [, rawStart, rawEnd] = match
  if (rawStart === '' && rawEnd === '') return null

  if (rawStart === '') {
    const length = Number.parseInt(rawEnd, 10)
    if (!Number.isFinite(length) || length <= 0) return null
    const start = Math.max(0, totalSize - length)
    return { start, end: totalSize - 1 }
  }

  const start = Number.parseInt(rawStart, 10)
  if (!Number.isFinite(start) || start < 0 || start >= totalSize) return null
  const parsedEnd = rawEnd ? Number.parseInt(rawEnd, 10) : totalSize - 1
  const end = Math.min(totalSize - 1, Number.isFinite(parsedEnd) ? parsedEnd : totalSize - 1)
  if (end < start) return null
  return { start, end }
}

function getContentType(absPath: string): string {
  const lower = absPath.toLowerCase()
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.mp3')) return 'audio/mpeg'
  if (lower.endsWith('.m4a')) return 'audio/mp4'
  if (lower.endsWith('.wav')) return 'audio/wav'
  if (lower.endsWith('.ogg')) return 'audio/ogg'
  if (lower.endsWith('.aac')) return 'audio/aac'
  return 'application/octet-stream'
}

function cacheControlForContentType(contentType: string): string {
  if (contentType.startsWith('image/')) return IMAGE_REVALIDATE_CACHE_CONTROL
  if (contentType.startsWith('audio/')) return 'public, max-age=604800'
  return 'public, max-age=300'
}

function toWebReadableWithAbort(
  req: NextRequest,
  absTarget: string,
  start?: number,
  end?: number,
): ReadableStream<Uint8Array> {
  const nodeStream = createReadStream(
    absTarget,
    typeof start === 'number' && typeof end === 'number' ? { start, end } : undefined,
  )
  let requestAborted = false
  const onAbort = () => {
    requestAborted = true
    nodeStream.destroy()
  }
  req.signal.addEventListener('abort', onAbort, { once: true })

  return new ReadableStream<Uint8Array>({
    start(controller) {
      nodeStream.on('data', (chunk: string | Buffer) => {
        try {
          const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk
          controller.enqueue(new Uint8Array(buf))
        } catch {
          // Controller may be closed if the client cancels during heavy range activity.
          nodeStream.destroy()
        }
      })
      nodeStream.on('end', () => {
        try {
          controller.close()
        } catch {
          // Ignore close races when cancelled.
        } finally {
          req.signal.removeEventListener('abort', onAbort)
        }
      })
      nodeStream.on('error', (error) => {
        req.signal.removeEventListener('abort', onAbort)
        if (requestAborted) return
        const code = typeof error === 'object' && error != null && 'code' in error
          ? String((error as { code?: unknown }).code ?? '')
          : ''
        if (code === 'ERR_STREAM_PREMATURE_CLOSE' || code === 'ERR_INVALID_STATE') return
        try {
          controller.error(error)
        } catch {
          // Ignore controller state races.
        }
      })
    },
    cancel() {
      req.signal.removeEventListener('abort', onAbort)
      nodeStream.destroy()
    },
  })
}

export async function GET(req: NextRequest) {
  const rawPath = req.nextUrl.searchParams.get('path')
  if (!rawPath) {
    return NextResponse.json({ error: 'Missing path query param.' }, { status: 400 })
  }

  const libraryRoot = getBookLibraryRoot()
  const normalizedRelative = rawPath.replaceAll('\\', '/').replace(/^\/+/, '')
  const absOriginal = path.resolve(/* turbopackIgnore: true */ process.cwd(), normalizedRelative)
  if (!absOriginal.startsWith(libraryRoot)) {
    return NextResponse.json({ error: 'Path must be inside book-library.' }, { status: 400 })
  }

  const absTarget = await resolveBookFileServeAbsolutePath(absOriginal)

  let fileStat
  try {
    fileStat = await stat(absTarget)
  } catch {
    return NextResponse.json({ error: 'File not found.' }, { status: 404 })
  }

  if (!fileStat.isFile()) {
    return NextResponse.json({ error: 'Target path is not a file.' }, { status: 400 })
  }

  const totalSize = fileStat.size
  const rangeHeader = req.headers.get('range')
  const contentType = getContentType(absTarget)
  const cacheControl = cacheControlForContentType(contentType)
  const etag = fileEtag(fileStat)

  if (!rangeHeader && ifNoneMatchHits(req.headers.get('if-none-match'), etag)) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        'Accept-Ranges': 'bytes',
        'Cache-Control': cacheControl,
        ETag: etag,
      },
    })
  }

  if (rangeHeader) {
    const parsed = parseRangeHeader(rangeHeader, totalSize)
    if (!parsed) {
      return new NextResponse(null, {
        status: 416,
        headers: {
          'Content-Range': `bytes */${totalSize}`,
        },
      })
    }
    const { start, end } = parsed
    const chunkSize = end - start + 1
    const stream = toWebReadableWithAbort(req, absTarget, start, end)
    return new NextResponse(stream, {
      status: 206,
      headers: {
        'Accept-Ranges': 'bytes',
        'Cache-Control': cacheControl,
        'Content-Length': String(chunkSize),
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Content-Type': contentType,
        ETag: etag,
      },
    })
  }

  const stream = toWebReadableWithAbort(req, absTarget)
  return new NextResponse(stream, {
    status: 200,
    headers: {
      'Accept-Ranges': 'bytes',
      'Cache-Control': cacheControl,
      'Content-Length': String(totalSize),
      'Content-Type': contentType,
      ETag: etag,
    },
  })
}

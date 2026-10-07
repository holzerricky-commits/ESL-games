import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { getBookLibraryRoot } from '@/lib/books/server'
import { readSearchableOcrBoxes } from '@/lib/books/searchable-ocr-boxes-io'
import { searchableOcrBoxesToRuns } from '@/lib/books/searchable-ocr-boxes'

export const runtime = 'nodejs'

/**
 * OCR word boxes for Select (printed rectangles).
 * Query: path=unit relative path, page=1-based PDF page.
 */
export async function GET(req: NextRequest) {
  const rawPath = req.nextUrl.searchParams.get('path')
  const rawPage = req.nextUrl.searchParams.get('page')
  if (!rawPath) {
    return NextResponse.json({ error: 'Missing path query param.' }, { status: 400 })
  }
  const page = Number.parseInt(String(rawPage ?? ''), 10)
  if (!Number.isFinite(page) || page < 1) {
    return NextResponse.json({ error: 'Missing or invalid page.' }, { status: 400 })
  }

  const libraryRoot = getBookLibraryRoot()
  const normalizedRelative = rawPath.replaceAll('\\', '/').replace(/^\/+/, '')
  const absOriginal = path.resolve(/* turbopackIgnore: true */ process.cwd(), normalizedRelative)
  if (!absOriginal.startsWith(libraryRoot)) {
    return NextResponse.json({ error: 'Path must be inside book-library.' }, { status: 400 })
  }

  const file = await readSearchableOcrBoxes(absOriginal, page)
  if (!file || file.words.length === 0) {
    return NextResponse.json({ ok: false, runs: [] }, { status: 404 })
  }

  return NextResponse.json(
    {
      ok: true,
      pdfPage: file.pdfPage,
      runs: searchableOcrBoxesToRuns(file),
    },
    {
      headers: {
        'Cache-Control': 'private, max-age=0, must-revalidate',
      },
    },
  )
}

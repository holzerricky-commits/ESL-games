import path from 'node:path'
import { promises as fs } from 'node:fs'
import { NextResponse } from 'next/server'
import { getBookLibraryRoot, getBookManifestPath } from '@/lib/books/server'
import {
  bookLibraryPayloadSchema,
  isBookLibraryFilePath,
} from '@/lib/books/manifest-validation'
import type { BookLibraryPayload } from '@/lib/books/types'

export const runtime = 'nodejs'

/**
 * Persists the full book library manifest to disk.
 * Intended for the same local-teacher trust model as GET /api/books and /api/book-file (no auth).
 */
export async function POST(req: Request) {
  const cwd = /* turbopackIgnore: true */ process.cwd()
  const libraryRoot = getBookLibraryRoot()
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const parsed = bookLibraryPayloadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed.', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const payload = parsed.data as BookLibraryPayload
  for (const book of payload.books) {
    for (const unit of book.units) {
      if (!isBookLibraryFilePath(unit.filePath, cwd, libraryRoot)) {
        return NextResponse.json(
          { error: `Unit filePath must be inside book-library: ${unit.filePath}` },
          { status: 400 },
        )
      }
    }
  }

  const manifestPath = getBookManifestPath()
  const dir = path.dirname(manifestPath)
  try {
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(manifestPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Write failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.json(payload)
}

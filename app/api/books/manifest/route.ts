import path from 'node:path'
import { NextResponse } from 'next/server'
import { getBookLibraryRoot, saveBookLibraryManifest } from '@/lib/books/server'
import { ensureMissingBookCovers } from '@/lib/books/book-cover-sync'
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
    if (book.coverImagePath && !isBookLibraryFilePath(book.coverImagePath, cwd, libraryRoot)) {
      return NextResponse.json(
        { error: `coverImagePath must be inside book-library: ${book.coverImagePath}` },
        { status: 400 },
      )
    }
    for (const volume of book.volumes ?? []) {
      if (!isBookLibraryFilePath(volume.filePath, cwd, libraryRoot)) {
        return NextResponse.json(
          { error: `Volume filePath must be inside book-library: ${volume.filePath}` },
          { status: 400 },
        )
      }
    }
  }

  try {
    const withCovers = await ensureMissingBookCovers(payload)
    await saveBookLibraryManifest(withCovers.payload)
    return NextResponse.json(withCovers.payload)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Write failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

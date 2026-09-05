import path from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { NextResponse } from 'next/server'
import { ensureMissingBookCovers } from '@/lib/books/book-cover-sync'
import { getBookLibraryRoot, getBookManifestPath, loadBookLibrary, saveBookLibraryManifest } from '@/lib/books/server'
import {
  bookLibraryPayloadSchema,
  isBookLibraryFilePath,
} from '@/lib/books/manifest-validation'
import type { BookLibraryPayload } from '@/lib/books/types'

export const runtime = 'nodejs'

const MAX_FILE_SIZE = 5 * 1024 * 1024

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
}

function resolveBookFolderFromUnitPath(filePath: string): string | null {
  const normalized = filePath.replaceAll('\\', '/')
  const match = normalized.match(/^book-library\/([^/]+)\//)
  return match?.[1] ?? null
}

function inferExt(file: File): string | null {
  const mime = file.type.split(';')[0]?.trim().toLowerCase() ?? ''
  if (MIME_TO_EXT[mime]) return MIME_TO_EXT[mime]
  const lower = file.name.toLowerCase()
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return '.jpg'
  if (lower.endsWith('.png')) return '.png'
  if (lower.endsWith('.webp')) return '.webp'
  if (lower.endsWith('.gif')) return '.gif'
  return null
}

function isAllowedImage(file: File): boolean {
  const mime = file.type.split(';')[0]?.trim().toLowerCase() ?? ''
  if (ALLOWED_MIME.has(mime)) return true
  return inferExt(file) != null
}

async function persistManifest(payload: BookLibraryPayload): Promise<BookLibraryPayload | NextResponse> {
  const cwd = /* turbopackIgnore: true */ process.cwd()
  const libraryRoot = getBookLibraryRoot()
  const parsed = bookLibraryPayloadSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed.', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const validated = parsed.data as BookLibraryPayload
  for (const book of validated.books) {
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

  const manifestPath = getBookManifestPath()
  await mkdir(path.dirname(manifestPath), { recursive: true })
  await saveBookLibraryManifest(validated)
  return validated
}

export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const bookId = String(form.get('bookId') ?? '').trim()
    const file = form.get('file')
    if (!bookId || !(file instanceof File)) {
      return NextResponse.json({ error: 'bookId and file are required.' }, { status: 400 })
    }
    if (file.size <= 0) {
      return NextResponse.json({ error: 'Uploaded file is empty.' }, { status: 400 })
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Image exceeds 5MB upload limit.' }, { status: 400 })
    }
    if (!isAllowedImage(file)) {
      return NextResponse.json({ error: 'Only JPG, PNG, WebP, and GIF images are supported.' }, { status: 400 })
    }

    const ext = inferExt(file)
    if (!ext) {
      return NextResponse.json({ error: 'Could not determine image type.' }, { status: 400 })
    }

    const library = await loadBookLibrary()
    const bookIndex = library.books.findIndex((item) => item.id === bookId)
    if (bookIndex < 0) {
      return NextResponse.json({ error: 'Book not found.' }, { status: 404 })
    }

    const book = library.books[bookIndex]!
    const unitPath = book.units[0]?.filePath ?? ''
    const bookFolder = resolveBookFolderFromUnitPath(unitPath)
    if (!bookFolder) {
      return NextResponse.json({ error: 'Book folder could not be resolved.' }, { status: 400 })
    }

    const libraryRoot = getBookLibraryRoot()
    const bookDir = path.resolve(libraryRoot, bookFolder)
    if (!bookDir.startsWith(libraryRoot)) {
      return NextResponse.json({ error: 'Invalid book folder.' }, { status: 400 })
    }
    await mkdir(bookDir, { recursive: true })

    const fileName = `cover${ext}`
    const absTarget = path.resolve(bookDir, fileName)
    if (!absTarget.startsWith(bookDir)) {
      return NextResponse.json({ error: 'Invalid target path.' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(absTarget, buffer)

    const coverImagePath = `book-library/${bookFolder}/${fileName}`.replaceAll('\\', '/')
    const nextBooks = library.books.map((b, i) =>
      i === bookIndex ? { ...b, coverImagePath } : b,
    )
    const result = await persistManifest({ books: nextBooks })
    if (result instanceof NextResponse) return result
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url)
    const bookId = url.searchParams.get('bookId')?.trim() ?? ''
    if (!bookId) {
      return NextResponse.json({ error: 'bookId query param is required.' }, { status: 400 })
    }

    const library = await loadBookLibrary()
    const bookIndex = library.books.findIndex((item) => item.id === bookId)
    if (bookIndex < 0) {
      return NextResponse.json({ error: 'Book not found.' }, { status: 404 })
    }

    const book = library.books[bookIndex]!
    if (!book.coverImagePath) {
      return NextResponse.json(library)
    }

    const { coverImagePath: _removed, ...rest } = book
    const nextBooks = library.books.map((b, i) => (i === bookIndex ? rest : b))
    const withAutoCovers = await ensureMissingBookCovers({ books: nextBooks })
    const result = await persistManifest(withAutoCovers.payload)
    if (result instanceof NextResponse) return result
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Reset failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

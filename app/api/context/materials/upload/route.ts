import { createHash } from 'node:crypto'
import path from 'node:path'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { NextResponse } from 'next/server'
import { resolveBookFolderFromLibraryFilePath } from '@/lib/books/manifest-validation'
import { getBookLibraryRoot, loadBookLibrary } from '@/lib/books/server'
import type { BookContextMaterialRecord } from '@/lib/context/types'

export const runtime = 'nodejs'

const MAX_FILE_SIZE = 35 * 1024 * 1024

interface StoredBookMaterial {
  id: string
  url: string
  title: string
  materialType: string
  fileName: string
  filePath: string
  sizeBytes: number
  contentType: string
  savedAt: string
}

function resolveBookFolderFromUnitPath(filePath: string): string | null {
  return resolveBookFolderFromLibraryFilePath(
    filePath,
    /* turbopackIgnore: true */ process.cwd(),
    getBookLibraryRoot(),
  )
}

function materialsIndexPath(bookFolder: string): string {
  return path.resolve(getBookLibraryRoot(), bookFolder, 'supporting', 'materials-index.json')
}

function sanitizeFileName(raw: string): string {
  const normalized = raw
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.+$/g, '')
  return normalized || 'material'
}

async function fileExists(absPath: string): Promise<boolean> {
  try {
    await access(absPath)
    return true
  } catch {
    return false
  }
}

async function readMaterialsIndex(bookFolder: string): Promise<StoredBookMaterial[]> {
  const indexPath = materialsIndexPath(bookFolder)
  try {
    const raw = await readFile(indexPath, 'utf8')
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as StoredBookMaterial[]) : []
  } catch {
    return []
  }
}

async function writeMaterialsIndex(bookFolder: string, items: StoredBookMaterial[]): Promise<void> {
  const indexPath = materialsIndexPath(bookFolder)
  await mkdir(path.dirname(indexPath), { recursive: true })
  await writeFile(indexPath, JSON.stringify(items, null, 2), 'utf8')
}

function createMaterialId(bookId: string, fileName: string, sizeBytes: number): string {
  return createHash('sha1').update(`${bookId}::${fileName}::${sizeBytes}::${Date.now()}`).digest('hex').slice(0, 16)
}

export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const bookId = String(form.get('bookId') ?? '').trim()
    const materialTypeRaw = String(form.get('materialType') ?? '').trim()
    const materialType: BookContextMaterialRecord['type'] =
      materialTypeRaw === 'pacing-guide' ||
      materialTypeRaw === 'scope-sequence' ||
      materialTypeRaw === 'teacher-edition' ||
      materialTypeRaw === 'assessment' ||
      materialTypeRaw === 'intervention' ||
      materialTypeRaw === 'grammar-writing' ||
      materialTypeRaw === 'vocabulary' ||
      materialTypeRaw === 'digital-resource' ||
      materialTypeRaw === 'other'
        ? materialTypeRaw
        : 'other'
    const file = form.get('file')
    if (!bookId || !(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'bookId and file are required.' }, { status: 400 })
    }
    if (file.size <= 0) return NextResponse.json({ ok: false, error: 'Uploaded file is empty.' }, { status: 400 })
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ ok: false, error: 'File exceeds 35MB upload limit.' }, { status: 400 })

    const library = await loadBookLibrary()
    const book = library.books.find((item) => item.id === bookId)
    if (!book) return NextResponse.json({ ok: false, error: 'Book not found.' }, { status: 404 })
    const unitPath = book.units[0]?.filePath ?? ''
    const bookFolder = resolveBookFolderFromUnitPath(unitPath)
    if (!bookFolder) return NextResponse.json({ ok: false, error: 'Book folder could not be resolved.' }, { status: 400 })

    const supportingDir = path.resolve(getBookLibraryRoot(), bookFolder, 'supporting')
    await mkdir(supportingDir, { recursive: true })

    const parsedName = path.parse(sanitizeFileName(file.name || 'material'))
    const safeBase = sanitizeFileName(parsedName.name) || 'material'
    const safeExt = parsedName.ext || '.bin'
    let candidate = `${safeBase}${safeExt}`
    let absTarget = path.resolve(supportingDir, candidate)
    let counter = 2
    while (!absTarget.startsWith(supportingDir) || (await fileExists(absTarget))) {
      candidate = `${safeBase}-${counter}${safeExt}`
      absTarget = path.resolve(supportingDir, candidate)
      counter += 1
      if (counter > 5000) return NextResponse.json({ ok: false, error: 'Could not allocate filename.' }, { status: 500 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(absTarget, buffer)

    const materialId = createMaterialId(bookId, candidate, buffer.byteLength)
    const item: StoredBookMaterial = {
      id: materialId,
      url: `local-upload://${bookId}/${encodeURIComponent(candidate)}`,
      title: sanitizeFileName(parsedName.name) || candidate,
      materialType,
      fileName: candidate,
      filePath: `book-library/${bookFolder}/supporting/${candidate}`.replaceAll('\\', '/'),
      sizeBytes: buffer.byteLength,
      contentType: file.type || 'application/octet-stream',
      savedAt: new Date().toISOString(),
    }
    const existing = await readMaterialsIndex(bookFolder)
    const next = [item, ...existing.filter((entry) => entry.id !== item.id && entry.filePath !== item.filePath)].slice(0, 500)
    await writeMaterialsIndex(bookFolder, next)
    return NextResponse.json({ ok: true, item })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to upload file.' }, { status: 500 })
  }
}


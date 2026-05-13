import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { NextResponse } from 'next/server'
import { resolveBookFolderFromLibraryFilePath } from '@/lib/books/manifest-validation'
import { getBookLibraryRoot, loadBookLibrary } from '@/lib/books/server'

export const runtime = 'nodejs'

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

async function readMaterialsIndex(bookFolder: string): Promise<StoredBookMaterial[]> {
  const indexPath = materialsIndexPath(bookFolder)
  try {
    const raw = await readFile(indexPath, 'utf8')
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => {
        if (!item || typeof item !== 'object') return null
        const src = item as Partial<StoredBookMaterial>
        if (typeof src.id !== 'string' || typeof src.url !== 'string' || typeof src.fileName !== 'string') return null
        return {
          id: src.id,
          url: src.url,
          title: typeof src.title === 'string' ? src.title : 'Untitled material',
          materialType: typeof src.materialType === 'string' ? src.materialType : 'other',
          fileName: src.fileName,
          filePath: typeof src.filePath === 'string' ? src.filePath : '',
          sizeBytes: Number.isFinite(src.sizeBytes) ? Number(src.sizeBytes) : 0,
          contentType: typeof src.contentType === 'string' ? src.contentType : 'application/octet-stream',
          savedAt: typeof src.savedAt === 'string' ? src.savedAt : new Date().toISOString(),
        }
      })
      .filter((item): item is StoredBookMaterial => !!item)
  } catch {
    return []
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const bookId = url.searchParams.get('bookId')?.trim() ?? ''
    if (!bookId) return NextResponse.json({ ok: false, error: 'bookId is required.' }, { status: 400 })
    const library = await loadBookLibrary()
    const book = library.books.find((item) => item.id === bookId)
    if (!book) return NextResponse.json({ ok: false, error: 'Book not found.' }, { status: 404 })
    const unitPath = book.units[0]?.filePath ?? ''
    const bookFolder = resolveBookFolderFromUnitPath(unitPath)
    if (!bookFolder) return NextResponse.json({ ok: true, items: [] })
    const items = await readMaterialsIndex(bookFolder)
    return NextResponse.json({ ok: true, items })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to load materials.' }, { status: 500 })
  }
}

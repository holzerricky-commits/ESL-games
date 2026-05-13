import { createHash } from 'node:crypto'
import path from 'node:path'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { NextResponse } from 'next/server'
import { resolveBookFolderFromLibraryFilePath } from '@/lib/books/manifest-validation'
import { getBookLibraryRoot, loadBookLibrary } from '@/lib/books/server'
import type { BookContextMaterialRecord } from '@/lib/context/types'

export const runtime = 'nodejs'

const MAX_FILE_SIZE = 35 * 1024 * 1024

interface DownloadRequestBody {
  bookId: string
  url: string
  title?: string
  materialType?: BookContextMaterialRecord['type']
}

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

type DownloadTaskStatus = 'queued' | 'downloading' | 'completed' | 'failed'

interface DownloadTask {
  taskId: string
  status: DownloadTaskStatus
  bookId: string
  url: string
  title: string
  materialType: string
  downloadedBytes: number
  totalBytes: number | null
  speedBytesPerSec: number
  startedAt: string
  updatedAt: string
  completedAt?: string
  error?: string
  item?: StoredBookMaterial
}

const downloadTasks = new Map<string, DownloadTask>()

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

function extensionFromContentType(contentType: string): string {
  const normalized = contentType.toLowerCase()
  if (normalized.includes('application/pdf')) return '.pdf'
  if (normalized.includes('application/msword')) return '.doc'
  if (normalized.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')) return '.docx'
  if (normalized.includes('application/vnd.ms-powerpoint')) return '.ppt'
  if (normalized.includes('application/vnd.openxmlformats-officedocument.presentationml.presentation')) return '.pptx'
  if (normalized.includes('text/plain')) return '.txt'
  return '.bin'
}

function inferFileName(rawUrl: string, title: string | undefined, contentType: string): string {
  let base = sanitizeFileName(title ?? '')
  if (!base) {
    try {
      const parsed = new URL(rawUrl)
      const fromUrl = parsed.pathname.split('/').pop() ?? ''
      base = sanitizeFileName(fromUrl.replace(/\.[^.]+$/, ''))
    } catch {
      base = 'material'
    }
  }
  const hasKnownExt = /\.[a-z0-9]{2,6}$/i.test(base)
  if (hasKnownExt) return base
  return `${base}${extensionFromContentType(contentType)}`
}

function createMaterialId(bookId: string, url: string): string {
  return createHash('sha1').update(`${bookId}::${url}`).digest('hex').slice(0, 16)
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
  const dir = path.dirname(indexPath)
  await mkdir(dir, { recursive: true })
  await writeFile(indexPath, JSON.stringify(items, null, 2), 'utf8')
}

async function fileExists(absPath: string): Promise<boolean> {
  try {
    await access(absPath)
    return true
  } catch {
    return false
  }
}

function updateTask(taskId: string, patch: Partial<DownloadTask>): void {
  const current = downloadTasks.get(taskId)
  if (!current) return
  downloadTasks.set(taskId, {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  })
}

async function performDownload(taskId: string): Promise<void> {
  const task = downloadTasks.get(taskId)
  if (!task) return
  try {
    updateTask(taskId, { status: 'downloading', startedAt: new Date().toISOString() })
    const parsedUrl = new URL(task.url)
    const library = await loadBookLibrary()
    const book = library.books.find((item) => item.id === task.bookId)
    if (!book) throw new Error('Book not found.')
    const unitPath = book.units[0]?.filePath ?? ''
    const bookFolder = resolveBookFolderFromUnitPath(unitPath)
    if (!bookFolder) throw new Error('Book folder could not be resolved.')

    const response = await fetch(parsedUrl.toString())
    if (!response.ok) throw new Error(`Download failed (${response.status}).`)
    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() || 'application/octet-stream'
    if (contentType.toLowerCase().includes('text/html')) {
      throw new Error('URL returned HTML page, not a downloadable file.')
    }
    const totalBytesRaw = Number(response.headers.get('content-length') ?? '')
    const totalBytes = Number.isFinite(totalBytesRaw) && totalBytesRaw > 0 ? totalBytesRaw : null
    updateTask(taskId, { totalBytes })

    const chunks: Uint8Array[] = []
    let received = 0
    const startMs = Date.now()
    if (response.body) {
      const reader = response.body.getReader()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (!value) continue
        received += value.byteLength
        if (received > MAX_FILE_SIZE) {
          throw new Error('File exceeds 35MB download limit.')
        }
        chunks.push(value)
        const elapsedSec = Math.max(0.001, (Date.now() - startMs) / 1000)
        updateTask(taskId, {
          downloadedBytes: received,
          speedBytesPerSec: Math.round(received / elapsedSec),
        })
      }
    } else {
      const data = new Uint8Array(await response.arrayBuffer())
      received = data.byteLength
      if (received > MAX_FILE_SIZE) throw new Error('File exceeds 35MB download limit.')
      chunks.push(data)
      updateTask(taskId, { downloadedBytes: received, speedBytesPerSec: 0 })
    }
    if (received <= 0) throw new Error('Downloaded file is empty.')
    const data = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))

    const supportingDir = path.resolve(getBookLibraryRoot(), bookFolder, 'supporting')
    await mkdir(supportingDir, { recursive: true })
    const requestedName = inferFileName(parsedUrl.toString(), task.title, contentType)
    const parsedRequested = path.parse(requestedName)
    const safeBase = sanitizeFileName(parsedRequested.name) || 'material'
    const safeExt = parsedRequested.ext || extensionFromContentType(contentType)
    let candidate = `${safeBase}${safeExt}`
    let absTarget = path.resolve(supportingDir, candidate)
    let counter = 2
    while (!absTarget.startsWith(supportingDir) || (await fileExists(absTarget))) {
      candidate = `${safeBase}-${counter}${safeExt}`
      absTarget = path.resolve(supportingDir, candidate)
      counter += 1
      if (counter > 5000) throw new Error('Could not allocate filename.')
    }
    await writeFile(absTarget, data)

    const materialId = createMaterialId(task.bookId, parsedUrl.toString())
    const item: StoredBookMaterial = {
      id: materialId,
      url: parsedUrl.toString(),
      title: task.title || candidate,
      materialType: task.materialType || 'other',
      fileName: candidate,
      filePath: `book-library/${bookFolder}/supporting/${candidate}`.replaceAll('\\', '/'),
      sizeBytes: data.length,
      contentType,
      savedAt: new Date().toISOString(),
    }
    const existing = await readMaterialsIndex(bookFolder)
    const next = [item, ...existing.filter((entry) => entry.id !== materialId && entry.url !== item.url)].slice(0, 500)
    await writeMaterialsIndex(bookFolder, next)
    updateTask(taskId, {
      status: 'completed',
      item,
      downloadedBytes: data.length,
      completedAt: new Date().toISOString(),
      speedBytesPerSec: 0,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to download material.'
    updateTask(taskId, {
      status: 'failed',
      error: message,
      completedAt: new Date().toISOString(),
      speedBytesPerSec: 0,
    })
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const taskId = url.searchParams.get('taskId')?.trim() ?? ''
  if (!taskId) return NextResponse.json({ ok: false, error: 'taskId is required.' }, { status: 400 })
  const task = downloadTasks.get(taskId)
  if (!task) return NextResponse.json({ ok: false, error: 'Task not found.' }, { status: 404 })
  return NextResponse.json({ ok: true, task })
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<DownloadRequestBody>
    const bookId = String(body.bookId ?? '').trim()
    const rawUrl = String(body.url ?? '').trim()
    if (!bookId || !rawUrl) {
      return NextResponse.json({ ok: false, error: 'bookId and url are required.' }, { status: 400 })
    }
    let parsedUrl: URL
    try {
      parsedUrl = new URL(rawUrl)
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid URL.' }, { status: 400 })
    }
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return NextResponse.json({ ok: false, error: 'Only http(s) URLs are supported.' }, { status: 400 })
    }
    const taskId = createHash('sha1')
      .update(`${bookId}::${parsedUrl.toString()}::${Date.now()}::${Math.random()}`)
      .digest('hex')
      .slice(0, 16)
    const nowIso = new Date().toISOString()
    const task: DownloadTask = {
      taskId,
      status: 'queued',
      bookId,
      url: parsedUrl.toString(),
      title: typeof body.title === 'string' ? body.title.trim() || 'Untitled material' : 'Untitled material',
      materialType: typeof body.materialType === 'string' ? body.materialType : 'other',
      downloadedBytes: 0,
      totalBytes: null,
      speedBytesPerSec: 0,
      startedAt: nowIso,
      updatedAt: nowIso,
    }
    downloadTasks.set(taskId, task)
    void performDownload(taskId)
    return NextResponse.json({ ok: true, taskId })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start download.'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

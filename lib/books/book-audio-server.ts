import { createHash } from 'node:crypto'
import path from 'node:path'
import { access, mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises'
import { getBookLibraryRoot, loadBookLibrary } from '@/lib/books/server'
import {
  type BookAudioPin,
  type BookAudioTrack,
  clampAudioPinCenter,
  resolveBookFolderFromUnitPath,
  sanitizeAudioFileName,
  sortBookAudioTracks,
  titleFromAudioFileName,
  LISTENING_MARK_MAX_FILE_BYTES,
} from '@/lib/books/book-audio'

function audioDir(bookFolder: string): string {
  return path.resolve(getBookLibraryRoot(), bookFolder, 'audio')
}

function audioIndexPath(bookFolder: string): string {
  return path.resolve(audioDir(bookFolder), 'audio-index.json')
}

function audioPinsPath(bookFolder: string): string {
  return path.resolve(audioDir(bookFolder), 'audio-pins.json')
}

/** Crop of the book’s listening mark icon (teacher shortcut for auto-place). */
export const LISTENING_MARK_FILE_NAME = 'listening-mark.jpg'

function listeningMarkPath(bookFolder: string): string {
  return path.resolve(audioDir(bookFolder), LISTENING_MARK_FILE_NAME)
}

async function fileExists(absPath: string): Promise<boolean> {
  try {
    await access(absPath)
    return true
  } catch {
    return false
  }
}

function parseTrack(raw: unknown): BookAudioTrack | null {
  if (!raw || typeof raw !== 'object') return null
  const src = raw as Partial<BookAudioTrack>
  if (typeof src.id !== 'string' || typeof src.fileName !== 'string' || typeof src.filePath !== 'string') {
    return null
  }
  return {
    id: src.id,
    title: typeof src.title === 'string' && src.title.trim() ? src.title : titleFromAudioFileName(src.fileName),
    fileName: src.fileName,
    filePath: src.filePath,
    sizeBytes: Number.isFinite(src.sizeBytes) ? Number(src.sizeBytes) : 0,
    contentType: typeof src.contentType === 'string' ? src.contentType : 'application/octet-stream',
    savedAt: typeof src.savedAt === 'string' ? src.savedAt : new Date().toISOString(),
  }
}

export async function readBookAudioIndex(bookFolder: string): Promise<BookAudioTrack[]> {
  try {
    const raw = await readFile(audioIndexPath(bookFolder), 'utf8')
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return sortBookAudioTracks(parsed.map(parseTrack).filter((item): item is BookAudioTrack => !!item))
  } catch {
    return []
  }
}

async function writeBookAudioIndex(bookFolder: string, items: BookAudioTrack[]): Promise<void> {
  const indexPath = audioIndexPath(bookFolder)
  await mkdir(path.dirname(indexPath), { recursive: true })
  await writeFile(indexPath, JSON.stringify(sortBookAudioTracks(items), null, 2), 'utf8')
}

function createTrackId(bookId: string, fileName: string, sizeBytes: number): string {
  return createHash('sha1').update(`${bookId}::${fileName}::${sizeBytes}::${Date.now()}`).digest('hex').slice(0, 16)
}

export async function resolveBookAudioFolder(bookId: string): Promise<{
  bookFolder: string
  bookId: string
} | null> {
  const library = await loadBookLibrary()
  const book = library.books.find((item) => item.id === bookId)
  if (!book) return null
  const unitPath = book.units[0]?.filePath ?? ''
  const bookFolder = resolveBookFolderFromUnitPath(unitPath)
  if (!bookFolder) return null
  return { bookFolder, bookId }
}

export async function listBookAudioTracks(bookId: string): Promise<BookAudioTrack[] | null> {
  const resolved = await resolveBookAudioFolder(bookId)
  if (!resolved) return null
  return readBookAudioIndex(resolved.bookFolder)
}

export async function saveBookAudioTrack(params: {
  bookId: string
  fileName: string
  buffer: Buffer
  contentType: string
}): Promise<BookAudioTrack | { error: string; status: number }> {
  const resolved = await resolveBookAudioFolder(params.bookId)
  if (!resolved) return { error: 'Book not found or folder could not be resolved.', status: 404 }

  const dir = audioDir(resolved.bookFolder)
  await mkdir(dir, { recursive: true })

  const parsedName = path.parse(sanitizeAudioFileName(params.fileName || 'track'))
  const safeBase = sanitizeAudioFileName(parsedName.name) || 'track'
  const safeExt = parsedName.ext || '.bin'
  let candidate = `${safeBase}${safeExt}`
  let absTarget = path.resolve(dir, candidate)
  let counter = 2
  while (!absTarget.startsWith(dir) || (await fileExists(absTarget))) {
    candidate = `${safeBase}-${counter}${safeExt}`
    absTarget = path.resolve(dir, candidate)
    counter += 1
    if (counter > 5000) return { error: 'Could not allocate filename.', status: 500 }
  }

  await writeFile(absTarget, params.buffer)

  const track: BookAudioTrack = {
    id: createTrackId(params.bookId, candidate, params.buffer.byteLength),
    title: titleFromAudioFileName(candidate),
    fileName: candidate,
    filePath: `book-library/${resolved.bookFolder}/audio/${candidate}`.replaceAll('\\', '/'),
    sizeBytes: params.buffer.byteLength,
    contentType: params.contentType,
    savedAt: new Date().toISOString(),
  }

  const existing = await readBookAudioIndex(resolved.bookFolder)
  const next = [...existing.filter((entry) => entry.filePath !== track.filePath && entry.id !== track.id), track]
  await writeBookAudioIndex(resolved.bookFolder, next)
  return track
}

export async function deleteBookAudioTrack(
  bookId: string,
  trackId: string,
): Promise<{ ok: true } | { error: string; status: number }> {
  const resolved = await resolveBookAudioFolder(bookId)
  if (!resolved) return { error: 'Book not found or folder could not be resolved.', status: 404 }

  const existing = await readBookAudioIndex(resolved.bookFolder)
  const track = existing.find((item) => item.id === trackId)
  if (!track) return { error: 'Track not found.', status: 404 }

  const absTarget = path.resolve(getBookLibraryRoot(), resolved.bookFolder, 'audio', track.fileName)
  const audioRoot = audioDir(resolved.bookFolder)
  if (!absTarget.startsWith(audioRoot)) {
    return { error: 'Invalid track path.', status: 400 }
  }

  try {
    await unlink(absTarget)
  } catch {
    // File may already be missing; still drop from index.
  }

  await writeBookAudioIndex(
    resolved.bookFolder,
    existing.filter((item) => item.id !== trackId),
  )

  // Drop any page pins that pointed at the removed track.
  const pins = await readBookAudioPins(resolved.bookFolder)
  const nextPins = pins.filter((pin) => pin.trackId !== trackId)
  if (nextPins.length !== pins.length) {
    await writeBookAudioPins(resolved.bookFolder, nextPins)
  }

  return { ok: true }
}

function parsePin(raw: unknown): BookAudioPin | null {
  if (!raw || typeof raw !== 'object') return null
  const src = raw as Partial<BookAudioPin>
  if (
    typeof src.id !== 'string' ||
    typeof src.trackId !== 'string' ||
    typeof src.unitId !== 'string' ||
    !Number.isFinite(src.pdfPage)
  ) {
    return null
  }
  const centerRaw = src.center
  if (!Array.isArray(centerRaw) || centerRaw.length < 2) return null
  const x = Number(centerRaw[0])
  const y = Number(centerRaw[1])
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  return {
    id: src.id,
    trackId: src.trackId,
    unitId: src.unitId,
    pdfPage: Math.max(1, Math.floor(Number(src.pdfPage))),
    center: clampAudioPinCenter([x, y]),
    createdAt: typeof src.createdAt === 'string' ? src.createdAt : new Date().toISOString(),
  }
}

export async function readBookAudioPins(bookFolder: string): Promise<BookAudioPin[]> {
  try {
    const raw = await readFile(audioPinsPath(bookFolder), 'utf8')
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map(parsePin).filter((item): item is BookAudioPin => !!item)
  } catch {
    return []
  }
}

async function writeBookAudioPins(bookFolder: string, items: BookAudioPin[]): Promise<void> {
  const indexPath = audioPinsPath(bookFolder)
  await mkdir(path.dirname(indexPath), { recursive: true })
  await writeFile(indexPath, JSON.stringify(items, null, 2), 'utf8')
}

function createPinId(bookId: string, trackId: string, unitId: string): string {
  return createHash('sha1')
    .update(`${bookId}::${trackId}::${unitId}::${Date.now()}::${Math.random()}`)
    .digest('hex')
    .slice(0, 16)
}

export async function listBookAudioPins(
  bookId: string,
  unitId?: string | null,
): Promise<BookAudioPin[] | null> {
  const resolved = await resolveBookAudioFolder(bookId)
  if (!resolved) return null
  const pins = await readBookAudioPins(resolved.bookFolder)
  if (!unitId) return pins
  return pins.filter((pin) => pin.unitId === unitId)
}

export async function createBookAudioPin(params: {
  bookId: string
  trackId: string
  unitId: string
  pdfPage: number
  center: [number, number]
}): Promise<BookAudioPin | { error: string; status: number }> {
  const resolved = await resolveBookAudioFolder(params.bookId)
  if (!resolved) return { error: 'Book not found or folder could not be resolved.', status: 404 }

  const tracks = await readBookAudioIndex(resolved.bookFolder)
  if (!tracks.some((track) => track.id === params.trackId)) {
    return { error: 'Track not found.', status: 404 }
  }

  const unitId = params.unitId.trim()
  if (!unitId) return { error: 'unitId is required.', status: 400 }
  const pdfPage = Math.floor(params.pdfPage)
  if (!Number.isFinite(pdfPage) || pdfPage < 1) {
    return { error: 'pdfPage must be a positive page number.', status: 400 }
  }

  const existing = await readBookAudioPins(resolved.bookFolder)

  const pin: BookAudioPin = {
    id: createPinId(params.bookId, params.trackId, unitId),
    trackId: params.trackId,
    unitId,
    pdfPage,
    center: clampAudioPinCenter(params.center),
    createdAt: new Date().toISOString(),
  }

  await writeBookAudioPins(resolved.bookFolder, [...existing, pin])
  return pin
}

export async function updateBookAudioPin(params: {
  bookId: string
  pinId: string
  pdfPage: number
  center: [number, number]
  unitId?: string
}): Promise<BookAudioPin | { error: string; status: number }> {
  const resolved = await resolveBookAudioFolder(params.bookId)
  if (!resolved) return { error: 'Book not found or folder could not be resolved.', status: 404 }

  const pdfPage = Math.floor(params.pdfPage)
  if (!Number.isFinite(pdfPage) || pdfPage < 1) {
    return { error: 'pdfPage must be a positive page number.', status: 400 }
  }

  const existing = await readBookAudioPins(resolved.bookFolder)
  const index = existing.findIndex((pin) => pin.id === params.pinId)
  if (index < 0) return { error: 'Pin not found.', status: 404 }

  const prev = existing[index]!
  const next: BookAudioPin = {
    ...prev,
    unitId: params.unitId?.trim() || prev.unitId,
    pdfPage,
    center: clampAudioPinCenter(params.center),
  }
  const updated = [...existing]
  updated[index] = next
  await writeBookAudioPins(resolved.bookFolder, updated)
  return next
}

export async function deleteBookAudioPin(
  bookId: string,
  pinId: string,
): Promise<{ ok: true } | { error: string; status: number }> {
  const resolved = await resolveBookAudioFolder(bookId)
  if (!resolved) return { error: 'Book not found or folder could not be resolved.', status: 404 }

  const existing = await readBookAudioPins(resolved.bookFolder)
  const next = existing.filter((pin) => pin.id !== pinId)
  if (next.length === existing.length) {
    return { error: 'Pin not found.', status: 404 }
  }
  await writeBookAudioPins(resolved.bookFolder, next)
  return { ok: true }
}

export async function deleteBookAudioPinsByTrackId(
  bookId: string,
  trackId: string,
): Promise<{ ok: true; removed: number } | { error: string; status: number }> {
  const resolved = await resolveBookAudioFolder(bookId)
  if (!resolved) return { error: 'Book not found or folder could not be resolved.', status: 404 }

  const existing = await readBookAudioPins(resolved.bookFolder)
  const next = existing.filter((pin) => pin.trackId !== trackId)
  const removed = existing.length - next.length
  if (removed === 0) {
    return { error: 'No speakers for that track.', status: 404 }
  }
  await writeBookAudioPins(resolved.bookFolder, next)
  return { ok: true, removed }
}

/**
 * Clear speakers for auto-place redo.
 * - No unitId → all pins for the book
 * - With unitId → only that unit’s pins
 */
export async function deleteBookAudioPinsForScope(
  bookId: string,
  unitId?: string | null,
): Promise<{ ok: true; removed: number } | { error: string; status: number }> {
  const resolved = await resolveBookAudioFolder(bookId)
  if (!resolved) return { error: 'Book not found or folder could not be resolved.', status: 404 }

  const existing = await readBookAudioPins(resolved.bookFolder)
  const scopeUnit = unitId?.trim() || null
  const next = scopeUnit
    ? existing.filter((pin) => pin.unitId !== scopeUnit)
    : []
  const removed = existing.length - next.length
  if (removed === 0) {
    return { ok: true, removed: 0 }
  }
  await writeBookAudioPins(resolved.bookFolder, next)
  return { ok: true, removed }
}

function sniffImageMime(bytes: Buffer): string {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png'
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp'
  }
  return 'image/jpeg'
}

export async function getListeningMarkMeta(bookId: string): Promise<
  | { ok: true; exists: false }
  | { ok: true; exists: true; contentType: string; sizeBytes: number; updatedAt: string }
  | { error: string; status: number }
> {
  const resolved = await resolveBookAudioFolder(bookId)
  if (!resolved) return { error: 'Book not found or folder could not be resolved.', status: 404 }
  const abs = listeningMarkPath(resolved.bookFolder)
  try {
    const info = await stat(abs)
    if (!info.isFile() || info.size <= 0) return { ok: true, exists: false }
    const head = await readFile(abs)
    return {
      ok: true,
      exists: true,
      contentType: sniffImageMime(head),
      sizeBytes: info.size,
      updatedAt: info.mtime.toISOString(),
    }
  } catch {
    return { ok: true, exists: false }
  }
}

export async function readListeningMarkBytes(
  bookId: string,
): Promise<{ bytes: Buffer; contentType: string } | null | { error: string; status: number }> {
  const resolved = await resolveBookAudioFolder(bookId)
  if (!resolved) return { error: 'Book not found or folder could not be resolved.', status: 404 }
  const abs = listeningMarkPath(resolved.bookFolder)
  try {
    const bytes = await readFile(abs)
    if (!bytes.length) return null
    return { bytes, contentType: sniffImageMime(bytes) }
  } catch {
    return null
  }
}

export async function saveListeningMark(params: {
  bookId: string
  buffer: Buffer
  contentType?: string
}): Promise<{ ok: true } | { error: string; status: number }> {
  const resolved = await resolveBookAudioFolder(params.bookId)
  if (!resolved) return { error: 'Book not found or folder could not be resolved.', status: 404 }
  if (params.buffer.byteLength <= 0) {
    return { error: 'Image is empty.', status: 400 }
  }
  if (params.buffer.byteLength > LISTENING_MARK_MAX_FILE_BYTES) {
    return { error: 'Mark image exceeds 2 MB limit.', status: 400 }
  }
  const dir = audioDir(resolved.bookFolder)
  await mkdir(dir, { recursive: true })
  await writeFile(listeningMarkPath(resolved.bookFolder), params.buffer)
  return { ok: true }
}

export async function deleteListeningMark(
  bookId: string,
): Promise<{ ok: true } | { error: string; status: number }> {
  const resolved = await resolveBookAudioFolder(bookId)
  if (!resolved) return { error: 'Book not found or folder could not be resolved.', status: 404 }
  try {
    await unlink(listeningMarkPath(resolved.bookFolder))
  } catch {
    return { error: 'No listening mark saved.', status: 404 }
  }
  return { ok: true }
}

/** Create many pins in one write (auto-place). Skips invalid / duplicate rows. */
export async function createBookAudioPinsBatch(params: {
  bookId: string
  pins: Array<{
    trackId: string
    unitId: string
    pdfPage: number
    center: [number, number]
  }>
}): Promise<
  | { ok: true; created: BookAudioPin[]; skippedDuplicate: number }
  | { error: string; status: number }
> {
  const resolved = await resolveBookAudioFolder(params.bookId)
  if (!resolved) return { error: 'Book not found or folder could not be resolved.', status: 404 }

  const tracks = await readBookAudioIndex(resolved.bookFolder)
  const trackIds = new Set(tracks.map((t) => t.id))
  const existing = await readBookAudioPins(resolved.bookFolder)
  const created: BookAudioPin[] = []
  let skippedDuplicate = 0
  const next = [...existing]

  for (const row of params.pins) {
    const trackId = row.trackId.trim()
    const unitId = row.unitId.trim()
    const pdfPage = Math.floor(row.pdfPage)
    if (!trackId || !unitId || !trackIds.has(trackId)) continue
    if (!Number.isFinite(pdfPage) || pdfPage < 1) continue
    if (
      next.some(
        (pin) => pin.trackId === trackId && pin.unitId === unitId && pin.pdfPage === pdfPage,
      )
    ) {
      skippedDuplicate += 1
      continue
    }
    const pin: BookAudioPin = {
      id: createPinId(params.bookId, trackId, unitId),
      trackId,
      unitId,
      pdfPage,
      center: clampAudioPinCenter(row.center),
      createdAt: new Date().toISOString(),
    }
    next.push(pin)
    created.push(pin)
  }

  if (created.length) {
    await writeBookAudioPins(resolved.bookFolder, next)
  }
  return { ok: true, created, skippedDuplicate }
}

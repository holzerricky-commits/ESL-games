/** Book-level listening playlist (tracks stored under book-library/{folder}/audio/). */

export const BOOK_AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.wav', '.ogg', '.aac'] as const

export const BOOK_AUDIO_MAX_FILE_BYTES = 50 * 1024 * 1024

/** Max size for the listening-mark crop image. */
export const LISTENING_MARK_MAX_FILE_BYTES = 2 * 1024 * 1024

/** Pages per Gemini find-mark request (same cadence as story scan). */
export const LISTENING_MARK_SCAN_CHUNK_PAGES = 2

export type ListeningMarkScanChunkPlan = {
  chunkIndex: number
  unitId: string
  unitTitle: string
  pdfPageStart: number
  pdfPageEnd: number
}

export type ListeningMarkScanPlan = {
  bookId: string
  chunkPages: number
  /** Pages considered before skip filter (full PDF span). */
  totalPages: number
  /** Pages skipped because they already had speakers (when skip requested). */
  skippedPages: number
  chunks: ListeningMarkScanChunkPlan[]
}

export const BOOK_AUDIO_MIME_BY_EXT: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.aac': 'audio/aac',
}

export interface BookAudioTrack {
  id: string
  title: string
  fileName: string
  filePath: string
  sizeBytes: number
  contentType: string
  savedAt: string
}

/** Speaker pin placed on a PDF page (book-shared, not per student). */
export interface BookAudioPin {
  id: string
  trackId: string
  unitId: string
  pdfPage: number
  center: [number, number]
  createdAt: string
}

export function clampAudioPinCenter(center: [number, number]): [number, number] {
  return [
    Math.max(0, Math.min(1, center[0])),
    Math.max(0, Math.min(1, center[1])),
  ]
}

export function listBookAudioPinsForPdfPage(
  pins: readonly BookAudioPin[],
  pdfPage: number,
): BookAudioPin[] {
  return pins.filter((pin) => pin.pdfPage === pdfPage)
}

export type AudioPinUnitRef = {
  id: string
  filePath?: string | null
}

/**
 * Speakers sit on a PDF file, not a curriculum unit.
 * One textbook PDF is often split into many units — show pins from every unit
 * that uses the same file, and drop duplicates (same track + page).
 */
export function listVisibleBookAudioPinsForUnit(
  pins: readonly BookAudioPin[],
  args: {
    unitId: string | null | undefined
    unitFilePath?: string | null
    bookUnits?: readonly AudioPinUnitRef[]
  },
): BookAudioPin[] {
  const unitId = args.unitId?.trim()
  if (!unitId) return []

  const filePath = args.unitFilePath?.trim() || ''
  const units = args.bookUnits ?? []
  const sameFileUnitIds = new Set<string>()
  if (filePath) {
    for (const unit of units) {
      if ((unit.filePath?.trim() || '') === filePath) sameFileUnitIds.add(unit.id)
    }
  }
  if (sameFileUnitIds.size === 0) sameFileUnitIds.add(unitId)

  const knownUnitIds = new Set(units.map((unit) => unit.id))
  const candidates = pins.filter((pin) => {
    if (sameFileUnitIds.has(pin.unitId)) return true
    // Stale unit id after a catalog rewrite — still show on this book.
    return knownUnitIds.size > 0 && !knownUnitIds.has(pin.unitId)
  })

  const byTrackPage = new Map<string, BookAudioPin>()
  for (const pin of candidates) {
    const key = `${pin.trackId}::${pin.pdfPage}`
    const existing = byTrackPage.get(key)
    if (!existing) {
      byTrackPage.set(key, pin)
      continue
    }
    if (pin.unitId === unitId && existing.unitId !== unitId) {
      byTrackPage.set(key, pin)
    }
  }
  return [...byTrackPage.values()]
}

export function isBookAudioExtension(ext: string): boolean {
  const lower = ext.toLowerCase()
  return (BOOK_AUDIO_EXTENSIONS as readonly string[]).includes(lower)
}

export function bookAudioContentType(ext: string, fallback?: string): string {
  const lower = ext.toLowerCase()
  return BOOK_AUDIO_MIME_BY_EXT[lower] ?? fallback ?? 'application/octet-stream'
}

export function titleFromAudioFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '').trim()
  return base || fileName
}

/** Natural sort: Track 2 before Track 10. */
export function compareAudioFileNames(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

export function sortBookAudioTracks<T extends { fileName: string }>(tracks: T[]): T[] {
  return [...tracks].sort((left, right) => compareAudioFileNames(left.fileName, right.fileName))
}

export function resolveBookFolderFromUnitPath(filePath: string): string | null {
  const normalized = filePath.replaceAll('\\', '/')
  const match = normalized.match(/^book-library\/([^/]+)\//)
  return match?.[1] ?? null
}

export function sanitizeAudioFileName(raw: string): string {
  const normalized = raw
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.+$/g, '')
  return normalized || 'track'
}

/** Strip extension and lowercase for matching. */
export function audioTrackMatchBase(fileNameOrTitle: string): string {
  const trimmed = fileNameOrTitle.trim().toLowerCase()
  // Only strip real audio extensions — do not treat ".12" in "1.12" as an extension.
  const knownExt = trimmed.match(/\.(mp3|m4a|wav|ogg|aac)$/i)
  if (knownExt) {
    return trimmed.slice(0, -knownExt[0].length).trim()
  }
  return trimmed
}

/**
 * Normalize a printed listening label for comparison.
 * "1.12", "Track 1.12", "1-12" → comparable tokens.
 */
export function normalizeListeningLabel(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^track\s*/i, '')
    .replace(/\s+/g, '')
    .replace(/[_]+/g, '.')
    .replace(/-/g, '.')
}

/** `001` → `1`, `1.02` → `1.2` (segment-wise). */
export function canonicalizeListeningNumberKey(token: string): string {
  const parts = token.split('.')
  return parts
    .map((part) => {
      if (!/^\d+$/.test(part)) return part
      const stripped = part.replace(/^0+/, '')
      return stripped === '' ? '0' : stripped
    })
    .join('.')
}

/**
 * Number-like tokens from a label or filename (longest first).
 * Prefer dotted forms like "1.12" over bare "12".
 */
export function listeningNumberTokens(raw: string): string[] {
  const normalized = normalizeListeningLabel(raw)
  if (!normalized) return []
  const tokens = new Set<string>()
  // unit.track style: 1.12, 3.4
  for (const m of normalized.matchAll(/\d+\.\d+/g)) {
    tokens.add(m[0]!)
  }
  // bare integers
  for (const m of normalized.matchAll(/\d+/g)) {
    tokens.add(m[0]!)
  }
  // full string if it is itself number-like
  if (/^\d+(\.\d+)*$/.test(normalized)) {
    tokens.add(normalized)
  }
  return [...tokens].sort((a, b) => b.length - a.length || a.localeCompare(b))
}

/**
 * Canonical keys a printed page label can match (zero-padded friendly).
 * Prefer the full printed form: "1.12" → {"1.12"} only; "1"/"001" → {"1"}.
 * Avoids bare segment keys ("1","12") that would collide across unit.track files.
 */
export function printedListeningMatchKeys(printedLabel: string): Set<string> {
  const keys = new Set<string>()
  const labelNorm = normalizeListeningLabel(printedLabel)
  if (!labelNorm) return keys

  if (/^\d+(\.\d+)+$/.test(labelNorm)) {
    keys.add(labelNorm)
    keys.add(canonicalizeListeningNumberKey(labelNorm))
    return keys
  }

  if (/^\d+$/.test(labelNorm)) {
    keys.add(labelNorm)
    keys.add(canonicalizeListeningNumberKey(labelNorm))
    return keys
  }

  for (const token of listeningNumberTokens(printedLabel)) {
    keys.add(canonicalizeListeningNumberKey(token))
  }
  return keys
}

/**
 * Primary track number identity from a publisher-style file name.
 * Prefers trailing dotted form (`1.12`), else the last number (`…_SB_001` → `1`).
 */
export function primaryTrackListeningKey(fileNameOrTitle: string): string | null {
  const base = audioTrackMatchBase(fileNameOrTitle)
  const n = normalizeListeningLabel(base)
  if (!n) return null

  if (/^\d+(\.\d+)*$/.test(n)) {
    return canonicalizeListeningNumberKey(n)
  }

  const endDotted = n.match(/(\d+\.\d+)$/)
  if (endDotted?.[1]) return canonicalizeListeningNumberKey(endDotted[1])

  const endBare = n.match(/(\d+)$/)
  if (endBare?.[1]) return canonicalizeListeningNumberKey(endBare[1])

  const dotted = [...n.matchAll(/\d+\.\d+/g)]
  if (dotted.length) {
    return canonicalizeListeningNumberKey(dotted[dotted.length - 1]![0]!)
  }

  const ints = [...n.matchAll(/\d+/g)]
  if (ints.length) {
    return canonicalizeListeningNumberKey(ints[ints.length - 1]![0]!)
  }

  return null
}

export type MatchTrackByListeningLabelResult<T extends { id: string; title: string; fileName: string }> =
  | { ok: true; track: T }
  | { ok: false; reason: 'empty' | 'none' | 'ambiguous' }

/**
 * Match a printed listening number to exactly one uploaded track.
 * Uses the track’s primary number identity (usually the trailing digits in the file name),
 * with zero-padding ignored (`001` = `1`). No weak substring guessing.
 */
export function matchTrackByListeningLabel<T extends { id: string; title: string; fileName: string }>(
  printedLabel: string,
  tracks: readonly T[],
): MatchTrackByListeningLabelResult<T> {
  const labelNorm = normalizeListeningLabel(printedLabel)
  if (!labelNorm) return { ok: false, reason: 'empty' }

  const labelKeys = printedListeningMatchKeys(printedLabel)
  if (!labelKeys.size) return { ok: false, reason: 'empty' }

  // Prefer exact base-name match first (file "1.12.mp3" vs label "1.12").
  const exactHits = tracks.filter((track) => {
    const fileBase = audioTrackMatchBase(track.fileName)
    const titleBase = audioTrackMatchBase(track.title)
    const fileNorm = normalizeListeningLabel(fileBase)
    const titleNorm = normalizeListeningLabel(titleBase)
    if (fileNorm === labelNorm || titleNorm === labelNorm) return true
    // Zero-pad friendly exact: "001" file vs printed "1"
    if (/^\d+(\.\d+)*$/.test(fileNorm) && labelKeys.has(canonicalizeListeningNumberKey(fileNorm))) {
      return true
    }
    if (/^\d+(\.\d+)*$/.test(titleNorm) && labelKeys.has(canonicalizeListeningNumberKey(titleNorm))) {
      return true
    }
    return false
  })
  if (exactHits.length === 1) return { ok: true, track: exactHits[0]! }
  if (exactHits.length > 1) return { ok: false, reason: 'ambiguous' }

  const identityHits = tracks.filter((track) => {
    const fromFile = primaryTrackListeningKey(track.fileName)
    const fromTitle = primaryTrackListeningKey(track.title)
    return (
      (fromFile != null && labelKeys.has(fromFile)) ||
      (fromTitle != null && labelKeys.has(fromTitle))
    )
  })

  if (identityHits.length === 1) return { ok: true, track: identityHits[0]! }
  if (identityHits.length > 1) return { ok: false, reason: 'ambiguous' }
  return { ok: false, reason: 'none' }
}

/** True when this track already has a pin on the same unit + PDF page. */
export function hasAudioPinOnPage(
  pins: readonly BookAudioPin[],
  trackId: string,
  unitId: string,
  pdfPage: number,
): boolean {
  return pins.some(
    (pin) => pin.trackId === trackId && pin.unitId === unitId && pin.pdfPage === pdfPage,
  )
}

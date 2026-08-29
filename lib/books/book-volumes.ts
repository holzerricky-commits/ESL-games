/**
 * Named volumes under a teaching book (optional).
 * Teaching tree stays Book → Unit → Lesson → Part; outline runs per volume PDF.
 */

import type { BookRecord, BookUnitRecord, BookVolumeRecord } from '@/lib/books/types'

export function normalizeBookFilePath(filePath: string): string {
  return filePath.trim().replaceAll('\\', '/')
}

function fileBasename(filePath: string): string {
  const normalized = normalizeBookFilePath(filePath)
  const slash = normalized.lastIndexOf('/')
  return slash >= 0 ? normalized.slice(slash + 1) : normalized
}

function slugFromFilePath(filePath: string, index: number): string {
  const s = fileBasename(filePath)
    .replace(/\.pdf$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
  return s || `vol-${index + 1}`
}

export function newBookVolumeId(filePath: string, index: number): string {
  return `vol-${slugFromFilePath(filePath, index)}`
}

/** Distinct non-empty unit file paths in book order (first-seen). */
export function distinctUnitFilePaths(book: Pick<BookRecord, 'units'>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const unit of book.units) {
    const path = typeof unit.filePath === 'string' ? normalizeBookFilePath(unit.filePath) : ''
    if (!path || seen.has(path)) continue
    seen.add(path)
    out.push(path)
  }
  return out
}

function volumeTitleForPath(
  filePath: string,
  units: BookUnitRecord[],
  bookUnitIndexById: Map<string, number>,
): string {
  if (units.length === 0) {
    return fileBasename(filePath).replace(/\.pdf$/i, '') || 'Volume'
  }
  if (units.length === 1) {
    return units[0]!.title.trim() || 'Unit 1'
  }
  const indexes = units
    .map((u) => bookUnitIndexById.get(u.id))
    .filter((n): n is number => typeof n === 'number')
    .sort((a, b) => a - b)
  if (indexes.length >= 2) {
    const first = indexes[0]! + 1
    const last = indexes[indexes.length - 1]! + 1
    if (last > first) return `Units ${first}–${last}`
  }
  return units.map((u) => u.title.trim()).filter(Boolean).join(', ') || 'Volume'
}

/**
 * Build volumes from distinct unit file paths and attach volumeId on each unit.
 * Always returns volumes when there is at least one path (caller decides whether to persist).
 */
export function synthesizeVolumesFromUnits(book: BookRecord): {
  volumes: BookVolumeRecord[]
  units: BookUnitRecord[]
} {
  const paths = distinctUnitFilePaths(book)
  const bookUnitIndexById = new Map(book.units.map((u, i) => [u.id, i]))
  const volumes: BookVolumeRecord[] = paths.map((filePath, index) => {
    const unitsOnPath = book.units.filter(
      (u) => normalizeBookFilePath(u.filePath ?? '') === filePath,
    )
    return {
      id: newBookVolumeId(filePath, index),
      title: volumeTitleForPath(filePath, unitsOnPath, bookUnitIndexById),
      filePath,
    }
  })
  const volumeIdByPath = new Map(volumes.map((v) => [v.filePath, v.id]))
  const units = book.units.map((unit) => {
    const path = normalizeBookFilePath(unit.filePath ?? '')
    const volumeId = path ? volumeIdByPath.get(path) : undefined
    if (!volumeId) {
      const { volumeId: _drop, ...rest } = unit
      return rest
    }
    return { ...unit, volumeId, filePath: path }
  })
  return { volumes, units }
}

/** Sync each unit.filePath from its volume (when volumeId resolves). */
export function syncUnitFilePathsFromVolumes(book: BookRecord): BookRecord {
  const volumes = book.volumes
  if (!volumes?.length) return book
  const byId = new Map(volumes.map((v) => [v.id, v]))
  return {
    ...book,
    units: book.units.map((unit) => {
      const vol = unit.volumeId ? byId.get(unit.volumeId) : undefined
      if (!vol) return unit
      return { ...unit, filePath: normalizeBookFilePath(vol.filePath) }
    }),
  }
}

/**
 * Ensure the book has a volume for each path (and units linked).
 * Used after cut / add PDF. Paths already on the book are kept; new paths get volumes.
 */
export function ensureVolumesForFilePaths(book: BookRecord, filePaths: string[]): BookRecord {
  const wanted = [
    ...new Set(
      filePaths
        .map((p) => normalizeBookFilePath(p))
        .filter(Boolean),
    ),
  ]
  if (wanted.length === 0) return book

  const existing = book.volumes ? [...book.volumes] : []
  const byPath = new Map(existing.map((v) => [normalizeBookFilePath(v.filePath), v]))

  for (let i = 0; i < wanted.length; i++) {
    const filePath = wanted[i]!
    if (byPath.has(filePath)) continue
    const unitsOnPath = book.units.filter(
      (u) => normalizeBookFilePath(u.filePath ?? '') === filePath,
    )
    const bookUnitIndexById = new Map(book.units.map((u, idx) => [u.id, idx]))
    const vol: BookVolumeRecord = {
      id: newBookVolumeId(filePath, existing.length + i),
      title: volumeTitleForPath(filePath, unitsOnPath, bookUnitIndexById),
      filePath,
    }
    existing.push(vol)
    byPath.set(filePath, vol)
  }

  // Multi-file (or explicit ensure with 2+ paths) → persist volumes.
  // Single path with no prior volumes → leave classic book (no volumes field).
  if (existing.length < 2 && (!book.volumes || book.volumes.length === 0) && wanted.length < 2) {
    return {
      ...book,
      units: book.units.map((unit) => {
        const { volumeId: _drop, ...rest } = unit
        return rest
      }),
    }
  }

  const volumeIdByPath = new Map(
    existing.map((v) => [normalizeBookFilePath(v.filePath), v.id]),
  )
  const units = book.units.map((unit) => {
    const path = normalizeBookFilePath(unit.filePath ?? '')
    const volumeId = path ? volumeIdByPath.get(path) : unit.volumeId
    if (!volumeId) return unit
    return { ...unit, volumeId, filePath: path || unit.filePath }
  })

  return syncUnitFilePathsFromVolumes({
    ...book,
    volumes: existing,
    units,
  })
}

/**
 * On load: if volumes missing and 2+ distinct unit files, synthesize volumes.
 * If volumes present, sync unit filePaths and fill missing volumeIds.
 * Single-file books stay without volumes.
 */
export function migrateBookVolumes(book: BookRecord): BookRecord {
  const paths = distinctUnitFilePaths(book)

  if (book.volumes && book.volumes.length > 0) {
    const volumes = book.volumes.map((v, i) => ({
      id: typeof v.id === 'string' && v.id.trim() ? v.id.trim() : newBookVolumeId(v.filePath, i),
      title: typeof v.title === 'string' && v.title.trim() ? v.title.trim() : `Volume ${i + 1}`,
      filePath: normalizeBookFilePath(v.filePath),
    }))
    const volumeIdByPath = new Map(volumes.map((v) => [v.filePath, v.id]))
    const units = book.units.map((unit) => {
      const path = normalizeBookFilePath(unit.filePath ?? '')
      const existingVolumeId = typeof unit.volumeId === 'string' ? unit.volumeId.trim() : ''
      const fromVolume =
        (existingVolumeId
          ? volumes.find((v) => v.id === existingVolumeId)
          : undefined) ?? (path ? volumes.find((v) => v.filePath === path) : undefined)
      const volumeId = fromVolume?.id ?? (path ? volumeIdByPath.get(path) : undefined)
      if (!volumeId) return { ...unit, filePath: path || unit.filePath }
      return {
        ...unit,
        volumeId,
        filePath: (fromVolume?.filePath ?? path) || unit.filePath,
      }
    })
    return syncUnitFilePathsFromVolumes({ ...book, volumes, units })
  }

  if (paths.length < 2) {
    // Classic single-PDF (or empty): drop stray volumeIds.
    return {
      ...book,
      units: book.units.map((unit) => {
        if (!unit.volumeId) return unit
        const { volumeId: _drop, ...rest } = unit
        return rest
      }),
    }
  }

  const { volumes, units } = synthesizeVolumesFromUnits(book)
  return { ...book, volumes, units }
}

/** Volumes for UI: explicit list, or inferred when multi-file without migration yet. */
export function listBookVolumes(book: BookRecord): BookVolumeRecord[] {
  if (book.volumes && book.volumes.length > 0) return book.volumes
  const paths = distinctUnitFilePaths(book)
  if (paths.length < 2) return []
  return synthesizeVolumesFromUnits(book).volumes
}

export function findBookVolume(
  book: BookRecord,
  volumeId: string | null | undefined,
): BookVolumeRecord | null {
  if (!volumeId?.trim()) return null
  return listBookVolumes(book).find((v) => v.id === volumeId.trim()) ?? null
}

export function unitsForVolume(book: BookRecord, volumeId: string): BookUnitRecord[] {
  const vol = findBookVolume(book, volumeId)
  if (!vol) return []
  const path = normalizeBookFilePath(vol.filePath)
  return book.units.filter((unit) => {
    if (unit.volumeId === vol.id) return true
    return normalizeBookFilePath(unit.filePath ?? '') === path
  })
}

/** True when none of this volume’s units have lessons yet. */
export function volumeNeedsOutline(book: BookRecord, volumeId: string): boolean {
  const units = unitsForVolume(book, volumeId)
  if (units.length === 0) return true
  return !units.some((u) => (u.lessons?.length ?? 0) > 0)
}

export function firstVolumeNeedingOutline(book: BookRecord): BookVolumeRecord | null {
  for (const vol of listBookVolumes(book)) {
    if (volumeNeedsOutline(book, vol.id)) return vol
  }
  return null
}

export function bookHasMultipleVolumes(book: BookRecord): boolean {
  return listBookVolumes(book).length >= 2
}

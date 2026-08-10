/** Last-read PDF page per book/unit. */
export type ReaderProgressDiskPayload = {
  progress: Record<string, Record<string, { page?: unknown; updatedAt?: unknown }>>
}

export function emptyReaderProgressDiskPayload(): ReaderProgressDiskPayload {
  return { progress: {} }
}

export function normalizeReaderProgressDiskPayload(raw: unknown): ReaderProgressDiskPayload {
  const empty = emptyReaderProgressDiskPayload()
  // Legacy browser shape: bare book → unit → entry map
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && !('progress' in (raw as object))) {
    return { progress: sanitizeProgressMap(raw as Record<string, unknown>) }
  }
  if (!raw || typeof raw !== 'object') return empty
  const o = raw as Record<string, unknown>
  if (!o.progress || typeof o.progress !== 'object' || Array.isArray(o.progress)) return empty
  return { progress: sanitizeProgressMap(o.progress as Record<string, unknown>) }
}

function sanitizeProgressMap(
  raw: Record<string, unknown>,
): ReaderProgressDiskPayload['progress'] {
  const progress: ReaderProgressDiskPayload['progress'] = {}
  for (const [bookId, byUnitRaw] of Object.entries(raw)) {
    if (!bookId.trim() || !byUnitRaw || typeof byUnitRaw !== 'object' || Array.isArray(byUnitRaw)) {
      continue
    }
    const byUnit: Record<string, { page?: unknown; updatedAt?: unknown }> = {}
    for (const [unitId, entryRaw] of Object.entries(byUnitRaw as Record<string, unknown>)) {
      if (!unitId.trim() || !entryRaw || typeof entryRaw !== 'object' || Array.isArray(entryRaw)) {
        continue
      }
      const entry = entryRaw as { page?: unknown; updatedAt?: unknown }
      byUnit[unitId] = {
        page: entry.page,
        updatedAt: entry.updatedAt,
      }
    }
    if (Object.keys(byUnit).length > 0) progress[bookId] = byUnit
  }
  return progress
}

export function isReaderProgressDiskPayloadEmpty(payload: ReaderProgressDiskPayload): boolean {
  return Object.keys(payload.progress).length === 0
}

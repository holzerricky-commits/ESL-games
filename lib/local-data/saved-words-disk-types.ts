/** Words saved from the book, keyed by student id. */
export type SavedWordsDiskPayload = {
  byStudent: Record<string, unknown[]>
}

/** Pre-migration global list (browser had one notebook for all students). */
export const SAVED_WORDS_LEGACY_SCOPE = '__legacy__'

export function emptySavedWordsDiskPayload(): SavedWordsDiskPayload {
  return { byStudent: {} }
}

export function normalizeSavedWordsDiskPayload(raw: unknown): SavedWordsDiskPayload {
  const empty = emptySavedWordsDiskPayload()
  // Legacy browser shape: bare array
  if (Array.isArray(raw)) {
    return { byStudent: { [SAVED_WORDS_LEGACY_SCOPE]: raw } }
  }
  if (!raw || typeof raw !== 'object') return empty
  const o = raw as Record<string, unknown>
  const byStudentRaw = o.byStudent
  if (!byStudentRaw || typeof byStudentRaw !== 'object' || Array.isArray(byStudentRaw)) {
    return empty
  }
  const byStudent: Record<string, unknown[]> = {}
  for (const [studentId, entries] of Object.entries(byStudentRaw as Record<string, unknown>)) {
    if (!studentId.trim()) continue
    byStudent[studentId] = Array.isArray(entries) ? entries : []
  }
  return { byStudent }
}

export function isSavedWordsDiskPayloadEmpty(payload: SavedWordsDiskPayload): boolean {
  return Object.values(payload.byStudent).every((entries) => entries.length === 0)
}

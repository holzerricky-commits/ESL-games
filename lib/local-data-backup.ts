/**
 * Phase 0 — snapshot / restore of browser `localStorage` keys used by this app (`esl_*`).
 * Session-only data (e.g. map viewport in sessionStorage) is not included.
 */

export const ESL_LOCAL_STORAGE_KEY_PATTERN = /^esl_[a-zA-Z0-9_:.-]+$/

export const LOCAL_DATA_BACKUP_KIND = 'esl-local-data-backup' as const

export type LocalDataBackupPayload = {
  kind: typeof LOCAL_DATA_BACKUP_KIND
  version: 1
  exportedAt: string
  /** Raw string values from localStorage (JSON strings for structured data). */
  localStorage: Record<string, string>
}

export function collectEslLocalStorageSnapshot(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const out: Record<string, string> = {}
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i)
    if (!key || !ESL_LOCAL_STORAGE_KEY_PATTERN.test(key)) continue
    const value = window.localStorage.getItem(key)
    if (value !== null) out[key] = value
  }
  return out
}

export function buildBackupPayload(): LocalDataBackupPayload {
  return {
    kind: LOCAL_DATA_BACKUP_KIND,
    version: 1,
    exportedAt: new Date().toISOString(),
    localStorage: collectEslLocalStorageSnapshot(),
  }
}

/** Merges disk-backed student records when running locally (`npm run dev`). */
export async function buildBackupPayloadAsync(): Promise<LocalDataBackupPayload> {
  const payload = buildBackupPayload()
  if (typeof window === 'undefined') return payload
  try {
    const [studentsRes, progressRes] = await Promise.all([
      fetch('/api/local-data/students', { cache: 'no-store' }),
      fetch('/api/local-data/student-progress', { cache: 'no-store' }),
    ])
    if (studentsRes.ok) {
      const data = (await studentsRes.json()) as { students?: unknown[] }
      if (Array.isArray(data.students)) {
        payload.localStorage.esl_students = JSON.stringify(data.students)
      }
    }
    if (progressRes.ok) {
      const data = (await progressRes.json()) as { progress?: Record<string, unknown> }
      if (data.progress && typeof data.progress === 'object') {
        payload.localStorage.esl_student_progress = JSON.stringify(data.progress)
      }
    }
  } catch {
    /* keep browser-only snapshot */
  }
  return payload
}

export function validateBackupPayload(data: unknown): LocalDataBackupPayload | null {
  if (!data || typeof data !== 'object') return null
  const o = data as Record<string, unknown>
  const local = o.localStorage
  if (local !== undefined && local !== null && typeof local !== 'object') return null
  const entries = (local ?? {}) as Record<string, unknown>
  for (const key of Object.keys(entries)) {
    if (!ESL_LOCAL_STORAGE_KEY_PATTERN.test(key)) return null
    const v = entries[key]
    if (typeof v !== 'string') return null
  }
  if (o.kind !== LOCAL_DATA_BACKUP_KIND && o.kind !== undefined) return null
  if (o.version !== 1 && o.version !== undefined) return null
  return {
    kind: LOCAL_DATA_BACKUP_KIND,
    version: 1,
    exportedAt: typeof o.exportedAt === 'string' ? o.exportedAt : 'unknown',
    localStorage: Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, String(v)])),
  }
}

/** Apply backup: only writes keys present in the payload (does not delete other `esl_*` keys). */
export function applyBackupPayload(payload: LocalDataBackupPayload): { keysWritten: number } {
  if (typeof window === 'undefined') return { keysWritten: 0 }
  let keysWritten = 0
  for (const [key, value] of Object.entries(payload.localStorage)) {
    if (!ESL_LOCAL_STORAGE_KEY_PATTERN.test(key)) continue
    window.localStorage.setItem(key, value)
    keysWritten += 1
  }
  return { keysWritten }
}

async function applyDiskStudentRecordsFromBackup(payload: LocalDataBackupPayload): Promise<void> {
  const studentsRaw = payload.localStorage.esl_students
  if (studentsRaw) {
    try {
      const students = JSON.parse(studentsRaw) as unknown[]
      if (Array.isArray(students)) {
        await fetch('/api/local-data/students', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ students }),
        })
      }
    } catch {
      /* ignore */
    }
  }
  const progressRaw = payload.localStorage.esl_student_progress
  if (progressRaw) {
    try {
      const progress = JSON.parse(progressRaw) as Record<string, unknown>
      if (progress && typeof progress === 'object' && !Array.isArray(progress)) {
        await fetch('/api/local-data/student-progress', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ progress }),
        })
      }
    } catch {
      /* ignore */
    }
  }
}

/** Writes backup to browser storage and to on-disk student files when the local API is available. */
export async function applyBackupPayloadAsync(payload: LocalDataBackupPayload): Promise<{ keysWritten: number }> {
  const result = applyBackupPayload(payload)
  await applyDiskStudentRecordsFromBackup(payload)
  return result
}

export function downloadBackupJson(filename?: string): void {
  if (typeof window === 'undefined') return
  const payload = buildBackupPayload()
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = payload.exportedAt.slice(0, 19).replace(/[:T]/g, '-')
  a.href = url
  a.download = filename ?? `esl-backup-${stamp}.json`
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function downloadBackupJsonAsync(filename?: string): Promise<LocalDataBackupPayload> {
  if (typeof window === 'undefined') {
    return buildBackupPayload()
  }
  const payload = await buildBackupPayloadAsync()
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = payload.exportedAt.slice(0, 19).replace(/[:T]/g, '-')
  a.href = url
  a.download = filename ?? `esl-backup-${stamp}.json`
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return payload
}

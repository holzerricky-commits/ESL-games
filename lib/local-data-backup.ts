/**
 * Phase 0 — snapshot / restore of browser `localStorage` keys used by this app (`esl_*`).
 * Session-only data (e.g. map viewport in sessionStorage) is not included.
 */

export const ESL_LOCAL_STORAGE_KEY_PATTERN = /^esl_[a-zA-Z0-9_:.-]+$/

export const LOCAL_DATA_BACKUP_KIND = 'esl-local-data-backup' as const

/** Backup-only keys for session ink (live keys omit the `esl_` prefix). */
const BACKUP_SPREAD_SESSIONS_KEY = 'esl_book_spread_sessions_v1'
const BACKUP_WHITEBOARD_SESSIONS_KEY = 'esl_book_whiteboard_sessions_v1'
const LIVE_SPREAD_SESSIONS_KEY = 'bookSpreadSessionV1'
const LIVE_WHITEBOARD_SESSIONS_KEY = 'bookWhiteboardInkSessionV1'

export type LocalDataBackupPayload = {
  kind: typeof LOCAL_DATA_BACKUP_KIND
  version: 1
  exportedAt: string
  /** Raw string values as returned by `localStorage.getItem` (JSON strings for structured data). */
  localStorage: Record<string, string | null>
}

export function collectEslLocalStorageSnapshot(): Record<string, string | null> {
  if (typeof window === 'undefined') return {}
  const out: Record<string, string | null> = {}
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i)
    if (!key || !ESL_LOCAL_STORAGE_KEY_PATTERN.test(key)) continue
    out[key] = window.localStorage.getItem(key)
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

/** Merges disk-backed teacher data when running locally (`npm run dev`). */
export async function buildBackupPayloadAsync(): Promise<LocalDataBackupPayload> {
  const payload = buildBackupPayload()
  if (typeof window === 'undefined') return payload
  try {
    const [
      studentsRes,
      progressRes,
      annotationsRes,
      scheduleRes,
      challengeRes,
      savedWordsRes,
      boardLinksRes,
      readerProgressRes,
    ] = await Promise.all([
      fetch('/api/local-data/students', { cache: 'no-store' }),
      fetch('/api/local-data/student-progress', { cache: 'no-store' }),
      fetch('/api/local-data/book-annotations', { cache: 'no-store' }),
      fetch('/api/local-data/weekly-schedule', { cache: 'no-store' }),
      fetch('/api/local-data/challenge-data', { cache: 'no-store' }),
      fetch('/api/local-data/saved-words', { cache: 'no-store' }),
      fetch('/api/local-data/lesson-board-links', { cache: 'no-store' }),
      fetch('/api/local-data/reader-progress', { cache: 'no-store' }),
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
    if (annotationsRes.ok) {
      const data = (await annotationsRes.json()) as {
        annotations?: unknown
        spreadSessions?: unknown
        whiteboardSessions?: unknown
      }
      if (data.annotations && typeof data.annotations === 'object') {
        payload.localStorage.esl_book_annotations_v2 = JSON.stringify(data.annotations)
      }
      if (data.spreadSessions && typeof data.spreadSessions === 'object') {
        payload.localStorage[BACKUP_SPREAD_SESSIONS_KEY] = JSON.stringify(data.spreadSessions)
      }
      if (data.whiteboardSessions && typeof data.whiteboardSessions === 'object') {
        payload.localStorage[BACKUP_WHITEBOARD_SESSIONS_KEY] = JSON.stringify(data.whiteboardSessions)
      }
    }
    if (scheduleRes.ok) {
      const data = (await scheduleRes.json()) as {
        config?: Record<string, unknown> | null
        assignments?: unknown[]
      }
      if (data.config && typeof data.config === 'object') {
        payload.localStorage.esl_weekly_schedule_config = JSON.stringify(data.config)
      }
      if (Array.isArray(data.assignments)) {
        payload.localStorage.esl_weekly_slot_assignments = JSON.stringify(data.assignments)
      }
    }
    if (challengeRes.ok) {
      const data = (await challengeRes.json()) as { quizzes?: unknown[]; results?: unknown[] }
      if (Array.isArray(data.quizzes)) {
        payload.localStorage.esl_quizzes = JSON.stringify(data.quizzes)
      }
      if (Array.isArray(data.results)) {
        payload.localStorage.esl_student_results = JSON.stringify(data.results)
      }
    }
    if (savedWordsRes.ok) {
      const data = (await savedWordsRes.json()) as { byStudent?: Record<string, unknown[]> }
      if (data.byStudent && typeof data.byStudent === 'object') {
        payload.localStorage.esl_saved_words_v1 = JSON.stringify({ byStudent: data.byStudent })
      }
    }
    if (boardLinksRes.ok) {
      const data = (await boardLinksRes.json()) as { links?: Record<string, unknown[]> }
      if (data.links && typeof data.links === 'object') {
        payload.localStorage.esl_lesson_board_page_links_v1 = JSON.stringify({ links: data.links })
      }
    }
    if (readerProgressRes.ok) {
      const data = (await readerProgressRes.json()) as { progress?: Record<string, unknown> }
      if (data.progress && typeof data.progress === 'object') {
        payload.localStorage.esl_book_reader_progress_v1 = JSON.stringify(data.progress)
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
    if (v !== null && typeof v !== 'string') return null
  }
  if (o.kind !== LOCAL_DATA_BACKUP_KIND && o.kind !== undefined) return null
  if (o.version !== 1 && o.version !== undefined) return null
  return {
    kind: LOCAL_DATA_BACKUP_KIND,
    version: 1,
    exportedAt: typeof o.exportedAt === 'string' ? o.exportedAt : 'unknown',
    localStorage: Object.fromEntries(
      Object.entries(entries).map(([k, v]) => [k, v === null ? null : String(v)]),
    ) as Record<string, string | null>,
  }
}

/** Apply backup: only writes keys present in the payload (does not delete other `esl_*` keys). */
export function applyBackupPayload(payload: LocalDataBackupPayload): { keysWritten: number } {
  if (typeof window === 'undefined') return { keysWritten: 0 }
  let keysWritten = 0
  for (const [key, value] of Object.entries(payload.localStorage)) {
    if (!ESL_LOCAL_STORAGE_KEY_PATTERN.test(key)) continue
    if (value === null) {
      window.localStorage.removeItem(key)
    } else {
      window.localStorage.setItem(key, value)
    }
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

  const annotationsRaw = payload.localStorage.esl_book_annotations_v2
  const spreadRaw =
    payload.localStorage[BACKUP_SPREAD_SESSIONS_KEY] ??
    payload.localStorage[LIVE_SPREAD_SESSIONS_KEY]
  const whiteboardRaw =
    payload.localStorage[BACKUP_WHITEBOARD_SESSIONS_KEY] ??
    payload.localStorage[LIVE_WHITEBOARD_SESSIONS_KEY]
  if (!annotationsRaw && !spreadRaw && !whiteboardRaw) return

  try {
    let annotations: Record<string, unknown> = {}
    let spreadSessions: Record<string, unknown> = {}
    let whiteboardSessions: Record<string, unknown> = {}
    if (annotationsRaw) {
      const parsed = JSON.parse(annotationsRaw) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        annotations = parsed as Record<string, unknown>
      }
    }
    if (spreadRaw) {
      const parsed = JSON.parse(spreadRaw) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        spreadSessions = parsed as Record<string, unknown>
      }
    }
    if (whiteboardRaw) {
      const parsed = JSON.parse(whiteboardRaw) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        whiteboardSessions = parsed as Record<string, unknown>
      }
    }
    await fetch('/api/local-data/book-annotations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ annotations, spreadSessions, whiteboardSessions }),
    })
    // Live session stores use non-esl keys; restore them for browser-only fallback.
    if (typeof window !== 'undefined') {
      if (spreadRaw) localStorage.setItem(LIVE_SPREAD_SESSIONS_KEY, spreadRaw)
      if (whiteboardRaw) localStorage.setItem(LIVE_WHITEBOARD_SESSIONS_KEY, whiteboardRaw)
    }
  } catch {
    /* ignore */
  }

  const scheduleConfigRaw = payload.localStorage.esl_weekly_schedule_config
  const scheduleAssignmentsRaw = payload.localStorage.esl_weekly_slot_assignments
  if (scheduleConfigRaw || scheduleAssignmentsRaw) {
    try {
      let config: Record<string, unknown> | null = null
      let assignments: unknown[] = []
      if (scheduleConfigRaw) {
        const parsed = JSON.parse(scheduleConfigRaw) as unknown
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          config = parsed as Record<string, unknown>
        }
      }
      if (scheduleAssignmentsRaw) {
        const parsed = JSON.parse(scheduleAssignmentsRaw) as unknown
        if (Array.isArray(parsed)) assignments = parsed
      }
      await fetch('/api/local-data/weekly-schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config, assignments }),
      })
    } catch {
      /* ignore */
    }
  }

  const quizzesRaw = payload.localStorage.esl_quizzes
  const resultsRaw = payload.localStorage.esl_student_results
  if (quizzesRaw || resultsRaw) {
    try {
      let quizzes: unknown[] = []
      let results: unknown[] = []
      if (quizzesRaw) {
        const parsed = JSON.parse(quizzesRaw) as unknown
        if (Array.isArray(parsed)) quizzes = parsed
      }
      if (resultsRaw) {
        const parsed = JSON.parse(resultsRaw) as unknown
        if (Array.isArray(parsed)) results = parsed
      }
      await fetch('/api/local-data/challenge-data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizzes, results }),
      })
    } catch {
      /* ignore */
    }
  }

  const savedWordsRaw = payload.localStorage.esl_saved_words_v1
  if (savedWordsRaw) {
    try {
      const parsed = JSON.parse(savedWordsRaw) as unknown
      await fetch('/api/local-data/saved-words', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      })
    } catch {
      /* ignore */
    }
  }

  const boardLinksRaw = payload.localStorage.esl_lesson_board_page_links_v1
  if (boardLinksRaw) {
    try {
      const parsed = JSON.parse(boardLinksRaw) as unknown
      await fetch('/api/local-data/lesson-board-links', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      })
    } catch {
      /* ignore */
    }
  }

  const readerProgressRaw = payload.localStorage.esl_book_reader_progress_v1
  if (readerProgressRaw) {
    try {
      const parsed = JSON.parse(readerProgressRaw) as unknown
      await fetch('/api/local-data/reader-progress', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'progress' in parsed
            ? parsed
            : { progress: parsed },
        ),
      })
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

'use client'

import { toast } from 'sonner'
import { resolveStudentAvatarUrl } from '@/lib/students/student-avatar-url'
import type { StudentProgressRecord, StudentRecord } from '@/lib/types'
import { createLatestWinsPersistQueue } from '@/lib/local-data/latest-wins-persist-queue'

const STUDENTS_LS_KEY = 'esl_students'
const PROGRESS_LS_KEY = 'esl_student_progress'
const PERSIST_DEBOUNCE_MS = 300
/** Browsers cap keepalive request bodies (~64KiB total in flight); stay under with margin. */
const KEEPALIVE_BODY_MAX_BYTES = 60_000

let diskActive = false
let studentsCache: StudentRecord[] | null = null
let progressCache: Record<string, StudentProgressRecord> | null = null
let hydratePromise: Promise<boolean> | null = null
let studentsPersistTimer: ReturnType<typeof setTimeout> | null = null
let progressPersistTimer: ReturnType<typeof setTimeout> | null = null
let pendingStudentsFlush: StudentRecord[] | null = null
let pendingProgressFlush: Record<string, StudentProgressRecord> | null = null

function dedupeStudents(parsed: StudentRecord[]): StudentRecord[] {
  const seen = new Set<string>()
  const deduped: StudentRecord[] = []
  for (const student of parsed) {
    if (!student || typeof student.id !== 'string' || typeof student.name !== 'string') continue
    if (seen.has(student.id)) continue
    seen.add(student.id)
    deduped.push(student)
  }
  return deduped
}

function readStudentsFromLocalStorage(): StudentRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STUDENTS_LS_KEY)
    const parsed = raw ? (JSON.parse(raw) as StudentRecord[]) : []
    return dedupeStudents(parsed)
  } catch {
    return []
  }
}

function readProgressFromLocalStorage(): Record<string, StudentProgressRecord> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(PROGRESS_LS_KEY)
    return raw ? (JSON.parse(raw) as Record<string, StudentProgressRecord>) : {}
  } catch {
    return {}
  }
}

export function isStudentRecordsDiskActive(): boolean {
  return diskActive
}

/** Fired after student records are loaded from disk into memory (safe to render lists). */
export const STUDENT_RECORDS_HYDRATED_EVENT = 'esl-student-records-hydrated'

function notifyStudentRecordsHydrated(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(STUDENT_RECORDS_HYDRATED_EVENT))
}

export function getCachedStudents(): StudentRecord[] | null {
  return studentsCache
}

export function getCachedStudentProgress(): Record<string, StudentProgressRecord> | null {
  return progressCache
}

function utf8ByteLength(text: string): number {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length
  return text.length
}

async function persistStudentsToDisk(
  students: StudentRecord[],
  opts?: { keepalive?: boolean },
): Promise<void> {
  const body = JSON.stringify({ students })
  const keepalive = Boolean(opts?.keepalive) && utf8ByteLength(body) <= KEEPALIVE_BODY_MAX_BYTES
  const res = await fetch('/api/local-data/students', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive,
  })
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(payload.error ?? `Save failed (${res.status})`)
  }
}

async function persistProgressToDisk(
  progress: Record<string, StudentProgressRecord>,
  opts?: { keepalive?: boolean },
): Promise<void> {
  const body = JSON.stringify({ progress })
  const keepalive = Boolean(opts?.keepalive) && utf8ByteLength(body) <= KEEPALIVE_BODY_MAX_BYTES
  const res = await fetch('/api/local-data/student-progress', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive,
  })
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(payload.error ?? `Save failed (${res.status})`)
  }
}

const studentsPersistQueue = createLatestWinsPersistQueue<StudentRecord[]>(async (students, meta) => {
  try {
    await persistStudentsToDisk(students, { keepalive: meta.keepalive })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Could not save students to disk.'
    toast.error(msg)
  }
})

const progressPersistQueue = createLatestWinsPersistQueue<Record<string, StudentProgressRecord>>(
  async (progress, meta) => {
    try {
      await persistProgressToDisk(progress, { keepalive: meta.keepalive })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not save student progress to disk.'
      toast.error(msg)
    }
  },
)

function scheduleStudentsPersist(students: StudentRecord[]) {
  pendingStudentsFlush = students
  if (studentsPersistTimer) clearTimeout(studentsPersistTimer)
  studentsPersistTimer = setTimeout(() => {
    studentsPersistTimer = null
    const payload = pendingStudentsFlush
    pendingStudentsFlush = null
    if (!payload) return
    studentsPersistQueue.submit(payload)
  }, PERSIST_DEBOUNCE_MS)
}

function scheduleProgressPersist(progress: Record<string, StudentProgressRecord>) {
  pendingProgressFlush = progress
  if (progressPersistTimer) clearTimeout(progressPersistTimer)
  progressPersistTimer = setTimeout(() => {
    progressPersistTimer = null
    const payload = pendingProgressFlush
    pendingProgressFlush = null
    if (!payload) return
    progressPersistQueue.submit(payload)
  }, PERSIST_DEBOUNCE_MS)
}

export function flushStudentRecordsToDisk(): void {
  if (!diskActive) return
  if (studentsPersistTimer) {
    clearTimeout(studentsPersistTimer)
    studentsPersistTimer = null
  }
  if (progressPersistTimer) {
    clearTimeout(progressPersistTimer)
    progressPersistTimer = null
  }
  const students = pendingStudentsFlush ?? studentsCache
  const progress = pendingProgressFlush ?? progressCache
  pendingStudentsFlush = null
  pendingProgressFlush = null
  // keepalive so the browser can finish the PUT during tab close / refresh.
  if (students) {
    studentsPersistQueue.submit(students, { keepalive: true })
  }
  if (progress) {
    progressPersistQueue.submit(progress, { keepalive: true })
  }
}

export function setCachedStudents(students: StudentRecord[]): void {
  studentsCache = dedupeStudents(students)
  if (diskActive) scheduleStudentsPersist(studentsCache)
}

export function setCachedStudentProgress(map: Record<string, StudentProgressRecord>): void {
  progressCache = map
  if (diskActive) scheduleProgressPersist(map)
}

/** Load students + progress from disk API; migrate out of localStorage when disk is empty. */
export async function hydrateStudentRecordsFromDisk(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (diskActive) return true
  if (hydratePromise) return hydratePromise

  hydratePromise = (async () => {
    try {
      const [studentsRes, progressRes] = await Promise.all([
        fetch('/api/local-data/students', { cache: 'no-store' }),
        fetch('/api/local-data/student-progress', { cache: 'no-store' }),
      ])
      if (!studentsRes.ok || !progressRes.ok) return false

      const studentsPayload = (await studentsRes.json()) as { students?: StudentRecord[] }
      const progressPayload = (await progressRes.json()) as { progress?: Record<string, StudentProgressRecord> }

      let students = dedupeStudents(studentsPayload.students ?? []).map((student) => ({
        ...student,
        avatarUrl: resolveStudentAvatarUrl(student.id, student.avatarUrl),
      }))
      let progress = progressPayload.progress ?? {}
      if (!progress || typeof progress !== 'object' || Array.isArray(progress)) progress = {}

      const lsStudents = readStudentsFromLocalStorage()
      const lsProgress = readProgressFromLocalStorage()
      let migrated = false

      if (students.length === 0 && lsStudents.length > 0) {
        students = lsStudents.map((student) => ({
          ...student,
          avatarUrl: resolveStudentAvatarUrl(student.id, student.avatarUrl),
        }))
        await persistStudentsToDisk(students)
        try {
          localStorage.removeItem(STUDENTS_LS_KEY)
        } catch {
          /* ignore */
        }
        migrated = true
      }

      if (Object.keys(progress).length === 0 && Object.keys(lsProgress).length > 0) {
        progress = lsProgress
        await persistProgressToDisk(progress)
        try {
          localStorage.removeItem(PROGRESS_LS_KEY)
        } catch {
          /* ignore */
        }
        migrated = true
      }

      studentsCache = students
      progressCache = progress
      diskActive = true
      notifyStudentRecordsHydrated()

      if (migrated) {
        toast.success('Student data is now saved on this PC (not in browser storage).')
      }

      return true
    } catch {
      return false
    } finally {
      if (!diskActive) hydratePromise = null
    }
  })()

  return hydratePromise
}

export async function ensureStudentRecordsHydrated(): Promise<boolean> {
  return hydrateStudentRecordsFromDisk()
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => flushStudentRecordsToDisk())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushStudentRecordsToDisk()
  })
}

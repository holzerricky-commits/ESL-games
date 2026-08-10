import {
  readAnnotationsRoot,
  writeAnnotationsRoot,
  type BookAnnotationsRoot,
} from '@/lib/books/annotation-storage'
import { requestSpreadSessionFlush } from '@/lib/books/spread-session-events'
import { requestWhiteboardSessionFlush } from '@/lib/books/whiteboard-session-events'
import { setInkSessionPageFlushEnabled } from '@/lib/books/ink-session-flush-gate'
import {
  flushBookAnnotationsToDiskAsync,
  getBookAnnotationsDiskCache,
  isBookAnnotationsDiskActive,
  setBookAnnotationsDiskCache,
  SPREAD_SESSION_STORAGE_KEY,
  WHITEBOARD_INK_SESSION_STORAGE_KEY,
} from '@/lib/local-data/book-annotations-disk-client'
import type { BookAnnotationsDiskPayload } from '@/lib/local-data/book-annotations-disk-types'

const BASELINE_PREFIX = 'esl_class_annotation_baseline_v1:'

type ClassAnnotationBaseline = {
  v: 1
  studentId: string
  classSessionId: string
  payload: BookAnnotationsDiskPayload
}

function baselineStorageKey(classSessionId: string): string {
  return `${BASELINE_PREFIX}${classSessionId.trim()}`
}

function readJsonRecord(storageKey: string): Record<string, unknown> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as Record<string, unknown>
  } catch {
    return {}
  }
}

function writeJsonRecord(storageKey: string, root: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(storageKey, JSON.stringify(root))
  } catch {
    /* quota / private mode */
  }
}

function captureCurrentPayload(): BookAnnotationsDiskPayload {
  if (isBookAnnotationsDiskActive()) {
    const disk = getBookAnnotationsDiskCache()
    if (disk) {
      return {
        annotations: structuredClone(disk.annotations),
        spreadSessions: structuredClone(disk.spreadSessions),
        whiteboardSessions: structuredClone(disk.whiteboardSessions),
      }
    }
  }
  return {
    annotations: structuredClone(readAnnotationsRoot()) as BookAnnotationsDiskPayload['annotations'],
    spreadSessions: structuredClone(readJsonRecord(SPREAD_SESSION_STORAGE_KEY)),
    whiteboardSessions: structuredClone(readJsonRecord(WHITEBOARD_INK_SESSION_STORAGE_KEY)),
  }
}

function readBaseline(classSessionId: string): ClassAnnotationBaseline | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(baselineStorageKey(classSessionId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as ClassAnnotationBaseline
    if (!parsed || parsed.v !== 1) return null
    if (typeof parsed.studentId !== 'string' || typeof parsed.classSessionId !== 'string') return null
    if (!parsed.payload || typeof parsed.payload !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

function writeBaseline(baseline: ClassAnnotationBaseline): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(baselineStorageKey(baseline.classSessionId), JSON.stringify(baseline))
  } catch {
    /* quota / private mode — discard path may be unavailable */
  }
}

/** Capture class-start marks once so “discard annotations” can roll back only this class. */
export function ensureClassAnnotationBaseline(studentId: string, classSessionId: string): void {
  const id = classSessionId.trim()
  const sid = studentId.trim()
  if (!id || !sid || typeof window === 'undefined') return
  if (readBaseline(id)) return
  writeBaseline({
    v: 1,
    studentId: sid,
    classSessionId: id,
    payload: captureCurrentPayload(),
  })
}

export function clearClassAnnotationBaseline(classSessionId: string): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(baselineStorageKey(classSessionId))
  } catch {
    /* ignore */
  }
}

/** Flush live spread + lesson-board ink into durable storage (memory/disk cache). */
export function flushAllLiveAnnotationSessions(): void {
  requestSpreadSessionFlush()
  requestWhiteboardSessionFlush()
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value)
}

/** True when marks differ from the class-start baseline (after a live flush). */
export function classAnnotationStateChangedSinceBaseline(
  studentId: string,
  classSessionId: string,
): boolean {
  const baseline = readBaseline(classSessionId)
  const current = captureCurrentPayload()
  if (!baseline || baseline.studentId !== studentId) {
    return (
      Object.keys(current.annotations).length > 0 ||
      Object.keys(current.spreadSessions).length > 0 ||
      Object.keys(current.whiteboardSessions).length > 0
    )
  }
  return (
    stableStringify(current.annotations) !== stableStringify(baseline.payload.annotations) ||
    stableStringify(current.spreadSessions) !== stableStringify(baseline.payload.spreadSessions) ||
    stableStringify(current.whiteboardSessions) !==
      stableStringify(baseline.payload.whiteboardSessions)
  )
}

function applyPayload(payload: BookAnnotationsDiskPayload): void {
  if (isBookAnnotationsDiskActive()) {
    setBookAnnotationsDiskCache(payload, { persist: true })
    return
  }
  writeAnnotationsRoot(payload.annotations as BookAnnotationsRoot)
  writeJsonRecord(SPREAD_SESSION_STORAGE_KEY, payload.spreadSessions)
  writeJsonRecord(WHITEBOARD_INK_SESSION_STORAGE_KEY, payload.whiteboardSessions)
}

/**
 * Roll marks back to class start. Suppresses live flushes so closing the reader
 * cannot overwrite the restore with in-memory ink.
 */
export function discardClassAnnotationChanges(studentId: string, classSessionId: string): boolean {
  const baseline = readBaseline(classSessionId)
  if (!baseline || baseline.studentId !== studentId) return false

  setInkSessionPageFlushEnabled(false)
  applyPayload(baseline.payload)
  clearClassAnnotationBaseline(classSessionId)

  if (typeof window !== 'undefined') {
    window.setTimeout(() => {
      setInkSessionPageFlushEnabled(true)
    }, 500)
  } else {
    setInkSessionPageFlushEnabled(true)
  }
  return true
}

export function keepClassAnnotationChanges(classSessionId: string): void {
  clearClassAnnotationBaseline(classSessionId)
}

/** Flush live ink, then force disk write when local disk mode is active. */
export async function flushAnnotationsForClassEnd(): Promise<void> {
  flushAllLiveAnnotationSessions()
  await flushBookAnnotationsToDiskAsync()
}

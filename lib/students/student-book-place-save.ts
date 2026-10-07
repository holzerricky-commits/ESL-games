import { flushStudentRecordsToDisk } from '@/lib/local-data/student-records-client'
import { saveStudentBookPlace } from '@/lib/students/selectors'

/** Coalesces rapid page turns into one student-record write. */
export const STUDENT_BOOK_PLACE_SAVE_DEBOUNCE_MS = 400

type PendingPlace = { studentId: string; bookId: string; unitId: string; pdfPage: number }

let pendingTimer: ReturnType<typeof setTimeout> | null = null
let pending: PendingPlace | null = null

export function scheduleSaveStudentBookPlace(input: PendingPlace): void {
  if (typeof window === 'undefined') return
  if (pending && pending.studentId !== input.studentId) flushPendingStudentBookPlaceSave()
  pending = input
  if (pendingTimer != null) clearTimeout(pendingTimer)
  pendingTimer = setTimeout(() => {
    pendingTimer = null
    const next = pending
    pending = null
    if (next) saveStudentBookPlace(next.studentId, next)
  }, STUDENT_BOOK_PLACE_SAVE_DEBOUNCE_MS)
}

/** Write any pending place now (book close, unit change, class end). */
export function flushPendingStudentBookPlaceSave(): void {
  if (pendingTimer != null) {
    clearTimeout(pendingTimer)
    pendingTimer = null
  }
  const next = pending
  pending = null
  if (!next) return
  saveStudentBookPlace(next.studentId, next)
  flushStudentRecordsToDisk()
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => flushPendingStudentBookPlaceSave())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPendingStudentBookPlaceSave()
  })
}

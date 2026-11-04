'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'
import {
  LESSON_AUTO_PREP_WINDOW_MS,
  pickLessonsToAutoPrep,
  readLessonAutoPrepAttempts,
  recordLessonAutoPrepAttempt,
  type LessonAutoPrepCandidate,
} from '@/lib/books/lesson-auto-prep'
import { startLessonPrepJob } from '@/lib/books/lesson-prep-manager'
import type { BookLibraryPayload } from '@/lib/books/types'
import { ensureStudentRecordsHydrated } from '@/lib/local-data/student-records-client'
import { getClassSessionsForDateRange, resolveNextSectionForClass } from '@/lib/students/selectors'

const FIRST_CHECK_DELAY_MS = 30_000
const CHECK_INTERVAL_MS = 10 * 60_000

let sweepRunning = false

function anyClassLive(): boolean {
  const now = new Date()
  return getClassSessionsForDateRange(now, now).some((row) => row.session.status === 'in_progress')
}

function collectCandidates(library: BookLibraryPayload): LessonAutoPrepCandidate[] {
  const now = new Date()
  const rows = getClassSessionsForDateRange(now, new Date(now.getTime() + LESSON_AUTO_PREP_WINDOW_MS))
  const out: LessonAutoPrepCandidate[] = []
  for (const row of rows) {
    const picked = row.session.selectedSection?.lessonId
      ? row.session.selectedSection
      : resolveNextSectionForClass(row.studentId, row.session.id, library)
    if (!picked?.lessonId) continue
    out.push({
      sessionId: row.session.id,
      studentName: row.studentName,
      scheduledFor: row.session.scheduledFor,
      status: row.session.status,
      bookId: picked.bookId,
      unitId: picked.unitId,
      lessonId: picked.lessonId,
    })
  }
  return out
}

async function fetchTotalPdfPages(bookId: string, unitId: string): Promise<number | null> {
  try {
    const res = await fetch(
      `/api/books/page-count?bookId=${encodeURIComponent(bookId)}&unitId=${encodeURIComponent(unitId)}`,
    )
    const data = (await res.json()) as { ok?: boolean; totalPdfPages?: number }
    return data.ok && typeof data.totalPdfPages === 'number' ? data.totalPdfPages : null
  } catch {
    return null
  }
}

/** One pass: prep each upcoming class's lesson in turn, soonest first. */
async function sweepUpcomingLessons(): Promise<void> {
  if (sweepRunning) return
  sweepRunning = true
  try {
    await ensureStudentRecordsHydrated()
    if (anyClassLive()) return

    const res = await fetch('/api/books')
    if (!res.ok) return
    const library = (await res.json()) as BookLibraryPayload
    const targets = pickLessonsToAutoPrep(collectCandidates(library), Date.now(), readLessonAutoPrepAttempts())

    for (const target of targets) {
      if (anyClassLive()) return
      const book = library.books.find((b) => b.id === target.bookId)
      const unit = book?.units.find((u) => u.id === target.unitId)
      const lesson = unit?.lessons?.find((l) => l.id === target.lessonId)
      if (!book || !unit?.filePath?.trim() || !lesson) continue

      const totalPdfPages = await fetchTotalPdfPages(book.id, unit.id)
      if (totalPdfPages == null) continue

      recordLessonAutoPrepAttempt(target.key)
      const time = new Date(target.scheduledFor).toLocaleTimeString('en-US', {
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit',
      })
      const contextLabel = `for ${target.studentName}\u2019s class (${time})`
      toast.message(`Prepping ${lesson.title?.trim() || 'the lesson'} ${contextLabel}\u2026`)
      await startLessonPrepJob({ book, unit, lesson, totalPdfPages, contextLabel })
    }
  } catch {
    // Next sweep tries again.
  } finally {
    sweepRunning = false
  }
}

/** Preps lessons for classes in the next 24 hours while the app is open. */
export function LessonAutoPrepWatcher() {
  useEffect(() => {
    const first = window.setTimeout(() => void sweepUpcomingLessons(), FIRST_CHECK_DELAY_MS)
    const interval = window.setInterval(() => void sweepUpcomingLessons(), CHECK_INTERVAL_MS)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(interval)
    }
  }, [])
  return null
}

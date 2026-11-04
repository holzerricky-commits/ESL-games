'use client'

import { useEffect, useState } from 'react'
import {
  dismissLessonPrepJob,
  lessonPrepJobKey,
  startLessonPrepJob,
  stopLessonPrepJob,
  subscribeLessonPrepJob,
  type LessonPrepSnapshot,
} from '@/lib/books/lesson-prep-manager'
import type { BookLessonRecord, BookRecord, BookUnitRecord } from '@/lib/books/types'

export function useLessonPrepJob(book: BookRecord, unit: BookUnitRecord, lesson: BookLessonRecord) {
  const key = lessonPrepJobKey(book.id, unit.id, lesson.id)
  const [snapshot, setSnapshot] = useState<LessonPrepSnapshot | null>(null)

  useEffect(() => subscribeLessonPrepJob(key, setSnapshot), [key])

  return {
    snapshot,
    startPrep: (totalPdfPages: number | null) => {
      void startLessonPrepJob({ book, unit, lesson, totalPdfPages })
    },
    stopPrep: () => stopLessonPrepJob(key),
    dismissPrep: () => dismissLessonPrepJob(key),
  }
}

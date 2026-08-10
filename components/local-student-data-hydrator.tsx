'use client'

import { useEffect } from 'react'
import { hydrateBookAnnotationsFromDisk } from '@/lib/local-data/book-annotations-disk-client'
import { hydrateChallengeDataFromDisk } from '@/lib/local-data/challenge-data-disk-client'
import { hydrateLessonBoardLinksFromDisk } from '@/lib/local-data/lesson-board-links-disk-client'
import { hydrateReaderProgressFromDisk } from '@/lib/local-data/reader-progress-disk-client'
import { hydrateSavedWordsFromDisk } from '@/lib/local-data/saved-words-disk-client'
import { hydrateStudentRecordsFromDisk } from '@/lib/local-data/student-records-client'
import { hydrateWeeklyScheduleFromDisk } from '@/lib/local-data/weekly-schedule-disk-client'

/** Loads teacher local data from disk when running `npm run dev` / `npm run start`. */
export function LocalStudentDataHydrator() {
  useEffect(() => {
    void hydrateStudentRecordsFromDisk()
    void hydrateBookAnnotationsFromDisk()
    void hydrateWeeklyScheduleFromDisk()
    void hydrateChallengeDataFromDisk()
    void hydrateSavedWordsFromDisk()
    void hydrateLessonBoardLinksFromDisk()
    void hydrateReaderProgressFromDisk()
  }, [])
  return null
}

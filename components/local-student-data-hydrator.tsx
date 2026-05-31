'use client'

import { useEffect } from 'react'
import { hydrateStudentRecordsFromDisk } from '@/lib/local-data/student-records-client'

/** Loads student/class records from disk when running `npm run dev` locally. */
export function LocalStudentDataHydrator() {
  useEffect(() => {
    void hydrateStudentRecordsFromDisk()
  }, [])
  return null
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import type { BookLibraryPayload } from '@/lib/books/types'
import { fetchBooksLibraryCached, getBooksLibraryCached } from '@/lib/books/fetch-books-library-cached'
import { StudentHomePage } from '@/components/students/student-home-page'
import {
  ensureStudentRecordsHydrated,
  STUDENT_RECORDS_HYDRATED_EVENT,
} from '@/lib/local-data/student-records-client'
import {
  getStudentProfileView,
  getStudentSetupStatus,
  STUDENT_LOCAL_DATA_CHANGED_EVENT,
} from '@/lib/students/selectors'
import { resolveStudentHomeSection } from '@/lib/students/student-setup-status'

interface StudentProfileRouteClientProps {
  studentId: string
  requestedTab?: string
  forceSetup?: boolean
}

export function StudentProfileRouteClient({
  studentId,
  requestedTab,
  forceSetup = false,
}: StudentProfileRouteClientProps) {
  const [isHydrated, setIsHydrated] = useState(false)
  const [recordsReady, setRecordsReady] = useState(false)
  const [version, setVersion] = useState(0)
  const [bookLibrary, setBookLibrary] = useState<BookLibraryPayload | null>(() => getBooksLibraryCached())
  const [libraryLoading, setLibraryLoading] = useState(() => getBooksLibraryCached() === null)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  useEffect(() => {
    let cancelled = false
    void ensureStudentRecordsHydrated().then(() => {
      if (!cancelled) setRecordsReady(true)
    })
    const bump = () => setVersion((v) => v + 1)
    const onHydrated = () => {
      setRecordsReady(true)
      bump()
    }
    window.addEventListener(STUDENT_RECORDS_HYDRATED_EVENT, onHydrated)
    window.addEventListener(STUDENT_LOCAL_DATA_CHANGED_EVENT, bump)
    window.addEventListener('focus', bump)
    return () => {
      cancelled = true
      window.removeEventListener(STUDENT_RECORDS_HYDRATED_EVENT, onHydrated)
      window.removeEventListener(STUDENT_LOCAL_DATA_CHANGED_EVENT, bump)
      window.removeEventListener('focus', bump)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const cached = getBooksLibraryCached()
    if (cached) {
      setBookLibrary(cached)
      setLibraryLoading(false)
      return
    }
    setLibraryLoading(true)
    void fetchBooksLibraryCached()
      .then((lib) => {
        if (!cancelled) setBookLibrary(lib)
      })
      .catch(() => {
        if (!cancelled) setBookLibrary({ books: [] })
      })
      .finally(() => {
        if (!cancelled) setLibraryLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const student = useMemo(
    () => (isHydrated && recordsReady ? getStudentProfileView(studentId, bookLibrary) : null),
    [studentId, version, isHydrated, recordsReady, bookLibrary],
  )
  const setup = useMemo(
    () => (isHydrated && recordsReady ? getStudentSetupStatus(studentId) : null),
    [studentId, version, isHydrated, recordsReady],
  )

  if (!isHydrated || !recordsReady || !setup) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-6">
        <p className="text-sm text-muted-foreground">Loading student…</p>
      </div>
    )
  }

  if (!student) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-6">
        <p className="text-base font-semibold text-foreground">Student not found</p>
        <p className="mt-2 text-sm text-muted-foreground">
          This profile is not available yet. Return to Students and select an active student.
        </p>
      </div>
    )
  }

  const activeSection = resolveStudentHomeSection(requestedTab)

  return (
    <StudentHomePage
      student={student}
      studentId={studentId}
      activeSection={activeSection}
      onDataUpdated={() => setVersion((v) => v + 1)}
      bookLibrary={bookLibrary}
      libraryLoading={libraryLoading}
      setup={setup}
      forceSetup={forceSetup}
    />
  )
}

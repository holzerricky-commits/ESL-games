'use client'

import { useEffect, useMemo, useState } from 'react'
import type { BookLibraryPayload } from '@/lib/books/types'
import { fetchBooksLibraryCached, getBooksLibraryCached } from '@/lib/books/fetch-books-library-cached'
import { StudentPlanPage } from '@/components/students/student-plan-page'
import {
  getStudentProfileView,
  getStudentSetupStatus,
  STUDENT_LOCAL_DATA_CHANGED_EVENT,
} from '@/lib/students/selectors'
import { resolveStudentPlanTab } from '@/lib/students/student-setup-status'

interface StudentPlanRouteClientProps {
  studentId: string
  requestedTab?: string
}

export function StudentPlanRouteClient({ studentId, requestedTab }: StudentPlanRouteClientProps) {
  const [version, setVersion] = useState(0)
  const [bookLibrary, setBookLibrary] = useState<BookLibraryPayload | null>(() => getBooksLibraryCached())
  const [libraryLoading, setLibraryLoading] = useState(() => getBooksLibraryCached() === null)
  const student = useMemo(() => getStudentProfileView(studentId), [studentId, version])
  const setup = useMemo(() => getStudentSetupStatus(studentId), [studentId, version])

  useEffect(() => {
    const bump = () => setVersion((v) => v + 1)
    window.addEventListener('focus', bump)
    window.addEventListener(STUDENT_LOCAL_DATA_CHANGED_EVENT, bump)
    return () => {
      window.removeEventListener('focus', bump)
      window.removeEventListener(STUDENT_LOCAL_DATA_CHANGED_EVENT, bump)
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

  const activeTab = resolveStudentPlanTab(requestedTab)

  return (
    <StudentPlanPage
      student={student}
      studentId={studentId}
      activeTab={activeTab}
      onDataUpdated={() => setVersion((v) => v + 1)}
      bookLibrary={bookLibrary}
      libraryLoading={libraryLoading}
      setup={setup}
    />
  )
}

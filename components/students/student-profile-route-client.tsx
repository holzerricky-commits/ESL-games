'use client'

import { useEffect, useMemo, useState } from 'react'
import type { BookLibraryPayload } from '@/lib/books/types'
import { StudentProfilePage } from '@/components/students/student-profile-page'
import { getStudentDefaultBookUnitForReader, getStudentProfileView, isValidStudentProfileTab } from '@/lib/students/selectors'
import type { StudentProfileTab } from '@/lib/students/types'

interface StudentProfileRouteClientProps {
  studentId: string
  requestedTab?: string
}

export function StudentProfileRouteClient({ studentId, requestedTab }: StudentProfileRouteClientProps) {
  const [isHydrated, setIsHydrated] = useState(false)
  const [bookLibrary, setBookLibrary] = useState<BookLibraryPayload | null>(null)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  useEffect(() => {
    let cancelled = false
    void fetch('/api/books')
      .then(async (res) => {
        const payload = (await res.json()) as BookLibraryPayload | { error?: string }
        if (!res.ok || !payload || !Array.isArray((payload as BookLibraryPayload).books)) {
          return { books: [] } as BookLibraryPayload
        }
        return payload as BookLibraryPayload
      })
      .then((lib) => {
        if (!cancelled) setBookLibrary(lib)
      })
      .catch(() => {
        if (!cancelled) setBookLibrary({ books: [] })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const readerHref = useMemo(() => {
    const pick = getStudentDefaultBookUnitForReader(studentId, bookLibrary)
    if (!pick) return null
    const q = new URLSearchParams({
      student: studentId,
      book: pick.bookId,
      unit: pick.unitId,
    })
    return `/books?${q.toString()}`
  }, [studentId, bookLibrary])

  if (!isHydrated) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-6">
        <p className="text-sm text-muted-foreground">Loading student profile...</p>
      </div>
    )
  }

  const student = getStudentProfileView(studentId)
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

  const activeTab: StudentProfileTab = isValidStudentProfileTab(requestedTab) ? requestedTab : 'challenges'

  return <StudentProfilePage student={student} studentId={studentId} activeTab={activeTab} readerHref={readerHref} />
}

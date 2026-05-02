'use client'

import { useEffect, useMemo, useState } from 'react'
import type { BookLibraryPayload } from '@/lib/books/types'
import { StudentPlanPage } from '@/components/students/student-plan-page'
import { getStudentDefaultBookUnitForReader, getStudentProfileView, isValidStudentProfileTab } from '@/lib/students/selectors'
import type { StudentProfileTab } from '@/lib/students/types'

interface StudentPlanRouteClientProps {
  studentId: string
  requestedTab?: string
}

export function StudentPlanRouteClient({ studentId, requestedTab }: StudentPlanRouteClientProps) {
  const [version, setVersion] = useState(0)
  const [bookLibrary, setBookLibrary] = useState<BookLibraryPayload | null>(null)
  const student = useMemo(() => getStudentProfileView(studentId), [studentId, version])

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

  return (
    <StudentPlanPage
      student={student}
      studentId={studentId}
      activeTab={activeTab}
      onDataUpdated={() => setVersion((v) => v + 1)}
      readerHref={readerHref}
    />
  )
}

'use client'

import { useMemo, useState } from 'react'
import { StudentPlanPage } from '@/components/students/student-plan-page'
import { getStudentProfileView, isValidStudentProfileTab } from '@/lib/students/selectors'
import type { StudentProfileTab } from '@/lib/students/types'

interface StudentPlanRouteClientProps {
  studentId: string
  requestedTab?: string
}

export function StudentPlanRouteClient({ studentId, requestedTab }: StudentPlanRouteClientProps) {
  const [version, setVersion] = useState(0)
  const student = useMemo(() => getStudentProfileView(studentId), [studentId, version])

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
    />
  )
}

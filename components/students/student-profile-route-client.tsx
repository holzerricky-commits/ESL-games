'use client'

import { StudentProfilePage } from '@/components/students/student-profile-page'
import { getStudentProfileView, isValidStudentProfileTab } from '@/lib/students/selectors'
import type { StudentProfileTab } from '@/lib/students/types'

interface StudentProfileRouteClientProps {
  studentId: string
  requestedTab?: string
}

export function StudentProfileRouteClient({ studentId, requestedTab }: StudentProfileRouteClientProps) {
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

  const activeTab: StudentProfileTab = isValidStudentProfileTab(requestedTab) ? requestedTab : 'overview'

  return <StudentProfilePage student={student} studentId={studentId} activeTab={activeTab} />
}

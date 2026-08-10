'use client'

import { TeacherFirstClassWelcomeToggle } from '@/components/students/teacher-first-class-welcome-toggle'
import { TeacherStudentDeletePanel } from '@/components/students/teacher-student-delete-panel'
import type { StudentProfileView } from '@/lib/students/types'

interface StudentHomeSettingsSectionProps {
  student: StudentProfileView
  studentId: string
  onDataUpdated?: () => void
}

export function StudentHomeSettingsSection({
  student,
  studentId,
  onDataUpdated,
}: StudentHomeSettingsSectionProps) {
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <section className="space-y-4">
        <h3 className="text-sm font-medium text-foreground">Class welcome</h3>
        <TeacherFirstClassWelcomeToggle
          student={student}
          studentId={studentId}
          onUpdated={() => onDataUpdated?.()}
        />
      </section>

      <section className="space-y-4 border-t border-border pt-6">
        <h3 className="text-sm font-medium text-foreground">Remove student</h3>
        <TeacherStudentDeletePanel studentId={studentId} studentName={student.name} />
      </section>
    </div>
  )
}

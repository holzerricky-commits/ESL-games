'use client'

import { Button } from '@/components/ui/button'
import { TeacherDifficultyStripInline } from '@/components/students/teacher-difficulty-strip-inline'
import { TeacherFirstClassWelcomeToggle } from '@/components/students/teacher-first-class-welcome-toggle'
import { TeacherStudentDeletePanel } from '@/components/students/teacher-student-delete-panel'
import type { StudentProfileView } from '@/lib/students/types'

interface StudentInfoTabProps {
  student: StudentProfileView
  studentId: string
  onDataUpdated?: () => void
}

export function StudentInfoTab({ student, studentId, onDataUpdated }: StudentInfoTabProps) {
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
        <p className="text-sm font-semibold text-foreground">About you</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Your teacher sets your path and defaults from the class prep screen. More profile details coming later.
        </p>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
        <p className="text-sm text-muted-foreground">Class group: --</p>
        <p className="mt-1 text-sm text-muted-foreground">Notes: --</p>
      </div>

      <Button variant="outline" disabled>
        Edit info (coming soon)
      </Button>

      <section className="space-y-4 border-t border-[var(--border)] pt-8">
        <h3 className="text-sm font-medium text-foreground">Teacher settings</h3>
        <div className="ui-section">
          <p className="text-sm font-medium text-foreground">Default quiz difficulty</p>
          <div className="mt-3">
            <TeacherDifficultyStripInline
              student={student}
              studentId={studentId}
              onUpdated={() => onDataUpdated?.()}
            />
          </div>
        </div>
        <TeacherFirstClassWelcomeToggle
          student={student}
          studentId={studentId}
          onUpdated={() => onDataUpdated?.()}
        />
        <TeacherStudentDeletePanel studentId={studentId} studentName={student.name} />
      </section>
    </div>
  )
}

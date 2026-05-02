import Link from 'next/link'
import { StudentProfileHeader } from '@/components/students/student-profile-header'
import { StudentPlanTabs } from '@/components/students/student-plan-tabs'
import type { StudentProfileTab, StudentProfileView } from '@/lib/students/types'

interface StudentPlanPageProps {
  student: StudentProfileView
  studentId: string
  activeTab: StudentProfileTab
  onDataUpdated: () => void
  readerHref?: string | null
}

export function StudentPlanPage({ student, studentId, activeTab, onDataUpdated, readerHref }: StudentPlanPageProps) {
  const teacherPlanIntro = (
    <>
      <span className="font-semibold text-foreground">Teacher · Plan challenge path</span>
      <span className="mx-2 text-[var(--border)]">·</span>
      Assign quizzes in order. Students will use the{' '}
      <Link href={`/students/${studentId}`} className="font-medium text-[var(--brand-blue)] hover:underline">
        student profile
      </Link>{' '}
      to play and learn.
    </>
  )

  return (
    <>
      <StudentProfileHeader student={student} teacherPlanIntro={teacherPlanIntro} readerHref={readerHref} />
      <div className="mx-auto w-full max-w-7xl">
        <StudentPlanTabs student={student} studentId={studentId} activeTab={activeTab} onDataUpdated={onDataUpdated} />
      </div>
    </>
  )
}

import { StudentProfileHeader } from '@/components/students/student-profile-header'
import { StudentProfileTabs } from '@/components/students/student-profile-tabs'
import type { StudentProfileTab, StudentProfileView } from '@/lib/students/types'

interface StudentProfilePageProps {
  student: StudentProfileView
  studentId: string
  activeTab: StudentProfileTab
}

export function StudentProfilePage({ student, studentId, activeTab }: StudentProfilePageProps) {
  return (
    <>
      <StudentProfileHeader student={student} />
      <StudentProfileTabs student={student} studentId={studentId} activeTab={activeTab} />
    </>
  )
}

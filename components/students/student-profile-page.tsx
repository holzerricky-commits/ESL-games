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
      <StudentProfileHeader
        student={student}
        tabs={
          <StudentProfileTabs
            student={student}
            studentId={studentId}
            activeTab={activeTab}
            showContent={false}
            listClassName="border-[color:color-mix(in_oklab,var(--border)_70%,transparent)]"
          />
        }
      />
      <div className="mx-auto w-full max-w-7xl">
        <StudentProfileTabs student={student} studentId={studentId} activeTab={activeTab} showList={false} />
      </div>
    </>
  )
}

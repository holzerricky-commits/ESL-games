import { PageHeader } from '@/components/page-header'
import { StudentProfileRouteClient } from '@/components/students/student-profile-route-client'

interface StudentProfileRouteProps {
  params: { studentId: string }
  searchParams: { tab?: string }
}

export default function StudentProfileRoute({ params, searchParams }: StudentProfileRouteProps) {
  const { studentId } = params
  const { tab } = searchParams

  return (
    <section>
      <PageHeader
        title="Student Profile"
        description="Dedicated profile view with fast classroom-ready sections."
      />
      <StudentProfileRouteClient studentId={studentId} requestedTab={tab} />
    </section>
  )
}

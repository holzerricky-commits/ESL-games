import { PageHeader } from '@/components/page-header'
import { StudentPlanRouteClient } from '@/components/students/student-plan-route-client'

interface StudentPlanRouteProps {
  params: Promise<{ studentId: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function StudentPlanRoute({ params, searchParams }: StudentPlanRouteProps) {
  const { studentId } = await params
  const { tab } = await searchParams

  return (
    <section>
      <PageHeader
        title="Plan challenge path"
        description="Assign Timed Challenge quizzes in order. Only teachers use this screen."
      />
      <StudentPlanRouteClient studentId={studentId} requestedTab={tab} />
    </section>
  )
}

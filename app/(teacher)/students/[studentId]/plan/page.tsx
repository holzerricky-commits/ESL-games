import { StudentPlanRouteClient } from '@/components/students/student-plan-route-client'

interface StudentPlanRouteProps {
  params: Promise<{ studentId: string }>
  searchParams: Promise<{ tab?: string; setup?: string }>
}

export default async function StudentPlanRoute({ params, searchParams }: StudentPlanRouteProps) {
  const { studentId } = await params
  const { tab } = await searchParams

  return (
    <section>
      <StudentPlanRouteClient studentId={studentId} requestedTab={tab} />
    </section>
  )
}

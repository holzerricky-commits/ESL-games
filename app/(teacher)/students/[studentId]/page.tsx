import { StudentProfileRouteClient } from '@/components/students/student-profile-route-client'

interface StudentProfileRouteProps {
  params: Promise<{ studentId: string }>
  searchParams: Promise<{ tab?: string; setup?: string }>
}

export default async function StudentProfileRoute({ params, searchParams }: StudentProfileRouteProps) {
  const { studentId } = await params
  const { tab, setup } = await searchParams

  return (
    <section>
      <StudentProfileRouteClient
        studentId={studentId}
        requestedTab={tab}
        forceSetup={setup === '1'}
      />
    </section>
  )
}

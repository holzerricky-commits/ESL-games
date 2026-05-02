import { StudentFullscreenMapRouteClient } from '@/components/students/student-fullscreen-map-route-client'

interface StudentFullscreenMapRouteProps {
  params: Promise<{ studentId: string }>
  searchParams: Promise<{ intro?: string; classSession?: string }>
}

export default async function StudentFullscreenMapRoute({ params, searchParams }: StudentFullscreenMapRouteProps) {
  const { studentId } = await params
  const { intro, classSession } = await searchParams

  return (
    <StudentFullscreenMapRouteClient
      studentId={studentId}
      introMode={intro === 'mission' ? 'mission' : null}
      activeClassSessionId={typeof classSession === 'string' && classSession.trim() ? classSession.trim() : null}
    />
  )
}

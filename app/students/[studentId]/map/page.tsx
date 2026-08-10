import { StudentFullscreenMapRouteClient } from '@/components/students/student-fullscreen-map-route-client'
import { LocalStudentDataHydrator } from '@/components/local-student-data-hydrator'

interface StudentFullscreenMapRouteProps {
  params: Promise<{ studentId: string }>
  searchParams: Promise<{
    intro?: string
    classSession?: string
    openBook?: string
    book?: string
    unit?: string
    checksPrep?: string
  }>
}

export default async function StudentFullscreenMapRoute({ params, searchParams }: StudentFullscreenMapRouteProps) {
  const { studentId } = await params
  const { intro, classSession, openBook, book, unit, checksPrep } = await searchParams

  return (
    <>
      <LocalStudentDataHydrator />
      <StudentFullscreenMapRouteClient
        studentId={studentId}
        introMode={intro === 'mission' ? 'mission' : null}
        activeClassSessionId={typeof classSession === 'string' && classSession.trim() ? classSession.trim() : null}
        openBookOnEnter={openBook === '1' || openBook === 'true'}
        preferBookId={typeof book === 'string' && book.trim() ? book.trim() : null}
        preferUnitId={typeof unit === 'string' && unit.trim() ? unit.trim() : null}
        openChecksPrep={checksPrep === '1' || checksPrep === 'true'}
      />
    </>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { FantasyHUD } from '@/components/students/fantasy-hud'
import { StudentMapTab } from '@/components/students/tabs/student-map-tab'
import { getStudentProfileView } from '@/lib/students/selectors'

interface StudentFullscreenMapRouteClientProps {
  studentId: string
  introMode: 'mission' | null
}

export function StudentFullscreenMapRouteClient({ studentId, introMode }: StudentFullscreenMapRouteClientProps) {
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  if (!isHydrated) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-6">
        <p className="text-sm text-muted-foreground">Loading challenge map...</p>
      </div>
    )
  }

  const student = getStudentProfileView(studentId)
  if (!student) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-6">
        <p className="text-base font-semibold text-foreground">Student not found</p>
        <p className="mt-2 text-sm text-muted-foreground">
          This map is not available yet. Return to Students and select an active student.
        </p>
      </div>
    )
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      <div className="h-full w-full">
        <StudentMapTab key={student.id} student={student} fullscreen introMode={introMode} />
      </div>
      <FantasyHUD exitHref={`/students/${student.id}`} />
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { ClassSessionMapTimer } from '@/components/students/class-session-map-timer'
import { FantasyHUD } from '@/components/students/fantasy-hud'
import { FullscreenBookOverlay } from '@/components/students/fullscreen-book-overlay'
import { StudentMapTab } from '@/components/students/tabs/student-map-tab'
import { getStudentProfileView } from '@/lib/students/selectors'

interface StudentFullscreenMapRouteClientProps {
  studentId: string
  introMode: 'mission' | null
  /** Optional class session id from `?classSession=` (live lesson). */
  activeClassSessionId?: string | null
}

export function StudentFullscreenMapRouteClient({
  studentId,
  introMode,
  activeClassSessionId = null,
}: StudentFullscreenMapRouteClientProps) {
  const [isHydrated, setIsHydrated] = useState(false)
  const [isBookOverlayOpen, setIsBookOverlayOpen] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  /** Keep the route from scrolling the document; wheel/trackpad and mobile overscroll were revealing the page behind the map. */
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prevHtmlOverflow = html.style.overflow
    const prevBodyOverflow = body.style.overflow
    const prevHtmlOverscroll = html.style.overscrollBehavior
    const prevBodyOverscroll = body.style.overscrollBehavior
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    html.style.overscrollBehavior = 'none'
    body.style.overscrollBehavior = 'none'
    return () => {
      html.style.overflow = prevHtmlOverflow
      body.style.overflow = prevBodyOverflow
      html.style.overscrollBehavior = prevHtmlOverscroll
      body.style.overscrollBehavior = prevBodyOverscroll
    }
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

  const activeSession =
    activeClassSessionId ? student.scheduledClasses?.find((s) => s.id === activeClassSessionId) : undefined

  return (
    <div className="fixed inset-0 z-0 overflow-hidden overscroll-none bg-background">
      {activeSession?.status === 'in_progress' ? (
        <ClassSessionMapTimer
          studentId={student.id}
          session={activeSession}
          assignedBookIds={student.assignedBookIds ?? []}
        />
      ) : null}
      {/*
        Do not use flex here: FantasyHUD is `absolute inset-0` with only absolutely positioned children,
        so a flex sibling would collapse to zero height and clip the HUD. Map fills this `fixed inset-0` shell.
      */}
      <div
        className={`h-full min-h-0 w-full transition-[filter,opacity] duration-300 ${
          isBookOverlayOpen ? 'pointer-events-none blur-[3px] brightness-75' : ''
        }`}
      >
        <StudentMapTab key={student.id} student={student} fullscreen introMode={introMode} />
      </div>
      {isBookOverlayOpen ? <div className="pointer-events-none absolute inset-0 z-30 bg-black/50" /> : null}
      <FantasyHUD
        exitHref={`/students/${student.id}`}
        onOpenBook={() => setIsBookOverlayOpen(true)}
        isBookOverlayOpen={isBookOverlayOpen}
      />
      <FullscreenBookOverlay
        studentId={student.id}
        activeClassSessionId={activeSession?.status === 'in_progress' ? activeSession.id : null}
        assignedBookIds={student.assignedBookIds}
        assignedUnitRefs={student.assignedUnitRefs}
        curriculumHistory={student.curriculumHistory}
        studentName={student.name}
        open={isBookOverlayOpen}
        onClose={() => setIsBookOverlayOpen(false)}
      />
    </div>
  )
}

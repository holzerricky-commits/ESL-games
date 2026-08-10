'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { StudentProfileHeader } from '@/components/students/student-profile-header'
import { StudentPlanTabs } from '@/components/students/student-plan-tabs'
import { StudentSetupFlow } from '@/components/students/student-setup-flow'
import type { BookLibraryPayload } from '@/lib/books/types'
import type { StudentSetupStatus } from '@/lib/students/student-setup-status'
import type { StudentProfileTab, StudentProfileView } from '@/lib/students/types'

interface StudentPlanPageProps {
  student: StudentProfileView
  studentId: string
  activeTab: StudentProfileTab
  onDataUpdated: () => void
  bookLibrary?: BookLibraryPayload | null
  libraryLoading?: boolean
  setup: StudentSetupStatus
}

export function StudentPlanPage({
  student,
  studentId,
  activeTab,
  onDataUpdated,
  bookLibrary = null,
  libraryLoading = false,
  setup,
}: StudentPlanPageProps) {
  const [setupDismissed, setSetupDismissed] = useState(() => !setup.needsSetup)

  useEffect(() => {
    // Re-enter setup when the student still needs it. Do not auto-leave when
    // schedule becomes complete — Continue / dismiss is explicit.
    if (setup.needsSetup) setSetupDismissed(false)
  }, [setup.needsSetup])

  const showSetup = !setupDismissed

  if (showSetup) {
    return (
      <StudentSetupFlow
        student={student}
        setup={setup}
        bookLibrary={bookLibrary}
        libraryLoading={libraryLoading}
        onSetupUpdated={onDataUpdated}
        onFinish={() => setSetupDismissed(true)}
      />
    )
  }

  const teacherPlanIntro = (
    <>
      <span className="font-medium text-foreground">Class prep</span>
      <span className="mx-2 text-muted-foreground">·</span>
      <Link href={`/students/${studentId}`} className="text-primary hover:underline">
        Student preview
      </Link>
    </>
  )

  return (
    <>
      <PageHeader
        title="Class prep"
        description="See what’s next, pick the book section, then start or open the book."
      />
      <StudentProfileHeader student={student} teacherPlanIntro={teacherPlanIntro} />
      <div className="mx-auto w-full max-w-7xl">
        <StudentPlanTabs
          student={student}
          studentId={studentId}
          activeTab={activeTab}
          onDataUpdated={onDataUpdated}
          bookLibrary={bookLibrary}
          libraryLoading={libraryLoading}
        />
      </div>
    </>
  )
}

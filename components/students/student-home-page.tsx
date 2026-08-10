'use client'

import { useEffect, useState } from 'react'
import { StudentHomeHeader } from '@/components/students/student-home-header'
import { StudentHomeSections } from '@/components/students/student-home-sections'
import { StudentSetupFlow } from '@/components/students/student-setup-flow'
import type { BookLibraryPayload } from '@/lib/books/types'
import type { StudentSetupStatus } from '@/lib/students/student-setup-status'
import type { StudentHomeSection, StudentProfileView } from '@/lib/students/types'

interface StudentHomePageProps {
  student: StudentProfileView
  studentId: string
  activeSection: StudentHomeSection
  onDataUpdated: () => void
  bookLibrary?: BookLibraryPayload | null
  libraryLoading?: boolean
  setup: StudentSetupStatus
  /** When true (e.g. `?setup=1`), force the setup checklist even if previously dismissed. */
  forceSetup?: boolean
}

export function StudentHomePage({
  student,
  studentId,
  activeSection,
  onDataUpdated,
  bookLibrary = null,
  libraryLoading = false,
  setup,
  forceSetup = false,
}: StudentHomePageProps) {
  const [setupDismissed, setSetupDismissed] = useState(() => !setup.needsSetup && !forceSetup)

  useEffect(() => {
    if (setup.needsSetup || forceSetup) setSetupDismissed(false)
  }, [setup.needsSetup, forceSetup])

  if (!setupDismissed && setup.needsSetup) {
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

  return (
    <div className="mx-auto w-full max-w-7xl">
      <StudentHomeHeader
        student={student}
        bookLibrary={bookLibrary}
        sections={
          <StudentHomeSections
            student={student}
            studentId={studentId}
            activeSection={activeSection}
            onDataUpdated={onDataUpdated}
            bookLibrary={bookLibrary}
            libraryLoading={libraryLoading}
            showContent={false}
          />
        }
      />
      <StudentHomeSections
        student={student}
        studentId={studentId}
        activeSection={activeSection}
        onDataUpdated={onDataUpdated}
        bookLibrary={bookLibrary}
        libraryLoading={libraryLoading}
        showNav={false}
      />
    </div>
  )
}

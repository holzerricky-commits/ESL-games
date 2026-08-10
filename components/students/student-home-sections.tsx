'use client'

import Link from 'next/link'
import { StudentClassesTab } from '@/components/students/tabs/student-classes-tab'
import { StudentCurriculumTab } from '@/components/students/tabs/student-curriculum-tab'
import { StudentWordsTab } from '@/components/students/tabs/student-words-tab'
import { StudentHomeSettingsSection } from '@/components/students/student-home-settings-section'
import type { BookLibraryPayload } from '@/lib/books/types'
import type { StudentHomeSection, StudentProfileView } from '@/lib/students/types'
import { cn } from '@/lib/utils'

const HOME_SECTIONS: Array<{ value: StudentHomeSection; label: string }> = [
  { value: 'classes', label: 'Classes' },
  { value: 'curriculum', label: 'Books' },
  { value: 'words', label: 'Learning' },
  { value: 'info', label: 'Settings' },
]

interface StudentHomeSectionsProps {
  student: StudentProfileView
  studentId: string
  activeSection: StudentHomeSection
  onDataUpdated: () => void
  bookLibrary?: BookLibraryPayload | null
  libraryLoading?: boolean
  showNav?: boolean
  showContent?: boolean
  navClassName?: string
}

export function StudentHomeSections({
  student,
  studentId,
  activeSection,
  onDataUpdated,
  bookLibrary = null,
  libraryLoading = false,
  showNav = true,
  showContent = true,
  navClassName,
}: StudentHomeSectionsProps) {
  const sectionHref = (value: StudentHomeSection) => `/students/${studentId}?tab=${value}`

  return (
    <div className="flex flex-col gap-5">
      {showNav ? (
        <nav
          aria-label="Student home sections"
          className={cn(
            'flex h-auto w-full flex-wrap justify-start gap-1 rounded-none border-b border-border bg-transparent p-0',
            navClassName,
          )}
        >
          {HOME_SECTIONS.map((section) => (
            <Link
              key={section.value}
              href={sectionHref(section.value)}
              aria-current={activeSection === section.value ? 'page' : undefined}
              className={cn(
                'h-10 flex-none rounded-none border-x-0 border-t-0 border-b-2 border-transparent px-3 text-sm font-semibold text-muted-foreground transition-[color,border-color]',
                'hover:border-b-[color:color-mix(in_oklab,var(--muted-foreground)_45%,transparent)]',
                activeSection === section.value && 'border-b-primary bg-transparent text-foreground shadow-none',
              )}
            >
              {section.label}
            </Link>
          ))}
        </nav>
      ) : null}

      {showContent ? (
        <>
          {activeSection === 'classes' ? (
            <StudentClassesTab
              student={student}
              onUpdated={onDataUpdated}
              bookLibrary={bookLibrary}
              libraryLoading={libraryLoading}
            />
          ) : null}
          {activeSection === 'curriculum' ? (
            <StudentCurriculumTab
              student={student}
              onDataUpdated={onDataUpdated}
              bookLibrary={bookLibrary}
              libraryLoading={libraryLoading}
            />
          ) : null}
          {activeSection === 'words' ? (
            <StudentWordsTab student={student} studentId={studentId} onDataUpdated={onDataUpdated} />
          ) : null}
          {activeSection === 'info' ? (
            <StudentHomeSettingsSection
              student={student}
              studentId={studentId}
              onDataUpdated={onDataUpdated}
            />
          ) : null}
        </>
      ) : null}
    </div>
  )
}

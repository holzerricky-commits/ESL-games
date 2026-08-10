'use client'

import Link from 'next/link'
import { StudentMapTab } from '@/components/students/tabs/student-map-tab'
import { StudentAvatarTab } from '@/components/students/tabs/student-avatar-tab'
import { StudentInfoTab } from '@/components/students/tabs/student-info-tab'
import { StudentWordsTab } from '@/components/students/tabs/student-words-tab'
import type { StudentProfileTab, StudentProfileView } from '@/lib/students/types'

const profileTabTriggerClass =
  'h-10 flex-none rounded-none border-x-0 border-t-0 border-b-2 border-transparent px-3 text-sm font-semibold text-muted-foreground transition-[color,border-color] ' +
  'hover:border-b-[color:color-mix(in_oklab,var(--muted-foreground)_45%,transparent)]'

const activeProfileTabClass =
  'border-b-primary bg-transparent text-foreground shadow-none'

const PREVIEW_TABS: Array<{ value: StudentProfileTab; label: string }> = [
  { value: 'map', label: 'Map' },
  { value: 'avatar', label: 'Avatar' },
  { value: 'words', label: 'Words' },
  { value: 'info', label: 'Info' },
]

interface StudentProfileTabsProps {
  student: StudentProfileView
  studentId: string
  activeTab: StudentProfileTab
  onDataUpdated?: () => void
  showList?: boolean
  showContent?: boolean
  listClassName?: string
}

export function StudentProfileTabs({
  student,
  studentId,
  activeTab,
  onDataUpdated,
  showList = true,
  showContent = true,
  listClassName,
}: StudentProfileTabsProps) {
  const tabHref = (value: StudentProfileTab) => `/students/${studentId}?tab=${value}`

  return (
    <div className="flex flex-col gap-5">
      {showList ? (
        <nav
          aria-label="Student profile sections"
          className={`flex h-auto w-full flex-wrap justify-start gap-1 rounded-none border-b border-[var(--border)] bg-transparent p-0 ${listClassName ?? ''}`}
        >
          {PREVIEW_TABS.map((tab) => (
            <Link
              key={tab.value}
              href={tabHref(tab.value)}
              aria-current={activeTab === tab.value ? 'page' : undefined}
              className={`${profileTabTriggerClass} ${activeTab === tab.value ? activeProfileTabClass : ''}`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      ) : null}

      {showContent ? (
        <>
          {activeTab === 'map' ? <StudentMapTab key={student.id} student={student} /> : null}
          {activeTab === 'avatar' ? <StudentAvatarTab student={student} /> : null}
          {activeTab === 'words' ? (
            <StudentWordsTab student={student} studentId={studentId} onDataUpdated={onDataUpdated} />
          ) : null}
          {activeTab === 'info' ? (
            <StudentInfoTab student={student} studentId={studentId} onDataUpdated={onDataUpdated} />
          ) : null}
        </>
      ) : null}
    </div>
  )
}

'use client'

import Link from 'next/link'
import { StudentChallengesTab } from '@/components/students/tabs/student-challenges-tab'
import { StudentMapTab } from '@/components/students/tabs/student-map-tab'
import { StudentAvatarTab } from '@/components/students/tabs/student-avatar-tab'
import { StudentInfoTab } from '@/components/students/tabs/student-info-tab'
import type { StudentProfileTab, StudentProfileView } from '@/lib/students/types'

const profileTabTriggerClass =
  'h-10 flex-none rounded-none border-x-0 border-t-0 border-b-2 border-transparent px-3 text-sm font-semibold text-muted-foreground transition-[color,border-color] ' +
  'hover:border-b-[color:color-mix(in_oklab,var(--muted-foreground)_45%,transparent)]'

const activeProfileTabClass =
  'border-b-[color:var(--brand-yellow)] bg-transparent text-foreground shadow-none dark:border-b-[color:var(--brand-yellow)]'

interface StudentProfileTabsProps {
  student: StudentProfileView
  studentId: string
  activeTab: StudentProfileTab
  showList?: boolean
  showContent?: boolean
  listClassName?: string
}

export function StudentProfileTabs({
  student,
  studentId,
  activeTab,
  showList = true,
  showContent = true,
  listClassName,
}: StudentProfileTabsProps) {
  const effectiveTab: StudentProfileTab =
    activeTab === 'curriculum' || activeTab === 'classes' ? 'challenges' : activeTab
  const tabs: Array<{ value: StudentProfileTab; label: string }> = [
    { value: 'challenges', label: 'Challenges' },
    { value: 'map', label: 'Map' },
    { value: 'avatar', label: 'Avatar' },
    { value: 'info', label: 'Info' },
  ]

  const tabHref = (value: StudentProfileTab) => `/students/${studentId}?tab=${value}`

  return (
    <div className="flex flex-col gap-5">
      {showList ? (
        <nav
          aria-label="Student profile sections"
          className={`flex h-auto w-full flex-wrap justify-start gap-1 rounded-none border-b border-[var(--border)] bg-transparent p-0 ${listClassName ?? ''}`}
        >
          {tabs.map((tab) => (
            <Link
              key={tab.value}
              href={tabHref(tab.value)}
              aria-current={effectiveTab === tab.value ? 'page' : undefined}
              className={`${profileTabTriggerClass} ${effectiveTab === tab.value ? activeProfileTabClass : ''}`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      ) : null}

      {showContent ? (
        <>
          {effectiveTab === 'challenges' ? <StudentChallengesTab student={student} /> : null}
          {effectiveTab === 'map' ? <StudentMapTab key={student.id} student={student} /> : null}
          {effectiveTab === 'avatar' ? <StudentAvatarTab student={student} /> : null}
          {effectiveTab === 'info' ? <StudentInfoTab student={student} /> : null}
        </>
      ) : null}
    </div>
  )
}

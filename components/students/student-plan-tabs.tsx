'use client'

import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StudentCurriculumTab } from '@/components/students/tabs/student-curriculum-tab'
import { StudentClassesTab } from '@/components/students/tabs/student-classes-tab'
import type { BookLibraryPayload } from '@/lib/books/types'
import type { StudentProfileTab, StudentProfileView } from '@/lib/students/types'
import { cn } from '@/lib/utils'

interface StudentPlanTabsProps {
  student: StudentProfileView
  studentId: string
  activeTab: StudentProfileTab
  onDataUpdated: () => void
  bookLibrary?: BookLibraryPayload | null
  libraryLoading?: boolean
}

const PLAN_TABS: Array<{ value: StudentProfileTab; label: string }> = [
  { value: 'classes', label: 'Classes' },
  { value: 'curriculum', label: 'Books' },
]

export function StudentPlanTabs({
  student,
  studentId,
  activeTab,
  onDataUpdated,
  bookLibrary = null,
  libraryLoading = false,
}: StudentPlanTabsProps) {
  const router = useRouter()
  const base = `/students/${studentId}/plan`
  const resolvedTab = activeTab === 'classes' || activeTab === 'curriculum' ? activeTab : 'classes'

  const handleTabChange = (tabValue: string) => {
    router.replace(`${base}?tab=${tabValue}`)
  }

  return (
    <Tabs value={resolvedTab} onValueChange={handleTabChange} className="gap-6">
      <TabsList className="h-auto w-full justify-start gap-1 rounded-none border-b border-border bg-transparent p-0">
        {PLAN_TABS.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className={cn(
              'flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 py-2 shadow-none',
              'data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none',
            )}
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="classes">
        <StudentClassesTab
          student={student}
          onUpdated={onDataUpdated}
          bookLibrary={bookLibrary}
          libraryLoading={libraryLoading}
        />
      </TabsContent>
      <TabsContent value="curriculum">
        <StudentCurriculumTab
          student={student}
          onDataUpdated={onDataUpdated}
          bookLibrary={bookLibrary}
          libraryLoading={libraryLoading}
        />
      </TabsContent>
    </Tabs>
  )
}

'use client'

import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StudentOverviewTab } from '@/components/students/tabs/student-overview-tab'
import { StudentPracticeTab } from '@/components/students/tabs/student-practice-tab'
import { StudentChallengesTab } from '@/components/students/tabs/student-challenges-tab'
import { StudentAvatarTab } from '@/components/students/tabs/student-avatar-tab'
import { StudentInfoTab } from '@/components/students/tabs/student-info-tab'
import type { StudentProfileTab, StudentProfileView } from '@/lib/students/types'

interface StudentProfileTabsProps {
  student: StudentProfileView
  studentId: string
  activeTab: StudentProfileTab
}

export function StudentProfileTabs({ student, studentId, activeTab }: StudentProfileTabsProps) {
  const router = useRouter()

  const handleTabChange = (tabValue: string) => {
    router.replace(`/students/${studentId}?tab=${tabValue}`)
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="gap-4">
      <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-xl bg-[var(--surface-2)] p-2">
        <TabsTrigger value="overview" className="flex-none">
          Overview
        </TabsTrigger>
        <TabsTrigger value="practice" className="flex-none">
          Practice
        </TabsTrigger>
        <TabsTrigger value="challenges" className="flex-none">
          Challenges
        </TabsTrigger>
        <TabsTrigger value="avatar" className="flex-none">
          Avatar
        </TabsTrigger>
        <TabsTrigger value="info" className="flex-none">
          Info
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <StudentOverviewTab student={student} />
      </TabsContent>
      <TabsContent value="practice">
        <StudentPracticeTab student={student} />
      </TabsContent>
      <TabsContent value="challenges">
        <StudentChallengesTab student={student} />
      </TabsContent>
      <TabsContent value="avatar">
        <StudentAvatarTab student={student} />
      </TabsContent>
      <TabsContent value="info">
        <StudentInfoTab student={student} />
      </TabsContent>
    </Tabs>
  )
}

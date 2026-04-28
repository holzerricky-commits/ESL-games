'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TeacherChallengePathTab } from '@/components/students/teacher-challenge-path-tab'
import { StudentCurriculumTab } from '@/components/students/tabs/student-curriculum-tab'
import { StudentClassesTab } from '@/components/students/tabs/student-classes-tab'
import type { StudentProfileTab, StudentProfileView } from '@/lib/students/types'

interface StudentPlanTabsProps {
  student: StudentProfileView
  studentId: string
  activeTab: StudentProfileTab
  onDataUpdated: () => void
}

function OtherTabPlaceholder({ studentId, label }: { studentId: string; label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-8 text-center">
      <p className="text-sm text-muted-foreground">
        {label} lives on the full student profile. Use that view for the learning experience; this screen is for planning
        the challenge path.
      </p>
      <Link
        href={`/students/${studentId}`}
        className="mt-4 inline-block text-sm font-semibold text-[var(--brand-blue)] hover:underline"
      >
        Open student profile
      </Link>
    </div>
  )
}

export function StudentPlanTabs({ student, studentId, activeTab, onDataUpdated }: StudentPlanTabsProps) {
  const router = useRouter()
  const base = `/students/${studentId}/plan`

  const handleTabChange = (tabValue: string) => {
    router.replace(`${base}?tab=${tabValue}`)
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="gap-4">
      <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-xl bg-[var(--surface-2)] p-2">
        <TabsTrigger value="challenges" className="flex-none">
          Challenges
        </TabsTrigger>
        <TabsTrigger value="curriculum" className="flex-none">
          Curriculum
        </TabsTrigger>
        <TabsTrigger value="classes" className="flex-none">
          Classes
        </TabsTrigger>
        <TabsTrigger value="avatar" className="flex-none">
          Avatar
        </TabsTrigger>
        <TabsTrigger value="info" className="flex-none">
          Info
        </TabsTrigger>
      </TabsList>

      <TabsContent value="challenges">
        <TeacherChallengePathTab student={student} onUpdated={onDataUpdated} />
      </TabsContent>
      <TabsContent value="curriculum">
        <StudentCurriculumTab student={student} />
      </TabsContent>
      <TabsContent value="classes">
        <StudentClassesTab student={student} onUpdated={onDataUpdated} />
      </TabsContent>
      <TabsContent value="avatar">
        <OtherTabPlaceholder studentId={studentId} label="Avatar" />
      </TabsContent>
      <TabsContent value="info">
        <OtherTabPlaceholder studentId={studentId} label="Student info" />
      </TabsContent>
    </Tabs>
  )
}

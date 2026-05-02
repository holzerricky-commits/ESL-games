'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TeacherChallengePathTab } from '@/components/students/teacher-challenge-path-tab'
import { TeacherDifficultyStripInline } from '@/components/students/teacher-difficulty-strip-inline'
import { TeacherStudentDeletePanel } from '@/components/students/teacher-student-delete-panel'
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
        <StudentCurriculumTab student={student} onDataUpdated={onDataUpdated} />
      </TabsContent>
      <TabsContent value="classes">
        <StudentClassesTab student={student} onUpdated={onDataUpdated} />
      </TabsContent>
      <TabsContent value="avatar">
        <OtherTabPlaceholder studentId={studentId} label="Avatar" />
      </TabsContent>
      <TabsContent value="info" className="space-y-6">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 sm:p-5">
          <p className="text-sm font-semibold text-foreground">Student profile</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Avatar, map, and play experience live on the full profile. Open it when you want to preview or test as this
            student.
          </p>
          <Link
            href={`/students/${studentId}`}
            className="mt-3 inline-block text-sm font-semibold text-[var(--brand-blue)] hover:underline"
          >
            Open student profile
          </Link>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 sm:p-5">
          <p className="text-sm font-semibold text-foreground">Default quiz difficulty</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Sets the tier used for new challenges unless a quiz overrides it.
          </p>
          <div className="mt-4">
            <TeacherDifficultyStripInline student={student} studentId={studentId} onUpdated={onDataUpdated} />
          </div>
        </div>

        <TeacherStudentDeletePanel studentId={studentId} studentName={student.name} />
      </TabsContent>
    </Tabs>
  )
}

import type { StudentProfileView } from '@/lib/students/types'

interface StudentChallengesTabProps {
  student: StudentProfileView
}

export function StudentChallengesTab({ student }: StudentChallengesTabProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
        <p className="text-sm font-semibold text-foreground">Current Challenge</p>
        <p className="mt-2 text-sm text-muted-foreground">{student.currentChallengeLabel}</p>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
        <p className="text-sm font-semibold text-foreground">Challenge Timeline</p>
        <p className="mt-2 text-sm text-muted-foreground">{student.challengeSummary}</p>
      </div>
    </div>
  )
}

import { Badge } from '@/components/ui/badge'
import type { StudentProfileView } from '@/lib/students/types'

interface StudentOverviewTabProps {
  student: StudentProfileView
}

export function StudentOverviewTab({ student }: StudentOverviewTabProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
          <p className="text-xs text-muted-foreground">Level</p>
          <p className="mt-1 text-lg font-bold text-foreground">{student.levelLabel}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
          <p className="text-xs text-muted-foreground">Progress</p>
          <p className="mt-1 text-lg font-bold text-foreground">{student.progressLabel}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
          <p className="text-xs text-muted-foreground">Total Attempts</p>
          <p className="mt-1 text-lg font-bold text-foreground">{student.totalAttempts}</p>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
        <p className="text-sm font-semibold text-foreground">Recent Activity</p>
        <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
          {student.recentActivity.map((item) => (
            <li key={item}>- {item}</li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-4">
        <Badge variant="outline">Shop: coming soon</Badge>
      </div>
    </div>
  )
}

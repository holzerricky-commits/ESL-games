import { Button } from '@/components/ui/button'
import type { StudentProfileView } from '@/lib/students/types'

interface StudentPracticeTabProps {
  student: StudentProfileView
}

export function StudentPracticeTab({ student }: StudentPracticeTabProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
        <p className="text-sm font-semibold text-foreground">Assigned Practice</p>
        <p className="mt-2 text-sm text-muted-foreground">{student.practiceSummary}</p>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
        <p className="text-sm font-semibold text-foreground">Last Completed</p>
        <p className="mt-2 text-sm text-muted-foreground">No detailed data yet for this milestone.</p>
      </div>

      <Button variant="outline">Assign practice (placeholder)</Button>
    </div>
  )
}

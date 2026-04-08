import { Button } from '@/components/ui/button'
import type { StudentProfileView } from '@/lib/students/types'

interface StudentInfoTabProps {
  student: StudentProfileView
}

export function StudentInfoTab({ student }: StudentInfoTabProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
        <p className="text-sm font-semibold text-foreground">Student Information</p>
        <p className="mt-2 text-sm text-muted-foreground">{student.infoSummary}</p>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
        <p className="text-sm text-muted-foreground">Class group: --</p>
        <p className="mt-1 text-sm text-muted-foreground">Notes: --</p>
      </div>

      <Button variant="outline">Edit info (placeholder)</Button>
    </div>
  )
}

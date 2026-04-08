import { Badge } from '@/components/ui/badge'
import type { StudentProfileView } from '@/lib/students/types'

interface StudentAvatarTabProps {
  student: StudentProfileView
}

export function StudentAvatarTab({ student }: StudentAvatarTabProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
        <p className="text-sm font-semibold text-foreground">Avatar Preview</p>
        <p className="mt-2 text-sm text-muted-foreground">{student.avatarSummary}</p>
      </div>

      <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-4">
        <Badge variant="outline">Shop: coming soon</Badge>
      </div>
    </div>
  )
}

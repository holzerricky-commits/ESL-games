import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { StudentListItemView } from '@/lib/students/types'

interface StudentCardProps {
  student: StudentListItemView
}

export function StudentCard({ student }: StudentCardProps) {
  return (
    <Link
      href={`/students/${student.id}`}
      className="group block rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 transition-colors hover:border-[var(--brand-blue)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-bold text-foreground">{student.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">Last active: {student.lastActiveLabel}</p>
        </div>
        <ChevronRight size={18} className="mt-1 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant="outline">{student.levelLabel}</Badge>
        <Badge variant="outline">{student.progressLabel}</Badge>
        <Badge variant="outline">{student.coinsLabel}</Badge>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">{student.currentChallengeLabel}</p>
    </Link>
  )
}

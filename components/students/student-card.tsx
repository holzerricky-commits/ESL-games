import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { StudentListItemView } from '@/lib/students/types'

interface StudentCardProps {
  student: StudentListItemView
}

export function StudentCard({ student }: StudentCardProps) {
  const profileHref = `/students/${student.id}`
  const planHref = `/students/${student.id}/plan?tab=challenges`

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 transition-colors hover:border-[var(--brand-blue)]">
      <div className="flex items-start justify-between gap-3">
        <Link
          href={profileHref}
          className="group min-w-0 flex-1 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-blue)]"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-foreground">{student.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">Last active: {student.lastActiveLabel}</p>
            </div>
            <ChevronRight
              size={18}
              className="mt-1 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            />
          </div>
        </Link>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="shrink-0 border-[var(--border)] text-foreground hover:border-[var(--brand-blue)]"
        >
          <Link href={planHref}>Plan challenges</Link>
        </Button>
      </div>

      <Link href={profileHref} className="mt-4 block">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{student.levelLabel}</Badge>
          <Badge variant="outline">{student.progressLabel}</Badge>
          <Badge variant="outline">{student.coinsLabel}</Badge>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{student.currentChallengeLabel}</p>
      </Link>
    </div>
  )
}

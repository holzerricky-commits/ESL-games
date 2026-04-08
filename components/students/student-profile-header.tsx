import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { StudentProfileView } from '@/lib/students/types'

interface StudentProfileHeaderProps {
  student: StudentProfileView
}

export function StudentProfileHeader({ student }: StudentProfileHeaderProps) {
  return (
    <div className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href="/students">
          <ArrowLeft size={14} />
          Back to Students
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{student.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Quick profile view for live classroom decisions.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{student.levelLabel}</Badge>
          <Badge variant="outline">{student.progressLabel}</Badge>
          <Badge variant="outline">{student.coinsLabel}</Badge>
        </div>
      </div>
    </div>
  )
}

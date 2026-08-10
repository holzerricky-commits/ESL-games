import type { ReactNode } from 'react'
import { Coins, Flag, Trophy } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { StudentProfileAvatarBadge } from '@/components/students/student-profile-avatar-badge'
import type { StudentProfileView } from '@/lib/students/types'

interface StudentProfileHeaderProps {
  student: StudentProfileView
  tabs?: React.ReactNode
  teacherPlanIntro?: ReactNode
  teacherDifficultyStrip?: ReactNode
}

function parseProgressPercent(progressLabel: string) {
  const match = progressLabel.match(/(\d{1,3})%/)
  if (!match) return 0
  return Math.max(0, Math.min(100, Number(match[1])))
}

function InlineStat({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: ReactNode
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground tabular-nums">{value}</span>
    </div>
  )
}

export function StudentProfileHeader({
  student,
  tabs,
  teacherPlanIntro,
  teacherDifficultyStrip,
}: StudentProfileHeaderProps) {
  const progressPct = parseProgressPercent(student.progressLabel)
  const levelNumber = student.levelLabel.replace(/[^0-9]/g, '') || '--'

  return (
    <div className="mb-6 border-b border-border pb-4">
      {teacherPlanIntro ? (
        <div className="mb-4 text-sm text-muted-foreground">{teacherPlanIntro}</div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <StudentProfileAvatarBadge
            studentId={student.id}
            name={student.name}
            avatarUrl={student.avatarUrl}
            statusLabel="+XP"
          />
          <div className="min-w-0 space-y-2 pt-1">
            <h1 className="text-xl font-semibold text-foreground">{student.name}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <InlineStat
                icon={<Trophy className="h-4 w-4" aria-hidden />}
                label="Done"
                value={student.completedChallengesLabel}
              />
              <InlineStat icon={<Flag className="h-4 w-4" aria-hidden />} label="Streak" value="—" />
              <InlineStat
                icon={<Coins className="h-4 w-4" aria-hidden />}
                label="Coins"
                value={student.totalCoins}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 max-w-md space-y-2">
        {teacherDifficultyStrip ? <div>{teacherDifficultyStrip}</div> : null}
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>Level {levelNumber}</span>
          <span>{student.progressLabel}</span>
        </div>
        <Progress value={progressPct} className="h-2" />
      </div>

      {tabs ? <div className="mt-4">{tabs}</div> : null}
    </div>
  )
}

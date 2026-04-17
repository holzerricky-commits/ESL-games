import type { ReactNode } from 'react'
import { Flag, Trophy } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import type { StudentProfileView } from '@/lib/students/types'

interface StudentProfileHeaderProps {
  student: StudentProfileView
  tabs?: React.ReactNode
  /** Teacher plan: short intro line at top of header (replaces separate banner). */
  teacherPlanIntro?: ReactNode
  /** Teacher plan: compact row above the level progress bar (e.g. default quiz difficulty). */
  teacherDifficultyStrip?: ReactNode
}

interface AvatarBadgeProps {
  name: string
  avatarUrl?: string | null
  statusLabel?: string
}

interface ProgressPanelProps {
  levelLabel: string
  progressLabel: string
}

/** Secondary stat — grayed, icon-as-“art” in the center, label + value below. */
function MutedGameStatCard({
  visual,
  label,
  value,
  valueClassName = 'text-sm sm:text-base',
}: {
  visual: React.ReactNode
  label: string
  value: React.ReactNode
  valueClassName?: string
}) {
  return (
    <div className="grid h-full min-w-0 grid-rows-[1fr_auto] rounded-2xl border border-[var(--border)]/80 bg-[color-mix(in_oklab,var(--muted)_55%,var(--card))] px-3 py-2.5 text-center shadow-[inset_0_1px_0_color-mix(in_oklab,var(--foreground)_6%,transparent)]">
      <div className="grid place-items-center py-1">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--muted)_70%,transparent)] text-muted-foreground/45">
          {visual}
        </div>
      </div>
      <div className="w-full space-y-0.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/75">{label}</p>
        <p className={`min-w-0 break-words font-extrabold leading-tight text-muted-foreground ${valueClassName}`}>{value}</p>
      </div>
    </div>
  )
}

/** Primary wallet stat — last in row, gold emphasis, coins artwork centered. */
function CoinsGameStatCard({ totalCoins }: { totalCoins: number }) {
  return (
    <div
      className="relative grid h-full min-w-0 grid-rows-[1fr_auto] items-center overflow-hidden rounded-2xl border border-amber-400/45 bg-gradient-to-b from-amber-500/20 via-amber-400/12 to-yellow-600/18 px-3 py-2.5 text-center shadow-[0_8px_28px_-8px_rgba(245,158,11,0.35),inset_0_1px_0_rgba(255,255,255,0.12)] ring-1 ring-amber-300/25"
      role="group"
      aria-label={`Coins: ${totalCoins}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_70%_at_50%_30%,rgba(255,220,120,0.22),transparent_65%)]" aria-hidden />
      <div className="relative grid w-full place-items-center py-1">
        {/* eslint-disable-next-line @next/next/no-img-element -- static public asset */}
        <img
          src="/coins.png"
          alt=""
          className="mx-auto h-11 w-auto max-w-[min(100%,6.25rem)] object-contain drop-shadow-[0_6px_14px_rgba(180,83,9,0.35)]"
        />
      </div>
      <div className="relative w-full space-y-0.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-900/90 dark:text-amber-100/90">Coins</p>
        <p className="text-[clamp(1.25rem,3vw,1.65rem)] font-black tabular-nums leading-none tracking-tight text-amber-950 dark:text-amber-50">
          {totalCoins}
        </p>
      </div>
    </div>
  )
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function parseProgressPercent(progressLabel: string) {
  const match = progressLabel.match(/(\d{1,3})%/)
  if (!match) return 0
  return Math.max(0, Math.min(100, Number(match[1])))
}

function AvatarBadge({ name, avatarUrl, statusLabel = '+XP' }: AvatarBadgeProps) {
  const avatarSrc = avatarUrl?.trim()
  const previewAvatarSrc = '/Avatar example.png'

  return (
    <div className="relative z-[6] mx-auto -mt-9 flex w-full max-w-[min(100%,12rem)] flex-col items-center gap-2.5 md:-mt-11 lg:-mt-12 lg:max-w-none">
      <div className="relative h-28 w-28 shrink-0 md:h-32 md:w-32 lg:h-36 lg:w-36">
        <div className="h-full w-full rounded-full border border-[var(--border)] bg-[var(--card)] p-1.5 shadow-[0_14px_34px_-18px_rgba(0,0,0,0.85),0_0_0_1px_color-mix(in_oklab,var(--brand-yellow)_18%,transparent),0_0_42px_-8px_color-mix(in_oklab,var(--brand-yellow)_45%,transparent)]">
          <div className="h-full w-full rounded-full border border-[var(--border)] bg-[var(--surface-2)] p-1">
            <div className="relative h-full w-full overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface-3)]">
              {avatarSrc || previewAvatarSrc ? (
                <img src={avatarSrc || previewAvatarSrc} alt={`${name} avatar`} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl font-black tracking-wide text-foreground md:text-4xl">
                  {getInitials(name)}
                </div>
              )}
            </div>
          </div>
          <div className="absolute -bottom-1 right-0 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--brand-yellow)] shadow-sm">
            {statusLabel}
          </div>
        </div>
      </div>
      <p className="w-full max-w-[16rem] text-center font-mono text-base font-bold leading-snug tracking-wide text-white lg:max-w-[14rem] lg:text-lg">
        {name}
      </p>
    </div>
  )
}

function ProgressPanel({ levelLabel, progressLabel }: ProgressPanelProps) {
  const progressPct = parseProgressPercent(progressLabel)
  const levelNumber = levelLabel.replace(/[^0-9]/g, '') || '--'

  return (
    <div className="min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Level</p>
          <p className="text-base font-extrabold leading-tight text-foreground">{levelNumber}</p>
        </div>
        <p className="text-xs font-semibold text-muted-foreground">{progressLabel}</p>
      </div>
      <div className="relative mt-3">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-16 rounded-full bg-[var(--brand-yellow)]/20 blur-md" />
        <Progress
          value={progressPct}
          className="h-3 bg-[var(--surface-3)] [&>div]:bg-[linear-gradient(90deg,var(--brand-yellow),var(--brand-yellow-600,#d6a200))]"
        />
      </div>
    </div>
  )
}

export function StudentProfileHeader({ student, tabs, teacherPlanIntro, teacherDifficultyStrip }: StudentProfileHeaderProps) {
  return (
    <div className="mt-10 mb-6 md:mt-12">
      <div className="relative -mx-4 w-auto overflow-visible border-b border-[var(--border)] bg-[var(--card)] px-4 py-7 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 md:py-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_130%_at_50%_0%,color-mix(in_oklab,var(--brand-blue)_22%,transparent),transparent)] opacity-45" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(125%_95%_at_12%_14%,color-mix(in_oklab,var(--foreground)_12%,transparent),transparent_54%),radial-gradient(95%_72%_at_86%_24%,color-mix(in_oklab,var(--foreground)_10%,transparent),transparent_60%),radial-gradient(82%_62%_at_34%_82%,color-mix(in_oklab,var(--foreground)_9%,transparent),transparent_64%),radial-gradient(circle_at_22%_30%,color-mix(in_oklab,var(--foreground)_10%,transparent)_0_1px,transparent_1.7px),radial-gradient(circle_at_71%_61%,color-mix(in_oklab,var(--foreground)_9%,transparent)_0_1px,transparent_1.7px),radial-gradient(circle_at_41%_76%,color-mix(in_oklab,var(--foreground)_8%,transparent)_0_1px,transparent_1.7px)] opacity-42" />
        <div className="mx-auto w-full max-w-7xl">
          {teacherPlanIntro ? (
            <div className="mb-5 border-b border-[var(--border)]/60 pb-4 text-sm text-muted-foreground">
              {teacherPlanIntro}
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-[auto_minmax(0,1fr)] md:items-center xl:grid-cols-[11rem_minmax(0,1fr)_minmax(0,24rem)] xl:items-center">
            <AvatarBadge name={student.name} avatarUrl={student.avatarUrl} statusLabel="+XP" />

            {/* Middle column: progress is absolutely centered in the strip on md+; keep spacer for grid alignment */}
            <div className="hidden md:block md:min-h-[1px] md:col-start-2 xl:col-start-2" aria-hidden />

            {/* Mobile: progress stays in normal flow */}
            <div className="min-w-0 w-full md:hidden">
              {teacherDifficultyStrip ? (
                <div className="mb-3 w-full border-b border-[var(--border)]/60 pb-3">{teacherDifficultyStrip}</div>
              ) : null}
              <ProgressPanel levelLabel={student.levelLabel} progressLabel={student.progressLabel} />
            </div>

            <div className="grid h-full auto-rows-fr gap-2 md:col-span-2 md:grid-cols-3 xl:col-span-1 xl:col-start-3">
              <MutedGameStatCard
                visual={<Trophy className="h-11 w-11 stroke-[1.25]" aria-hidden />}
                label="Completed"
                value={student.completedChallengesLabel}
              />
              <MutedGameStatCard
                visual={<Flag className="h-11 w-11 stroke-[1.25]" aria-hidden />}
                label="Streak"
                value="Coming soon"
              />
              <CoinsGameStatCard totalCoins={student.totalCoins} />
            </div>
          </div>
        </div>

        {/* md+: center the full Level + progress block in the middle of the strip (not just the row above tabs) */}
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-[5] hidden -translate-y-1/2 md:block">
          <div className="mx-auto grid w-full max-w-7xl grid-cols-1 px-4 sm:px-6 md:grid-cols-[auto_minmax(0,1fr)] lg:px-8 xl:grid-cols-[11rem_minmax(0,1fr)_minmax(0,24rem)]">
            <div className="pointer-events-auto md:col-start-2 xl:col-start-2 min-w-0 w-full max-w-full md:max-w-[50%]">
              {teacherDifficultyStrip ? (
                <div className="mb-3 w-full border-b border-[var(--border)]/60 pb-3">{teacherDifficultyStrip}</div>
              ) : null}
              <ProgressPanel levelLabel={student.levelLabel} progressLabel={student.progressLabel} />
            </div>
          </div>
        </div>

        {tabs ? (
          <div className="absolute inset-x-0 bottom-0 z-10">
            <div className="mx-auto grid w-full max-w-7xl grid-cols-1 px-4 sm:px-6 md:grid-cols-[auto_minmax(0,1fr)] lg:px-8 xl:grid-cols-[11rem_minmax(0,1fr)_minmax(0,24rem)]">
              <div className="md:col-start-2 xl:col-start-2 xl:col-span-2">{tabs}</div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

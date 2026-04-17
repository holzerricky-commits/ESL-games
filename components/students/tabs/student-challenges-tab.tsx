'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { CheckCircle2, Lock, Sparkles } from 'lucide-react'
import { CoverRewardPill } from '@/components/students/challenge-cover-reward-pill'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getQuizCardCoverUrl } from '@/lib/helpers'
import { getFirstQuizQuestionPreview } from '@/lib/quiz-difficulty'
import { getQuizzes } from '@/lib/storage'
import { getStudentProfileView } from '@/lib/students/selectors'
import { buildTimedChallengeLaunchHref } from '@/lib/students/challenge-launch'
import { getQuizPartLabel, getQuizSeriesKey } from '@/lib/topic-series'
import type { StudentChallengeItemView, StudentProfileView } from '@/lib/students/types'

/** Total slots in the student grid — assigned challenges + mystery locked “levels ahead”. */
const TOTAL_STUDENT_CHALLENGE_SLOTS = 24

interface StudentChallengesTabProps {
  student: StudentProfileView
}

function EmptyPathCard() {
  return (
    <div className="group relative flex h-full max-w-sm flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] opacity-95">
      <div className="relative aspect-[16/9] overflow-hidden border-b border-[var(--border)] bg-[var(--surface-3)]">
        <div className="flex h-full w-full items-center justify-center bg-[var(--surface-1)]">
          <Lock className="h-12 w-12 text-muted-foreground/35" strokeWidth={1.5} aria-hidden />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--surface-1)]/75 via-transparent to-transparent" />
        <Badge
          className="absolute right-3 top-3 shrink-0 border-[var(--border)] bg-[var(--surface-4)]/90 text-xs font-mono text-muted-foreground"
          variant="outline"
        >
          Locked
        </Badge>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-bold leading-tight text-muted-foreground">Challenge</h3>
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground/80">
            Your teacher hasn&apos;t added a challenge path yet.
          </p>
        </div>
        <div className="mt-auto flex items-center gap-2 pt-1 text-xs text-muted-foreground/70">
          <Lock size={13} className="shrink-0" aria-hidden />
          <span>Not available yet</span>
        </div>
      </div>
    </div>
  )
}

/** Generic locked slot — same look for every “level ahead” (motivation + room for future reveal animation). */
function MysteryLockedSlotCard({ stepNumber }: { stepNumber: number }) {
  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] opacity-95 motion-reduce:transition-none"
      aria-hidden
    >
      <div className="relative aspect-[16/9] overflow-hidden border-b border-[var(--border)] bg-[var(--surface-3)]">
        <div className="flex h-full w-full items-center justify-center bg-[var(--surface-1)]">
          <Lock className="h-12 w-12 text-muted-foreground/35" strokeWidth={1.5} aria-hidden />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--surface-1)]/75 via-transparent to-transparent" />
        <Badge className="absolute left-3 top-3 bg-[var(--surface-4)]/95 font-mono text-xs text-muted-foreground" variant="outline">
          {stepNumber}
        </Badge>
        <Badge
          className="absolute right-3 top-3 shrink-0 border-[var(--border)] bg-[var(--surface-4)]/90 text-xs font-mono text-muted-foreground"
          variant="outline"
        >
          Locked
        </Badge>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="truncate text-lg font-bold leading-tight text-muted-foreground">Challenge</h3>
        <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground/80">
          More topic parts ahead on your path. Keep going to unlock what&apos;s next.
        </p>
        <div className="mt-auto flex items-center gap-2 pt-1 text-xs text-muted-foreground/70">
          <Lock size={13} className="shrink-0" aria-hidden />
          <span>Stay tuned</span>
        </div>
      </div>
    </div>
  )
}

function ChallengePathCard({
  item,
  stepNumber,
  quizName,
  partLabel,
  coverUrl,
  launchHref,
}: {
  item: StudentChallengeItemView
  stepNumber: number
  quizName: string
  partLabel?: string
  coverUrl: string
  launchHref?: string
}) {
  const isLocked = item.status === 'locked'
  const isCurrent = item.status === 'unlocked'
  const isDone = item.status === 'completed'

  return (
    <article
      data-status={item.status}
      className={[
        'relative flex h-full flex-col overflow-hidden rounded-2xl border bg-[var(--card)]',
        'transition-all duration-700 ease-out motion-reduce:transition-none',
        isLocked && 'border-[var(--border)] opacity-90',
        isCurrent &&
          'border-[var(--brand-blue)] shadow-[0_0_28px_rgba(59,130,246,0.25)] ring-2 ring-[var(--brand-blue)]/50 motion-reduce:shadow-none motion-reduce:ring-1',
        isDone && 'border-[var(--brand-green)]/45',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={`${item.title}, ${item.status}`}
    >
      <div className="relative aspect-[16/9] overflow-hidden border-b border-[var(--border)] bg-[var(--surface-3)]">
        {/* eslint-disable-next-line @next/next/no-img-element -- dynamic quiz covers */}
        <img
          src={coverUrl}
          alt=""
          className={[
            'h-full w-full object-cover transition-all duration-700 ease-out motion-reduce:transition-none',
            isLocked && 'scale-105 blur-md brightness-[0.55]',
            isCurrent && 'scale-[1.02]',
            isDone && 'brightness-[0.92]',
          ]
            .filter(Boolean)
            .join(' ')}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--surface-1)]/80 via-transparent to-transparent" />
        {isLocked ? (
          <div className="absolute inset-0 z-[1] flex items-center justify-center bg-[var(--surface-1)]/40">
            <Lock className="h-14 w-14 text-white/90 drop-shadow-md" strokeWidth={1.5} aria-hidden />
          </div>
        ) : null}

        <Badge className="absolute left-3 top-3 z-10 bg-[var(--surface-4)]/95 font-mono text-xs text-foreground" variant="outline">
          {stepNumber}
        </Badge>

        <CoverRewardPill
          amount={item.coinReward}
          variant={isCurrent ? 'emphasis' : isLocked ? 'muted' : 'default'}
        />

        {isLocked ? (
          <Badge
            className="absolute bottom-3 left-3 z-10 border-[var(--border)] bg-[var(--surface-1)]/90 text-muted-foreground"
            variant="outline"
          >
            Locked
          </Badge>
        ) : null}
        {isCurrent ? (
          <Badge className="absolute bottom-3 left-3 z-10 border-[var(--brand-blue)] bg-[var(--brand-blue)] text-white">
            <Sparkles className="mr-1 inline h-3 w-3" />
            Your turn
          </Badge>
        ) : null}
        {isDone ? (
          <Badge className="absolute bottom-3 left-3 z-10 border-[var(--brand-green)] bg-[var(--surface-4)]/95 text-[var(--brand-green)]">
            <CheckCircle2 className="mr-1 inline h-3 w-3" />
            Done
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3
          className={[
            'line-clamp-2 text-lg font-bold leading-tight',
            isLocked ? 'text-muted-foreground' : 'text-foreground',
          ].join(' ')}
        >
          {isLocked ? item.title : quizName || item.title}
        </h3>
        {!isLocked && partLabel ? (
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{partLabel}</p>
        ) : null}
        {!isLocked && item.description ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
        ) : isLocked ? (
          <p className="text-sm text-muted-foreground">Finish the step before this one to unlock.</p>
        ) : null}

        {!isLocked ? (
          <p className="mt-auto pt-2 text-xs text-muted-foreground">
            Best: {item.bestScorePct}% · Attempts: {item.attemptCount}
          </p>
        ) : null}

        {!isLocked && launchHref ? (
          <div className="pt-2">
            <Button asChild className="w-full bg-[var(--brand-blue)] text-white hover:bg-[var(--brand-blue-bright)]" size="sm">
              <Link href={launchHref}>{isCurrent ? 'Start challenge' : 'Review challenge'}</Link>
            </Button>
          </div>
        ) : null}
      </div>
    </article>
  )
}

export function StudentChallengesTab({ student }: StudentChallengesTabProps) {
  const liveStudent = useMemo(() => getStudentProfileView(student.id) ?? student, [student])
  const hasAssignedPath = liveStudent.challengeItems.length > 0

  const quizzes = useMemo(() => getQuizzes(), [liveStudent.challengeItems, liveStudent.studentKey])
  const quizById = useMemo(() => new Map(quizzes.map((q) => [q.id, q])), [quizzes])

  const itemsWithCovers = useMemo(() => {
    return liveStudent.challengeItems.map((item, index) => {
      const quiz = quizById.get(item.quizId)
      const first = quiz ? getFirstQuizQuestionPreview(quiz) : undefined
      const coverUrl = quiz
        ? getQuizCardCoverUrl({
            quizId: quiz.id,
            quizName: quiz.name,
            coverImageMode: quiz.coverImageMode,
            manualCoverImageUrl: quiz.coverImageUrl,
            fallbackImageUrl: first?.imageUrl,
            imageSearchQuery: first?.imageSearchQuery,
            imageStyle: first?.imageStyle,
          })
        : ''
      const seriesKey = quiz ? getQuizSeriesKey(quiz) : `challenge:${item.id}`
      return {
        item,
        stepNumber: index + 1,
        quizName: quiz?.seriesTitle?.trim() || quiz?.name || item.title,
        partLabel: quiz ? getQuizPartLabel(quiz) : undefined,
        coverUrl,
        quiz,
        seriesKey,
      }
    })
  }, [liveStudent.challengeItems, quizById])

  /** Student-facing: keep current flow focused by showing only one locked "next" card per series. */
  const visibleCards = useMemo(() => {
    const firstLockedShownBySeries = new Set<string>()
    return itemsWithCovers.filter(({ item, seriesKey }) => {
      if (item.status !== 'locked') return true
      if (firstLockedShownBySeries.has(seriesKey)) return false
      firstLockedShownBySeries.add(seriesKey)
      return true
    })
  }, [itemsWithCovers])

  const assignedCount = liveStudent.challengeItems.length
  const fillerCount = hasAssignedPath ? Math.max(0, TOTAL_STUDENT_CHALLENGE_SLOTS - assignedCount) : 0

  const fallbackCover =
    'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22800%22 height=%22450%22%3E%3Crect fill=%22%231e293b%22 width=%22800%22 height=%22450%22/%3E%3C/svg%3E'

  return (
    <div className="mx-auto max-w-7xl space-y-6" aria-label={`Challenges for ${liveStudent.name}`}>
      <div>
        <h2 className="text-xl font-bold text-foreground">Challenges</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {hasAssignedPath
            ? 'Your path shows your topic parts in order. You see your current part plus the next locked part; finishing the current one unlocks what comes next.'
            : 'Nothing here until your teacher assigns challenges on the plan screen.'}
        </p>
      </div>

      {hasAssignedPath ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleCards.map(({ item, stepNumber, quizName, partLabel, coverUrl, quiz }) => (
            <ChallengePathCard
              key={item.id}
              item={item}
              stepNumber={stepNumber}
              quizName={quizName}
              partLabel={partLabel}
              coverUrl={coverUrl || fallbackCover}
              launchHref={
                !quiz || item.status === 'locked'
                  ? undefined
                  : buildTimedChallengeLaunchHref({
                      mode: 'challenge',
                      quizId: item.quizId,
                      studentId: liveStudent.id,
                      studentName: liveStudent.name,
                    })
              }
            />
          ))}
          {Array.from({ length: fillerCount }, (_, i) => (
            <MysteryLockedSlotCard key={`mystery-${assignedCount + i + 1}`} stepNumber={assignedCount + i + 1} />
          ))}
        </div>
      ) : (
        <EmptyPathCard />
      )}
    </div>
  )
}

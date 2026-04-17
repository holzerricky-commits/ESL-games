'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Flame, Map as MapIcon, Shield, Swords, Target, Trophy, Zap } from 'lucide-react'
import { ChallengeMapCanvas } from '@/components/students/challenge-map/challenge-map-canvas'
import { ChallengeMapEnvironment } from '@/components/students/challenge-map/challenge-map-environment'
import { StudentWalletSection } from '@/components/students/student-wallet-section'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getStudentMapNodeLayout, getStudentMapPathSegments, getStudentProfileView } from '@/lib/students/selectors'
import { buildChallengeMapNodes } from '@/lib/students/challenge-map'
import type { StudentProfileView } from '@/lib/students/types'

interface StudentOverviewTabProps {
  student: StudentProfileView
}

export function StudentOverviewTab({ student }: StudentOverviewTabProps) {
  const liveStudent = useMemo(() => getStudentProfileView(student.id) ?? student, [student])
  const nodes = useMemo(() => buildChallengeMapNodes(liveStudent), [liveStudent])
  const nodeLayout = useMemo(() => getStudentMapNodeLayout(liveStudent.id), [liveStudent.id])
  const pathSegments = useMemo(() => getStudentMapPathSegments(liveStudent.id), [liveStudent.id])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const fullMapHref = `/students/${student.id}/map`

  useEffect(() => {
    if (nodes.length === 0) {
      setSelectedNodeId(null)
      return
    }
    const defaultNode = nodes.find((node) => node.status === 'current') ?? nodes.find((node) => node.status !== 'locked') ?? nodes[0]
    setSelectedNodeId((previous) => {
      if (previous && nodes.some((node) => node.id === previous)) return previous
      return defaultNode.id
    })
  }, [nodes])

  const selectedNode = useMemo(() => nodes.find((node) => node.id === selectedNodeId) ?? null, [nodes, selectedNodeId])
  const selectedChallenge = useMemo(
    () => liveStudent.challengeItems.find((item) => item.id === selectedNode?.id) ?? null,
    [liveStudent.challengeItems, selectedNode],
  )
  const selectedStatusLabel = selectedNode
    ? selectedNode.status === 'current'
      ? 'Current level'
      : selectedNode.status === 'completed'
        ? 'Completed'
        : 'Locked'
    : ''
  const selectedDifficulty = liveStudent.defaultDifficultyTier
    ? `${liveStudent.defaultDifficultyTier[0].toUpperCase()}${liveStudent.defaultDifficultyTier.slice(1)}`
    : 'Coming soon'
  const selectedXp = selectedNode ? selectedNode.reward * 3 : 0
  const progressPercent = nodes.length > 0 ? Math.round((nodes.filter((node) => node.status === 'completed').length / nodes.length) * 100) : 0
  const missionState = selectedNode
    ? selectedNode.status === 'completed'
      ? 'Mission complete'
      : selectedNode.status === 'current'
        ? 'Active mission'
        : 'Locked mission'
    : 'Mission preview'
  const missionDescription = selectedNode
    ? selectedNode.status === 'locked'
      ? `This mission is locked. ${selectedNode.unlockHint ?? 'Complete the previous challenge to open it.'}`
      : `${selectedChallenge?.description || 'A focused language challenge to grow your skills.'} Earn +${selectedNode.reward} coins and +${selectedXp} XP.`
    : 'Select a challenge node to inspect mission details and rewards.'

  return (
    <div className="w-full space-y-6" aria-label={`Overview for ${student.name}`}>
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
          {nodes.length > 0 ? (
            <div className="flex h-full min-h-0 flex-1 flex-col p-3 sm:p-4">
              <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="relative h-full min-h-[16rem] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-2)]">
                  <Link
                    href={fullMapHref}
                    aria-label="Open full challenge map"
                    className="absolute right-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)]/90 text-foreground shadow-sm backdrop-blur-[1px] transition hover:bg-[var(--surface-2)]"
                  >
                    <MapIcon className="h-4 w-4" aria-hidden />
                  </Link>
                  <ChallengeMapEnvironment nodes={nodes} />
                  <div className="relative p-2 sm:p-3">
                    <ChallengeMapCanvas
                      nodes={nodes}
                      showActions={false}
                      compact
                      nodeLayout={nodeLayout}
                      pathSegments={pathSegments}
                      showWalkingAvatar={false}
                      selectedNodeId={selectedNode?.id}
                      onNodeSelect={(node) => setSelectedNodeId(node.id)}
                    />
                  </div>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Select a node to inspect level details. Open Map for the full interactive view.
              </p>
            </div>
          ) : (
            <div className="p-4">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
                <p className="font-semibold text-foreground">Nothing assigned yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Your teacher can add quizzes on the plan screen.</p>
                <Button asChild variant="outline" className="mt-3 w-full border-[var(--border)]">
                  <Link href={`/students/${student.id}/plan`}>Open challenge plan</Link>
                </Button>
              </div>
            </div>
          )}
        </section>

        <aside aria-label={`Level overview for ${student.name}`}>
          <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
            <div className="space-y-4 p-4">
              {selectedNode ? (
                <>
                  <div className="overflow-hidden rounded-2xl bg-[linear-gradient(145deg,rgba(30,41,59,0.94),rgba(30,58,138,0.75))] p-4 shadow-[0_10px_24px_rgba(37,99,235,0.18)]">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100/80">
                          Step {selectedNode.stepNumber}
                        </p>
                        <h3 className="mt-1 text-balance text-4xl font-black leading-[1.02] tracking-tight text-white drop-shadow-[0_2px_0_rgba(0,0,0,0.35)] sm:text-5xl xl:text-6xl">
                          {selectedNode.title}
                        </h3>
                        <p className="mt-1 inline-flex rounded-md border border-cyan-300/35 bg-cyan-500/15 px-2 py-0.5 text-xs font-bold uppercase tracking-[0.12em] text-cyan-100">
                          {missionState}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <Badge className="border-cyan-200/40 bg-cyan-400/20 text-cyan-50 hover:bg-cyan-400/20">{selectedStatusLabel}</Badge>
                        <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-cyan-100/80">Path progress</p>
                        <p className="text-lg font-black text-white">{progressPercent}%</p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-slate-100/90">{missionDescription}</p>
                    <p className="mt-1 text-xs text-cyan-100/75">Objective: Build accuracy and speed to clear this step.</p>
                  </div>

                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Rewards</p>
                    <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
                      <div className="flex min-h-[12.5rem] flex-1 flex-col items-center justify-center gap-3 rounded-2xl bg-[var(--surface-2)] px-5 py-6 text-center md:min-w-0 md:flex-[1.15]">
                        <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-7">
                          {/* eslint-disable-next-line @next/next/no-img-element -- matches header coin art */}
                          <img
                            src="/coins.png"
                            alt=""
                            className="h-[7rem] w-auto max-w-[min(100%,11rem)] object-contain drop-shadow-[0_0_22px_rgba(251,191,36,0.55),0_0_40px_rgba(251,191,36,0.25)] sm:h-[8.25rem]"
                          />
                          <div className="text-left sm:min-w-[8rem]">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Coins</p>
                            <p className="text-[clamp(1.85rem,5vw,2.75rem)] font-black tabular-nums leading-none tracking-tight text-white">
                              +{selectedNode.reward}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex w-full flex-col gap-2 md:max-w-[13.5rem] md:flex-[0.85]">
                        <div className="flex items-center gap-3 rounded-xl bg-[var(--surface-3)] px-3 py-2.5">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element -- static mission illustration */}
                            <img src="/mission-icons/difficulty.svg" alt="" className="h-9 w-9 object-contain" />
                          </div>
                          <div className="min-w-0 flex-1 text-left">
                            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Difficulty</p>
                            <p className="truncate text-sm font-extrabold text-foreground">{selectedDifficulty}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 rounded-xl bg-[var(--surface-3)] px-3 py-2.5">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element -- static mission illustration */}
                            <img src="/mission-icons/xp.svg" alt="" className="h-9 w-9 object-contain" />
                          </div>
                          <div className="min-w-0 flex-1 text-left">
                            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">XP</p>
                            <p className="text-sm font-extrabold text-foreground">+{selectedXp}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 rounded-xl bg-[var(--surface-3)] px-3 py-2.5">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element -- static mission illustration */}
                            <img src="/mission-icons/score.svg" alt="" className="h-9 w-9 object-contain" />
                          </div>
                          <div className="min-w-0 flex-1 text-left">
                            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Best score</p>
                            <p className="text-sm font-extrabold text-foreground">{selectedNode.bestScorePct}%</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-100/85">Win conditions</p>
                    <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                      <p className="flex items-start gap-2 text-slate-100">
                        <Target className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-blue)]" aria-hidden />
                        Aim for at least 80%.
                      </p>
                      <p className="flex items-start gap-2 text-slate-100">
                        <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-yellow)]" aria-hidden />
                        Best run: {selectedNode.bestScorePct}%.
                      </p>
                      <p className="flex items-start gap-2 text-slate-100">
                        <Flame className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-orange)]" aria-hidden />
                        Attempts: {selectedNode.attemptCount}.
                      </p>
                      <p className="flex items-start gap-2 text-slate-100">
                        {selectedNode.status === 'locked' ? (
                          <Shield className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-green)]" aria-hidden />
                        ) : (
                          <Swords className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-green)]" aria-hidden />
                        )}
                        {selectedNode.status === 'locked' ? 'Unlock by clearing the previous node.' : 'Ready to play.'}
                      </p>
                    </div>
                    <div className="mt-4">
                      {selectedNode.launchHref && selectedNode.status !== 'locked' ? (
                        <Button
                          asChild
                          className="group h-14 w-full rounded-2xl border-2 border-cyan-100/35 bg-[linear-gradient(180deg,#7dd3fc_0%,#3b82f6_48%,#1d4ed8_100%)] px-5 text-base font-black uppercase tracking-[0.08em] text-white shadow-[0_10px_0_#1e3a8a,0_16px_26px_rgba(37,99,235,0.42)] transition-all hover:-translate-y-0.5 hover:brightness-110 active:translate-y-[2px] active:shadow-[0_7px_0_#1e3a8a,0_10px_16px_rgba(37,99,235,0.36)]"
                          size="sm"
                        >
                          <Link href={`${fullMapHref}?intro=mission`}>
                            <span className="inline-flex items-center gap-2">
                              <Zap className="h-5 w-5 text-yellow-200 transition-transform group-hover:rotate-6" aria-hidden />
                              {selectedNode.status === 'current' ? 'Play mission' : 'Replay mission'}
                            </span>
                          </Link>
                        </Button>
                      ) : (
                        <p className="text-sm text-muted-foreground">Complete the previous mission to unlock this challenge.</p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-4">
                  <p className="text-sm text-muted-foreground">Select a challenge node to view level details.</p>
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>

      <StudentWalletSection
        totalCoins={student.totalCoins}
        transactions={student.coinTransactions}
        studentName={student.name}
      />
    </div>
  )
}

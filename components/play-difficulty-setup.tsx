'use client'

import Image from 'next/image'
import type { LucideIcon } from 'lucide-react'
import { Flame, Lock, Sparkles, Star, Trophy, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DIFFICULTY_TIER_LABELS, DIFFICULTY_TIERS, getTiersWithQuestions } from '@/lib/quiz-difficulty'
import { cn } from '@/lib/utils'
import {
  getChallengeCoinRewardForQuiz,
  isTierLockedForChallenge,
  tierCoinRewardDisplay,
} from '@/lib/tier-challenge-progress'
import type { DifficultyTier, Quiz } from '@/lib/types'

interface PlayDifficultySetupProps {
  quiz: Quiz
  mode: 'practice' | 'challenge'
  selectedTier: DifficultyTier
  onTierChange: (tier: DifficultyTier) => void
  onStart: () => void
  onBack: () => void
  /** Required for challenge tier locks; practice ignores. */
  challengeStudentKey?: string | null
  /** Shown when launching from a student profile */
  studentHint?: string
}

const TIER_GAME: Record<
  DifficultyTier,
  {
    Icon: LucideIcon
    stars: number
    tagline: string
    /** Left accent + icon ring */
    accent: string
    /** Card background */
    panel: string
    /** Selected ring + glow */
    activeRing: string
    /** Icon circle */
    iconWrap: string
    iconColor: string
  }
> = {
  easy: {
    Icon: Sparkles,
    stars: 1,
    tagline: 'Nice & easy',
    accent: 'from-emerald-400 via-emerald-500 to-teal-600',
    panel:
      'bg-gradient-to-br from-emerald-500/15 via-[var(--surface-2)] to-[var(--surface-1)] border-emerald-500/35',
    activeRing:
      'ring-2 ring-emerald-400/80 shadow-[0_0_28px_rgba(52,211,153,0.35)] scale-[1.02] motion-reduce:scale-100 motion-reduce:shadow-none',
    iconWrap: 'bg-gradient-to-br from-emerald-400/30 to-emerald-700/40 ring-2 ring-emerald-400/50 shadow-[0_0_16px_rgba(52,211,153,0.4)]',
    iconColor: 'text-emerald-200',
  },
  mid: {
    Icon: Zap,
    stars: 2,
    tagline: 'Balanced pace',
    accent: 'from-amber-400 via-orange-500 to-amber-600',
    panel:
      'bg-gradient-to-br from-amber-500/15 via-[var(--surface-2)] to-[var(--surface-1)] border-amber-500/40',
    activeRing:
      'ring-2 ring-amber-400/85 shadow-[0_0_28px_rgba(251,191,36,0.38)] scale-[1.02] motion-reduce:scale-100 motion-reduce:shadow-none',
    iconWrap: 'bg-gradient-to-br from-amber-400/35 to-orange-700/45 ring-2 ring-amber-400/55 shadow-[0_0_16px_rgba(251,191,36,0.45)]',
    iconColor: 'text-amber-100',
  },
  hard: {
    Icon: Flame,
    stars: 3,
    tagline: 'Boss mode',
    accent: 'from-rose-500 via-red-500 to-orange-600',
    panel:
      'bg-gradient-to-br from-red-500/18 via-[var(--surface-2)] to-[var(--surface-1)] border-red-500/45',
    activeRing:
      'ring-2 ring-red-400/90 shadow-[0_0_30px_rgba(248,113,113,0.42)] scale-[1.02] motion-reduce:scale-100 motion-reduce:shadow-none',
    iconWrap: 'bg-gradient-to-br from-red-500/40 to-rose-900/50 ring-2 ring-red-400/55 shadow-[0_0_18px_rgba(248,113,113,0.5)]',
    iconColor: 'text-red-100',
  },
}

function TierStars({ count, className }: { count: number; className?: string }) {
  return (
    <div className={cn('flex gap-0.5', className)} aria-hidden>
      {[0, 1, 2].map((i) => (
        <Star
          key={i}
          size={14}
          strokeWidth={2}
          className={cn(
            'shrink-0',
            i < count ? 'fill-[var(--brand-yellow)] text-[var(--brand-yellow)] drop-shadow-[0_0_6px_rgba(250,204,21,0.55)]' : 'fill-transparent text-muted-foreground/35',
          )}
        />
      ))}
    </div>
  )
}

function CoinPill({ amount, className }: { amount: number; className?: string }) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-1 rounded-full border border-amber-400/50 bg-gradient-to-b from-amber-300/95 to-amber-600/90 px-2.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_2px_8px_rgba(0,0,0,0.35)]',
        className,
      )}
    >
      <Image src="/coins.png" alt="" width={22} height={22} className="h-5 w-5 shrink-0 object-contain drop-shadow-sm" />
      <span className="text-sm font-black tabular-nums text-amber-950">+{amount}</span>
    </div>
  )
}

export function PlayDifficultySetup({
  quiz,
  mode,
  selectedTier,
  onTierChange,
  onStart,
  onBack,
  challengeStudentKey,
  studentHint,
}: PlayDifficultySetupProps) {
  const tiersWithContent = getTiersWithQuestions(quiz)
  const baseCoins =
    mode === 'challenge' && challengeStudentKey
      ? getChallengeCoinRewardForQuiz(quiz.id, challengeStudentKey)
      : 0

  const tierLocked = (tier: DifficultyTier) =>
    mode === 'challenge' && isTierLockedForChallenge(quiz, tier, challengeStudentKey ?? null)

  const canSelect = (tier: DifficultyTier) => tiersWithContent.includes(tier) && !tierLocked(tier)

  const canStart = canSelect(selectedTier) && tiersWithContent.length > 0

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--surface-1)]">
      <header className="flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-gradient-to-r from-[var(--surface-2)] via-[var(--surface-1)] to-[var(--surface-2)] px-4 py-4 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--brand-blue)] to-violet-600 shadow-[0_0_22px_rgba(59,130,246,0.45),inset_0_1px_0_rgba(255,255,255,0.2)] ring-2 ring-white/15">
            <Trophy size={22} className="text-white drop-shadow-md" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--brand-blue-bright)]">Pick your path</p>
            <h1 className="truncate text-lg font-black tracking-tight text-foreground">Difficulty</h1>
            <p className="truncate text-xs text-muted-foreground">{quiz.name}</p>
          </div>
        </div>
        <Button type="button" variant="outline" onClick={onBack} className="border-[var(--border)] shrink-0 font-semibold">
          Back
        </Button>
      </header>

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-8">
        <div className="mb-6 text-center">
          <p className="text-sm font-black uppercase tracking-wide text-foreground drop-shadow-sm">
            {mode === 'challenge' ? 'Challenge mode' : 'Practice mode'}
          </p>
          {studentHint ? (
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{studentHint}</p>
          ) : mode === 'challenge' ? (
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Clear each tier to unlock the next. More stars = bigger rewards.
            </p>
          ) : (
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Pick a question bank. Your teacher can set a default on your profile.
            </p>
          )}
        </div>

        {tiersWithContent.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)]/80 px-4 py-8 text-center text-sm text-muted-foreground">
            This quiz has no questions in any difficulty tier yet. Edit the quiz in the library.
          </p>
        ) : (
          <>
            <div className="grid gap-4">
              {DIFFICULTY_TIERS.map((tier) => {
                const has = tiersWithContent.includes(tier)
                const locked = has && tierLocked(tier)
                const active = selectedTier === tier && canSelect(tier)
                const reward = baseCoins > 0 ? tierCoinRewardDisplay(baseCoins, tier) : null
                const g = TIER_GAME[tier]
                const Icon = g.Icon

                if (!has) {
                  return (
                    <div
                      key={tier}
                      className={cn(
                        'relative flex cursor-not-allowed items-center gap-3 overflow-hidden rounded-2xl border border-dashed border-muted-foreground/25 px-4 py-4 opacity-45',
                        g.panel,
                      )}
                    >
                      <div className={cn('absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b opacity-40', g.accent)} />
                      <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl opacity-50', g.iconWrap)}>
                        <Icon className={cn('h-6 w-6', g.iconColor)} strokeWidth={2} />
                      </div>
                      <div>
                        <span className="text-base font-black text-muted-foreground">{DIFFICULTY_TIER_LABELS[tier]}</span>
                        <span className="mt-0.5 block text-xs font-medium text-muted-foreground/80">No questions in this bank</span>
                      </div>
                    </div>
                  )
                }

                if (locked) {
                  return (
                    <div
                      key={tier}
                      className={cn('relative overflow-hidden rounded-2xl border px-4 py-4 text-left', g.panel)}
                    >
                      <div className={cn('absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b opacity-70', g.accent)} />
                      <div className="pointer-events-none absolute inset-0 z-[1] flex flex-col items-center justify-center gap-2 bg-[var(--surface-1)]/65 backdrop-blur-[3px]">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-3)]/90 ring-2 ring-muted-foreground/40 shadow-lg">
                          <Lock className="h-6 w-6 text-muted-foreground" strokeWidth={2.25} aria-hidden />
                        </div>
                        <span className="rounded-full bg-[var(--surface-2)]/95 px-3 py-0.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          Locked
                        </span>
                      </div>
                      <div className="relative z-[2] flex items-start gap-3 pl-2 opacity-50">
                        <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', g.iconWrap)}>
                          <Icon className={cn('h-6 w-6 blur-[3px]', g.iconColor)} strokeWidth={2} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-lg font-black tracking-[0.35em] text-muted-foreground">???</p>
                          <p className="mt-1 text-xs font-medium text-muted-foreground">Beat the previous tier to unlock.</p>
                          <TierStars count={g.stars} className="mt-2 opacity-60" />
                        </div>
                      </div>
                      {reward != null && reward > 0 ? (
                        <div className="absolute right-3 top-1/2 z-[3] -translate-y-1/2">
                          <CoinPill amount={reward} />
                        </div>
                      ) : null}
                    </div>
                  )
                }

                return (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => onTierChange(tier)}
                    className={cn(
                      'group relative flex w-full items-start gap-3 overflow-hidden rounded-2xl border px-4 py-4 text-left transition-all duration-200 motion-reduce:transition-none',
                      g.panel,
                      active ? g.activeRing : 'hover:brightness-110 hover:shadow-lg',
                    )}
                  >
                    <div className={cn('absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b', g.accent)} />
                    <div
                      className={cn(
                        'relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl transition-transform duration-200 group-hover:scale-105',
                        g.iconWrap,
                      )}
                    >
                      <Icon className={cn('h-7 w-7', g.iconColor)} strokeWidth={2} aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-black tracking-tight text-foreground drop-shadow-sm">
                          {DIFFICULTY_TIER_LABELS[tier]}
                        </span>
                        <TierStars count={g.stars} />
                      </div>
                      <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.tagline}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground/90">Question bank ready — tap to select</p>
                    </div>
                    {mode === 'challenge' && reward != null && reward > 0 ? <CoinPill amount={reward} className="self-center" /> : null}
                  </button>
                )
              })}
            </div>

            <Button
              type="button"
              disabled={!canStart}
              onClick={onStart}
              className={cn(
                'mt-10 w-full border-2 border-white/20 py-7 text-base font-black uppercase tracking-wide text-white shadow-[0_6px_0_0_rgba(15,23,42,0.9),0_12px_32px_rgba(59,130,246,0.35)] transition-transform active:translate-y-0.5 active:shadow-[0_3px_0_0_rgba(15,23,42,0.9)] disabled:opacity-50 disabled:shadow-none',
                'bg-gradient-to-r from-[var(--brand-blue)] via-blue-500 to-violet-600 hover:from-blue-500 hover:via-[var(--brand-blue-bright)] hover:to-violet-500',
              )}
            >
              {mode === 'challenge' ? 'Start challenge' : 'Start practice'}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

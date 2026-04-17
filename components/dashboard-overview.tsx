'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, BookOpenText, Clock3, PlayCircle, Sparkles, Target, Trophy, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getQuizzes, getStudentResults } from '@/lib/storage'
import { getStudentsListView } from '@/lib/students/selectors'

export function DashboardOverview() {
  const [quizCount, setQuizCount] = useState(0)
  const [resultCount, setResultCount] = useState(0)
  const [students, setStudents] = useState<ReturnType<typeof getStudentsListView>>([])
  const [latestResultAt, setLatestResultAt] = useState<string | null>(null)

  useEffect(() => {
    const quizzes = getQuizzes()
    const results = getStudentResults()
    const list = getStudentsListView()
    setQuizCount(quizzes.length)
    setResultCount(results.length)
    setStudents(list)
    const newest = [...results]
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())[0]
      ?.completedAt
    setLatestResultAt(newest ?? null)
  }, [])

  const studentCount = students.length
  const studentsWithProgress = students.filter((s) => s.progressLabel !== '0% progress').length
  const activeChallenges = students.filter((s) => s.currentChallengeLabel.startsWith('Current challenge:')).length
  const priorityStudents = useMemo(() => {
    const progressPct = (label: string) => {
      const parsed = Number(label.replace('% progress', ''))
      return Number.isFinite(parsed) ? parsed : 0
    }
    return [...students]
      .sort((a, b) => {
        const aCurrent = a.currentChallengeLabel.startsWith('Current challenge:') ? 1 : 0
        const bCurrent = b.currentChallengeLabel.startsWith('Current challenge:') ? 1 : 0
        if (aCurrent !== bCurrent) return bCurrent - aCurrent
        return progressPct(b.progressLabel) - progressPct(a.progressLabel)
      })
      .slice(0, 5)
  }, [students])
  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      }),
    [],
  )

  const stats = useMemo(
    () => [
      { label: 'Quizzes ready', value: quizCount, icon: BookOpenText, tone: 'blue' },
      { label: 'Students in roster', value: studentCount, icon: Users, tone: 'green' },
      { label: 'Results logged', value: resultCount, icon: Trophy, tone: 'yellow' },
      { label: 'Active challenges', value: activeChallenges, icon: Target, tone: 'blue' },
    ],
    [activeChallenges, quizCount, resultCount, studentCount],
  )

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-3">
        <article className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 lg:col-span-2">
          <div
            className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-30 blur-2xl"
            style={{ background: 'var(--brand-blue)' }}
            aria-hidden
          />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Today</p>
            <h2 className="mt-1 text-2xl font-black text-foreground">{todayLabel}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {latestResultAt
                ? `Last result logged ${new Date(latestResultAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.`
                : 'No results logged yet. Start a challenge to begin today’s momentum.'}
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <Link
                href="/games/timed-challenge"
                className="group rounded-xl border border-[var(--brand-blue)] bg-[var(--brand-blue)]/10 px-3 py-3 transition hover:bg-[var(--brand-blue)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-blue)]"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <PlayCircle size={16} className="text-[var(--brand-blue-bright)]" />
                  Start game
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Launch Timed Challenge</p>
              </Link>
              <Link
                href="/students"
                className="group rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3 transition hover:border-[var(--brand-green)] hover:bg-[var(--surface-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-green)]"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Users size={16} className="text-[var(--brand-green)]" />
                  Student view
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Profiles and challenge paths</p>
              </Link>
              <Link
                href="/games"
                className="group rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3 transition hover:border-[var(--brand-blue)] hover:bg-[var(--surface-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-blue)]"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <BookOpenText size={16} className="text-[var(--brand-blue-bright)]" />
                  Games hub
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Manage class activities</p>
              </Link>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Snapshot</p>
          <ul className="mt-3 space-y-2 text-sm text-foreground">
            <li>{studentCount} students in roster</li>
            <li>{studentsWithProgress} with recorded progress</li>
            <li>{activeChallenges} active current challenges</li>
          </ul>
          <div className="mt-4 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock3 size={13} />
            Live from local storage
          </div>
        </article>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          const toneClass =
            stat.tone === 'green'
              ? 'text-[var(--brand-green)]'
              : stat.tone === 'yellow'
                ? 'text-[var(--chart-4)]'
                : 'text-[var(--brand-blue-bright)]'
          return (
            <article
              key={stat.label}
              className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 transition hover:-translate-y-0.5 hover:border-[var(--brand-blue)]"
            >
              <div className="mb-3 inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-2">
                <Icon size={16} className={toneClass} />
              </div>
              <p className="text-3xl font-black text-foreground">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </article>
          )
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        <article className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 lg:col-span-3">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Student snapshot</p>
              <h3 className="mt-1 text-lg font-bold text-foreground">Priority roster</h3>
            </div>
            <Button asChild variant="outline" size="sm" className="border-[var(--border)] hover:border-[var(--brand-blue)]">
              <Link href="/students">See all</Link>
            </Button>
          </div>

          {priorityStudents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No student activity yet. Add or play with a student to populate this list.</p>
          ) : (
            <div className="space-y-3">
              {priorityStudents.map((student) => {
                const progress = Number(student.progressLabel.replace('% progress', '')) || 0
                const hasCurrent = student.currentChallengeLabel.startsWith('Current challenge:')
                return (
                  <Link
                    key={student.id}
                    href={`/students/${student.id}`}
                    className="block rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 transition hover:border-[var(--brand-blue)] hover:bg-[var(--surface-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-blue)]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{student.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{student.currentChallengeLabel}</p>
                      </div>
                      <span
                        className={[
                          'rounded-full border px-2 py-0.5 text-xs font-semibold',
                          hasCurrent
                            ? 'border-[var(--brand-blue)] text-[var(--brand-blue-bright)]'
                            : 'border-[var(--border)] text-muted-foreground',
                        ].join(' ')}
                      >
                        {hasCurrent ? 'Active' : 'Waiting'}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-1)]">
                      <div
                        className="h-full rounded-full bg-[var(--brand-blue)]"
                        style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{student.progressLabel}</p>
                  </Link>
                )
              })}
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quick launch</p>
          <h3 className="mt-1 text-lg font-bold text-foreground">Ready for class run</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Start Timed Challenge or jump into student pages in one click.
          </p>
          <div className="mt-4 space-y-2">
            <Button asChild className="w-full justify-between bg-[var(--brand-blue)] text-white hover:bg-[var(--brand-blue-bright)]">
              <Link href="/games/timed-challenge">
                <span className="inline-flex items-center gap-2">
                  <PlayCircle size={16} />
                  Open Timed Challenge
                </span>
                <ArrowRight size={16} />
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-between border-[var(--border)] hover:border-[var(--brand-green)]">
              <Link href="/students">
                <span className="inline-flex items-center gap-2">
                  <Users size={16} />
                  Open Students
                </span>
                <ArrowRight size={16} />
              </Link>
            </Button>
          </div>
          <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs text-muted-foreground">
            <Sparkles size={13} className="text-[var(--brand-blue-bright)]" />
            Fast path: Dashboard → Start game → Student profile follow-up
          </div>
        </article>
      </section>
    </div>
  )
}

'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, BookOpenText, Users, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getKnownStudentSummaries, getQuizzes, getStudentResults } from '@/lib/storage'

export function DashboardOverview() {
  const [quizCount, setQuizCount] = useState(0)
  const [resultCount, setResultCount] = useState(0)
  const [studentCount, setStudentCount] = useState(0)

  useEffect(() => {
    setQuizCount(getQuizzes().length)
    setResultCount(getStudentResults().length)
    setStudentCount(getKnownStudentSummaries().length)
  }, [])

  const stats = useMemo(
    () => [
      { label: 'Quizzes ready', value: quizCount, icon: BookOpenText },
      { label: 'Students seen', value: studentCount, icon: Users },
      { label: 'Results logged', value: resultCount, icon: Trophy },
    ],
    [quizCount, resultCount, studentCount],
  )

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <article key={stat.label} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
              <div className="mb-3 inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-2">
                <Icon size={16} className="text-[var(--brand-blue-bright)]" />
              </div>
              <p className="text-2xl font-black text-foreground">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </article>
          )
        })}
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <Link
          href="/games/timed-challenge"
          className="group rounded-2xl border border-[var(--brand-blue)] bg-[var(--card)] p-5 shadow-[0_0_18px_rgba(59,130,246,0.15)]"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-blue-bright)]">Quick launch</p>
          <h2 className="mt-1 text-xl font-bold text-foreground">Open Timed Challenge</h2>
          <p className="mt-2 text-sm text-muted-foreground">Jump straight into your game dashboard.</p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[var(--brand-blue-bright)]">
            Open now <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Class flow</p>
          <h3 className="mt-1 text-lg font-bold text-foreground">Go to Students</h3>
          <p className="mt-2 text-sm text-muted-foreground">Review who has played and open detailed results.</p>
          <Button asChild variant="outline" className="mt-4 border-[var(--border)] hover:border-[var(--brand-green)]">
            <Link href="/students">Open Students</Link>
          </Button>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Teacher note</p>
          <h3 className="mt-1 text-lg font-bold text-foreground">Keep navigation simple</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Dashboard for overview, Games to launch, Students for review, Settings for prep.
          </p>
          <Button asChild variant="outline" className="mt-4 border-[var(--border)] hover:border-[var(--brand-blue)]">
            <Link href="/games">Open Games</Link>
          </Button>
        </div>
      </section>
    </div>
  )
}

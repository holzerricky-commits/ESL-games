'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, CalendarClock, Clock3, Play } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { getTodaysClassSessionsForTeacher, startStudentClassSession, type TodaysClassSessionRow } from '@/lib/students/selectors'

export function DashboardOverview() {
  const router = useRouter()
  const [todaysClasses, setTodaysClasses] = useState<TodaysClassSessionRow[]>([])
  const [startBusyId, setStartBusyId] = useState<string | null>(null)

  const refreshTodays = useCallback(() => {
    setTodaysClasses(getTodaysClassSessionsForTeacher())
  }, [])

  useEffect(() => {
    refreshTodays()
    const id = window.setInterval(refreshTodays, 60_000)
    return () => window.clearInterval(id)
  }, [refreshTodays])

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      }),
    [],
  )

  function handleStartClass(row: TodaysClassSessionRow) {
    const { studentId, session } = row
    if (session.status === 'completed' || session.status === 'cancelled') return
    if (session.status !== 'in_progress') {
      setStartBusyId(session.id)
      const started = startStudentClassSession(studentId, session.id)
      setStartBusyId(null)
      if (!started.ok) {
        toast.error(started.error)
        return
      }
      refreshTodays()
    }
    router.push(`/students/${studentId}/map?classSession=${encodeURIComponent(session.id)}`)
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-30 blur-2xl"
          style={{ background: 'var(--brand-blue)' }}
          aria-hidden
        />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Today</p>
          <h2 className="mt-1 text-2xl font-black text-foreground">{todayLabel}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your classes for today are below. Start goes straight to the class map.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Schedule</p>
            <h3 className="mt-1 text-lg font-bold text-foreground">Today&apos;s classes</h3>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => refreshTodays()}>
            Refresh
          </Button>
        </div>

        {todaysClasses.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No classes on the calendar for today. Add slots on the Schedule page or open a student&apos;s plan to add
            classes.
          </p>
        ) : (
          <ul className="space-y-3">
            {todaysClasses.map((row) => {
              const t = new Date(row.session.scheduledFor)
              const timeStr = Number.isFinite(t.getTime())
                ? t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                : row.session.scheduledFor
              const isLive = row.session.status === 'in_progress'
              return (
                <li
                  key={`${row.studentId}-${row.session.id}`}
                  className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-0.5 text-xs font-semibold text-foreground">
                        <Clock3 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                        {timeStr}
                      </span>
                      {isLive ? (
                        <span className="rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-950 dark:text-amber-50">
                          Live
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-sm font-semibold text-foreground">{row.studentName}</p>
                    <p className="truncate text-sm text-muted-foreground">{row.session.title}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/students/${row.studentId}/plan?tab=classes`}>
                        <CalendarClock className="mr-1.5 h-4 w-4" />
                        Plan
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                      disabled={startBusyId === row.session.id}
                      onClick={() => handleStartClass(row)}
                    >
                      {startBusyId === row.session.id ? (
                        '…'
                      ) : (
                        <>
                          <Play className="mr-1.5 h-4 w-4" />
                          {isLive ? 'Continue' : 'Start'}
                        </>
                      )}
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)]/50 px-4 py-3 text-center text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Tip: a reminder can appear in the corner when a class is within 20 minutes.
        </span>
      </section>
    </div>
  )
}

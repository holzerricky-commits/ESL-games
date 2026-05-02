'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { getTodaysClassSessionsForTeacher, startStudentClassSession, type TodaysClassSessionRow } from '@/lib/students/selectors'

const WINDOW_MS = 20 * 60 * 1000
const STORAGE_PREFIX = 'class-upcoming-reminder-dismissed'

function dismissStorageKey(sessionId: string): string {
  const d = new Date()
  const dayKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
  return `${STORAGE_PREFIX}:${sessionId}:${dayKey}`
}

function isDismissed(sessionId: string): boolean {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem(dismissStorageKey(sessionId)) === '1'
}

function setDismissed(sessionId: string) {
  try {
    sessionStorage.setItem(dismissStorageKey(sessionId), '1')
  } catch {
    /* ignore quota */
  }
}

function reminderCandidates(rows: TodaysClassSessionRow[], nowMs: number): TodaysClassSessionRow[] {
  return rows.filter((row) => {
    if (row.session.status === 'completed' || row.session.status === 'cancelled') return false
    if (row.session.status === 'in_progress') return false
    if (row.session.status !== 'planned' && row.session.status !== 'prepared') return false
    const startMs = new Date(row.session.scheduledFor).getTime()
    if (!Number.isFinite(startMs)) return false
    return nowMs >= startMs - WINDOW_MS && nowMs < startMs
  })
}

export function ClassUpcomingReminder() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const mapSessionId = pathname?.includes('/map') ? searchParams.get('classSession')?.trim() ?? null : null

  const [tick, setTick] = useState(0)
  const [, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now())
      setTick((n) => n + 1)
    }, 30_000)
    return () => window.clearInterval(id)
  }, [])

  const visible = useMemo(() => {
    void tick
    const nowMs = Date.now()
    const rows = getTodaysClassSessionsForTeacher()
    const candidates = reminderCandidates(rows, nowMs).filter((r) => !isDismissed(r.session.id))
    if (mapSessionId) {
      return candidates.filter((r) => r.session.id !== mapSessionId)
    }
    return candidates
  }, [tick, mapSessionId])

  const dismissOne = useCallback((sessionId: string) => {
    setDismissed(sessionId)
    setTick((n) => n + 1)
  }, [])

  const openClass = useCallback((row: TodaysClassSessionRow) => {
    const { studentId, session } = row
    if (session.status !== 'in_progress') {
      const started = startStudentClassSession(studentId, session.id)
      if (!started.ok) {
        toast.error(started.error)
        return
      }
    }
    router.push(`/students/${studentId}/map?classSession=${encodeURIComponent(session.id)}`)
  }, [router])

  if (visible.length === 0) return null

  return (
    <div
      className="pointer-events-auto fixed bottom-4 right-4 z-[100] w-[min(100vw-2rem,22rem)] rounded-xl border border-amber-500/40 bg-amber-50/95 p-3 text-sm shadow-lg backdrop-blur-sm dark:border-amber-500/35 dark:bg-amber-950/90 dark:text-amber-50"
      role="status"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="font-semibold text-amber-950 dark:text-amber-50">Class starting soon</p>
        <button
          type="button"
          className="rounded p-1 text-amber-900/70 hover:bg-amber-900/10 dark:text-amber-100/80 dark:hover:bg-amber-100/10"
          aria-label="Dismiss reminder"
          onClick={() => {
            for (const r of visible) dismissOne(r.session.id)
          }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <ul className="max-h-[40vh] space-y-2 overflow-y-auto">
        {visible.map((row) => {
          const t = new Date(row.session.scheduledFor)
          const timeStr = Number.isFinite(t.getTime())
            ? t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
            : row.session.scheduledFor
          return (
            <li
              key={row.session.id}
              className="rounded-lg border border-amber-600/20 bg-white/60 p-2 dark:border-amber-400/20 dark:bg-amber-950/50"
            >
              <p className="text-xs font-medium text-amber-950 dark:text-amber-100">{timeStr}</p>
              <p className="truncate text-sm font-semibold text-foreground">{row.studentName}</p>
              <p className="truncate text-xs text-muted-foreground">{row.session.title}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" size="sm" className="h-8 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => openClass(row)}>
                  Open
                </Button>
                <Button asChild variant="outline" size="sm" className="h-8">
                  <Link href={`/students/${row.studentId}/plan?tab=classes`}>Plan</Link>
                </Button>
                <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => dismissOne(row.session.id)}>
                  Hide
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

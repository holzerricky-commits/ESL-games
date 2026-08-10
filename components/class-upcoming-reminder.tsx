'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ensureStudentRecordsHydrated } from '@/lib/local-data/student-records-client'
import { CLASS_STARTING_SOON_MINUTES } from '@/lib/students/class-schedule-lifecycle'
import { clearMapBookOverlayOpenSession } from '@/lib/students/map-book-overlay-session'
import {
  buildPrepareLessonMapHref,
  getTodaysClassSessionsForTeacher,
  startStudentClassSession,
  type TodaysClassSessionRow,
} from '@/lib/students/selectors'

const WINDOW_MS = CLASS_STARTING_SOON_MINUTES * 60 * 1000
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

/** Planned/prepared in the Starting window only — not live, missed, or done. */
function reminderCandidates(rows: TodaysClassSessionRow[], nowMs: number): TodaysClassSessionRow[] {
  return rows.filter((row) => {
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

  const openClass = useCallback(
    async (row: TodaysClassSessionRow) => {
      const { studentId, session } = row
      try {
        await ensureStudentRecordsHydrated()
        if (session.status !== 'in_progress') {
          const started = startStudentClassSession(studentId, session.id)
          if (!started.ok) {
            toast.error(started.error)
            return
          }
        }
        clearMapBookOverlayOpenSession(studentId)
        router.push(buildPrepareLessonMapHref(studentId, session.id))
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not open class.')
      }
    },
    [router],
  )

  if (visible.length === 0) return null

  return (
    <div
      className="pointer-events-auto fixed bottom-4 right-4 z-[100] w-[min(100vw-2rem,18rem)] rounded-lg border border-amber-500/35 bg-amber-50/95 p-2.5 text-sm shadow-md backdrop-blur-sm dark:border-amber-500/30 dark:bg-amber-950/90 dark:text-amber-50"
      role="status"
    >
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-950 dark:text-amber-50">
          Starting soon
        </p>
        <button
          type="button"
          className="rounded p-0.5 text-amber-900/70 hover:bg-amber-900/10 dark:text-amber-100/80 dark:hover:bg-amber-100/10"
          aria-label="Dismiss reminder"
          onClick={() => {
            for (const r of visible) dismissOne(r.session.id)
          }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <ul className="max-h-[32vh] space-y-1.5 overflow-y-auto">
        {visible.map((row) => {
          const t = new Date(row.session.scheduledFor)
          const timeStr = Number.isFinite(t.getTime())
            ? t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
            : row.session.scheduledFor
          return (
            <li
              key={row.session.id}
              className="rounded-md border border-amber-600/15 bg-white/50 px-2 py-1.5 dark:border-amber-400/15 dark:bg-amber-950/40"
            >
              <p className="text-[11px] font-medium text-amber-950 dark:text-amber-100">
                {timeStr} · {row.studentName}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  className="h-7 bg-emerald-600 px-2.5 text-xs text-white hover:bg-emerald-700"
                  onClick={() => void openClass(row)}
                >
                  Enter
                </Button>
                <Button asChild variant="outline" size="sm" className="h-7 px-2.5 text-xs">
                  <Link href={`/students/${row.studentId}?tab=classes`}>Prep</Link>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => dismissOne(row.session.id)}
                >
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

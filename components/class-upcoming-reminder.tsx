'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Play, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ensureStudentRecordsHydrated } from '@/lib/local-data/student-records-client'
import {
  CLASS_STARTING_SOON_MINUTES,
  formatClassCountdown,
} from '@/lib/students/class-schedule-lifecycle'
import { clearMapBookOverlayOpenSession } from '@/lib/students/map-book-overlay-session'
import { resolveStudentAvatarUrl } from '@/lib/students/student-avatar-url'
import {
  buildPrepareLessonMapHref,
  getTodaysClassSessionsForTeacher,
  startStudentClassSession,
  type TodaysClassSessionRow,
} from '@/lib/students/selectors'
import { cn } from '@/lib/utils'

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

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function ReminderAvatar({ studentId, name }: { studentId: string; name: string }) {
  const [imageFailed, setImageFailed] = useState(false)
  const src = resolveStudentAvatarUrl(studentId)

  return (
    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
      {!imageFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="chrome-avatar h-full w-full text-[11px]" aria-hidden>
          {initialsFromName(name)}
        </div>
      )}
    </div>
  )
}

function ReminderCard({
  row,
  nowMs,
  onEnter,
  onDismiss,
}: {
  row: TodaysClassSessionRow
  nowMs: number
  onEnter: (row: TodaysClassSessionRow) => void
  onDismiss: (sessionId: string) => void
}) {
  const t = new Date(row.session.scheduledFor)
  const timeStr = Number.isFinite(t.getTime())
    ? t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : row.session.scheduledFor
  const countdown = formatClassCountdown(row.session.scheduledFor, nowMs)

  return (
    <div
      className={cn(
        'w-[min(100vw-2rem,21rem)] overflow-hidden rounded-[22px] p-3.5',
        'bg-[var(--chrome-frost)] ring-1 ring-[var(--chrome-frost-border)]',
        'shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)]',
        'backdrop-blur-[20px] backdrop-saturate-[1.2]',
      )}
      role="status"
    >
      <div className="flex items-start gap-3">
        <ReminderAvatar studentId={row.studentId} name={row.studentName} />
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[13px] font-medium leading-none text-muted-foreground">Starting soon</p>
          <p className="mt-1 truncate text-[17px] font-semibold leading-snug tracking-tight text-foreground">
            {row.studentName}
          </p>
          <p className="mt-0.5 text-[13px] tabular-nums text-muted-foreground">
            {timeStr}
            {countdown ? ` · ${countdown}` : ''}
          </p>
        </div>
        <button
          type="button"
          className="chrome-icon-btn -mr-1 -mt-1 h-7 w-7 shrink-0"
          aria-label={`Hide reminder for ${row.studentName}`}
          onClick={() => onDismiss(row.session.id)}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-3.5 flex gap-2">
        <Button
          asChild
          variant="secondary"
          size="sm"
          className="h-8 flex-1 rounded-full bg-[var(--surface-3)] px-3 text-[13px] font-semibold tracking-tight text-foreground shadow-none hover:bg-[var(--surface-4)]"
        >
          <Link href={buildPrepareLessonMapHref(row.studentId, row.session.id)}>Prep</Link>
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-8 flex-1 rounded-full px-3 text-[13px] font-semibold tracking-tight shadow-none"
          onClick={() => onEnter(row)}
        >
          <Play className="h-3.5 w-3.5" aria-hidden />
          Enter
        </Button>
      </div>
    </div>
  )
}

export function ClassUpcomingReminder() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const mapSessionId = pathname?.includes('/map') ? searchParams.get('classSession')?.trim() ?? null : null

  const [tick, setTick] = useState(0)
  const [now, setNow] = useState(() => Date.now())

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
    <div className="pointer-events-auto fixed bottom-4 right-4 z-[100] flex flex-col-reverse gap-2">
      {visible.map((row) => (
        <ReminderCard
          key={row.session.id}
          row={row}
          nowMs={now}
          onEnter={(next) => void openClass(next)}
          onDismiss={dismissOne}
        />
      ))}
    </div>
  )
}

'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, NotebookPen, Play } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { MoveClassDialog } from '@/components/schedule/move-class-dialog'
import {
  teacherFieldClass,
  teacherFocusRingClass,
  teacherGhostBtnClass,
  teacherPrimaryBtnClass,
  teacherQuietBtnClass,
} from '@/components/teacher-chrome'
import { ensureStudentRecordsHydrated } from '@/lib/local-data/student-records-client'
import {
  addWeeks,
  getWeekDays,
  getWeekStart,
  isSameLocalDay,
} from '@/lib/schedule/week-view-layout'
import { canMoveClassSessionStatus } from '@/lib/schedule/move-class-targets'
import { fmtScheduleMinute } from '@/lib/schedule/schedule-time-labels'
import {
  classEntryActionLabel,
  formatClassCountdown,
  resolveClassEntryAction,
  resolveTodayClassTeachingState,
  todayClassStateLabel,
} from '@/lib/students/class-schedule-lifecycle'
import { computeClassEffectiveEndMs } from '@/lib/students/class-session-timer'
import { clearMapBookOverlayOpenSession } from '@/lib/students/map-book-overlay-session'
import { resolveStudentAvatarUrl } from '@/lib/students/student-avatar-url'
import {
  buildPrepareLessonMapHref,
  dismissPostClassRecapPrompt,
  getClassSessionsForDateRange,
  getDashboardDaySessions,
  getDashboardOffDayLeftovers,
  getLocalDayBoundsMs,
  markMissedClassTaughtAnyway,
  sessionNeedsPostClassRecap,
  startStudentClassSession,
  STUDENT_LOCAL_DATA_CHANGED_EVENT,
  updateStudentClassEndNote,
  type DashboardDaySessionRow,
  type DashboardOffDayLeftover,
} from '@/lib/students/selectors'
import { cn } from '@/lib/utils'

function rowKey(row: Pick<DashboardDaySessionRow, 'studentId' | 'session'>): string {
  return `${row.studentId}:${row.session.id}`
}

function startOfLocalDay(day: Date): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate())
}

function formatDayTitle(day: Date): string {
  return day.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}

function formatClock(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function formatWhenLabel(session: DashboardDaySessionRow['session'], nowMs: number): string {
  const scheduled = new Date(session.scheduledFor)
  if (!Number.isFinite(scheduled.getTime())) return session.scheduledFor
  const displayTime = formatClock(scheduled)
  const today = getLocalDayBoundsMs(new Date(nowMs))
  const yesterday = getLocalDayBoundsMs(new Date(nowMs - 86_400_000))
  const tomorrow = getLocalDayBoundsMs(new Date(nowMs + 86_400_000))
  const ms = scheduled.getTime()
  if (ms >= today.startMs && ms < today.endMs) return `Today · ${displayTime}`
  if (ms >= yesterday.startMs && ms < yesterday.endMs) return `Yesterday · ${displayTime}`
  if (ms >= tomorrow.startMs && ms < tomorrow.endMs) return `Tomorrow · ${displayTime}`
  const dayLabel = scheduled.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  return `${dayLabel} · ${displayTime}`
}

function placeLine(row: DashboardDaySessionRow): string {
  const section = row.session.selectedSection?.title?.trim()
  if (section) return section
  return row.session.title?.trim() || 'Class'
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function sessionStartMs(session: DashboardDaySessionRow['session']): number {
  const t = new Date(session.scheduledFor).getTime()
  return Number.isFinite(t) ? t : 0
}

function sessionEndMs(session: DashboardDaySessionRow['session']): number {
  return (
    computeClassEffectiveEndMs(
      session.scheduledFor,
      session.durationMin,
      session.extendedMinutesTotal ?? 0,
    ) ?? sessionStartMs(session) + session.durationMin * 60_000
  )
}

function StudentFace({
  studentId,
  name,
  avatarUrl,
}: {
  studentId: string
  name: string
  avatarUrl?: string
}) {
  const [failed, setFailed] = useState(false)
  const src = resolveStudentAvatarUrl(studentId, avatarUrl)
  return (
    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-[var(--surface-3)] ring-2 ring-[var(--surface-2)]">
      {!failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <div className="chrome-avatar flex h-full w-full items-center justify-center text-[11px]" aria-hidden>
          {initialsFromName(name)}
        </div>
      )}
    </div>
  )
}

function StatusChip({
  label,
  tone,
}: {
  label: string
  tone: 'live' | 'soon' | 'missed' | 'done' | 'quiet'
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-tight',
        tone === 'live' &&
          'bg-[color-mix(in_srgb,var(--brand-yellow)_16%,transparent)] text-[color-mix(in_srgb,var(--brand-yellow)_88%,#1a1a18)]',
        tone === 'soon' &&
          'bg-[color-mix(in_srgb,var(--brand-blue)_12%,transparent)] text-[var(--brand-blue)]',
        tone === 'missed' &&
          'bg-[color-mix(in_srgb,var(--brand-red)_12%,transparent)] text-[var(--brand-red)]',
        tone === 'done' &&
          'bg-[color-mix(in_srgb,var(--brand-green)_12%,transparent)] text-[var(--brand-green)]',
        tone === 'quiet' && 'bg-[var(--surface-3)] text-muted-foreground',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'size-1.5 shrink-0 rounded-full',
          tone === 'live' && 'bg-[var(--brand-yellow)]',
          tone === 'soon' && 'bg-[var(--brand-blue)]',
          tone === 'missed' && 'bg-[var(--brand-red)]',
          tone === 'done' && 'bg-[var(--brand-green)]',
          tone === 'quiet' && 'bg-muted-foreground/45',
        )}
      />
      {label}
    </span>
  )
}

function statusChipTone(
  state: ReturnType<typeof resolveTodayClassTeachingState>,
): 'live' | 'soon' | 'missed' | 'done' | 'quiet' {
  if (state === 'live' || state === 'grace' || state === 'ending') return 'live'
  if (state === 'starting') return 'soon'
  if (state === 'missed') return 'missed'
  if (state === 'done') return 'done'
  return 'quiet'
}

const LEFTOVER_PREVIEW = 3

type AgendaItem =
  | { kind: 'gap'; id: string; minutes: number }
  | { kind: 'now'; id: string }
  | { kind: 'class'; id: string; row: DashboardDaySessionRow }

function buildAgendaItems(
  rows: DashboardDaySessionRow[],
  nowMs: number,
  viewingToday: boolean,
): AgendaItem[] {
  const sorted = [...rows].sort((a, b) => sessionStartMs(a.session) - sessionStartMs(b.session))
  const items: AgendaItem[] = []
  let prevEnd = 0
  let nowPlaced = false

  for (let i = 0; i < sorted.length; i += 1) {
    const row = sorted[i]!
    const start = sessionStartMs(row.session)
    const end = sessionEndMs(row.session)

    if (viewingToday && !nowPlaced && nowMs < start) {
      if (i === 0 || nowMs >= prevEnd) {
        items.push({ kind: 'now', id: 'now' })
        nowPlaced = true
      }
    }

    if (i > 0 && start - prevEnd >= 20 * 60_000) {
      const gapMin = Math.round((start - prevEnd) / 60_000)
      items.push({ kind: 'gap', id: `gap-${row.session.id}`, minutes: gapMin })
    }

    items.push({ kind: 'class', id: rowKey(row), row })
    prevEnd = Math.max(prevEnd, end)

    if (viewingToday && !nowPlaced && nowMs >= start && nowMs < end) {
      // Now is inside this class — mark after the row via a trailing flag on next iteration; skip
      nowPlaced = true
    }
  }

  if (viewingToday && !nowPlaced && sorted.length > 0) {
    const lastEnd = sessionEndMs(sorted[sorted.length - 1]!.session)
    if (nowMs >= lastEnd) items.push({ kind: 'now', id: 'now' })
  }

  return items
}

export function DashboardOverview() {
  const router = useRouter()
  const [selectedDay, setSelectedDay] = useState(() => startOfLocalDay(new Date()))
  const [dayRows, setDayRows] = useState<DashboardDaySessionRow[]>([])
  const [weekSummaries, setWeekSummaries] = useState<
    Array<{ day: Date; count: number; hasMissed: boolean }>
  >([])
  const [leftovers, setLeftovers] = useState<DashboardOffDayLeftover[]>([])
  const [nextAfterEmpty, setNextAfterEmpty] = useState<DashboardDaySessionRow | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [startBusyId, setStartBusyId] = useState<string | null>(null)
  const [taughtBusyId, setTaughtBusyId] = useState<string | null>(null)
  const [moveRow, setMoveRow] = useState<DashboardDaySessionRow | null>(null)
  const [recapOpenKey, setRecapOpenKey] = useState<string | null>(null)
  const [recapDraft, setRecapDraft] = useState('')
  const [leftoversExpanded, setLeftoversExpanded] = useState(false)

  const weekStart = useMemo(() => getWeekStart(selectedDay), [selectedDay])
  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart])
  const viewingToday = isSameLocalDay(selectedDay, new Date(nowMs))

  const refreshBoard = useCallback(() => {
    const nextNow = Date.now()
    setNowMs(nextNow)
    const rows = getDashboardDaySessions(selectedDay)
    setDayRows(rows)
    setLeftovers(getDashboardOffDayLeftovers(selectedDay, nextNow))

    setWeekSummaries(
      weekDays.map((day) => {
        const daySessions = getDashboardDaySessions(day)
        return {
          day,
          count: daySessions.filter((r) => r.session.status !== 'cancelled').length,
          hasMissed: daySessions.some((r) => r.session.status === 'missed'),
        }
      }),
    )

    if (rows.length === 0) {
      const rangeEnd = new Date(selectedDay)
      rangeEnd.setDate(rangeEnd.getDate() + 14)
      const upcoming = getClassSessionsForDateRange(selectedDay, rangeEnd).filter((row) => {
        const s = row.session.status
        if (s !== 'planned' && s !== 'prepared') return false
        const t = new Date(row.session.scheduledFor).getTime()
        const { endMs } = getLocalDayBoundsMs(selectedDay)
        return Number.isFinite(t) && t >= endMs
      })
      setNextAfterEmpty(upcoming[0] ?? null)
    } else {
      setNextAfterEmpty(null)
    }
  }, [selectedDay, weekDays])

  const needsFastTick = useMemo(
    () =>
      dayRows.some((row) => {
        const state = resolveTodayClassTeachingState(row.session, nowMs)
        return state === 'live' || state === 'grace' || state === 'ending' || state === 'starting'
      }),
    [dayRows, nowMs],
  )

  useEffect(() => {
    let cancelled = false
    void ensureStudentRecordsHydrated().then(() => {
      if (!cancelled) refreshBoard()
    })
    refreshBoard()
    const id = window.setInterval(refreshBoard, needsFastTick ? 15_000 : 60_000)
    const onChanged = () => refreshBoard()
    window.addEventListener(STUDENT_LOCAL_DATA_CHANGED_EVENT, onChanged)
    return () => {
      cancelled = true
      window.clearInterval(id)
      window.removeEventListener(STUDENT_LOCAL_DATA_CHANGED_EVENT, onChanged)
    }
  }, [refreshBoard, needsFastTick])

  const agenda = useMemo(
    () => buildAgendaItems(dayRows, nowMs, viewingToday),
    [dayRows, nowMs, viewingToday],
  )

  async function handleStartClass(row: DashboardDaySessionRow) {
    const { studentId, session } = row
    if (session.status === 'completed' || session.status === 'cancelled' || session.status === 'missed') {
      toast.error(
        session.status === 'missed'
          ? 'This class was missed. Reschedule or mark taught.'
          : 'This class is already finished.',
      )
      refreshBoard()
      return
    }
    setStartBusyId(session.id)
    try {
      await ensureStudentRecordsHydrated()
      if (session.status !== 'in_progress') {
        const started = startStudentClassSession(studentId, session.id)
        if (!started.ok) {
          toast.error(started.error)
          return
        }
        refreshBoard()
      }
      clearMapBookOverlayOpenSession(studentId)
      router.push(buildPrepareLessonMapHref(studentId, session.id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not start class.')
    } finally {
      setStartBusyId(null)
    }
  }

  async function handleMarkTaught(row: DashboardDaySessionRow) {
    setTaughtBusyId(row.session.id)
    try {
      await ensureStudentRecordsHydrated()
      const result = markMissedClassTaughtAnyway(row.studentId, row.session.id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Marked as taught')
      refreshBoard()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update class.')
    } finally {
      setTaughtBusyId(null)
    }
  }

  function openRecapEditor(row: DashboardDaySessionRow) {
    setRecapOpenKey(rowKey(row))
    setRecapDraft(row.session.classEndNote?.trim() ?? '')
  }

  function closeRecapEditor() {
    setRecapOpenKey(null)
    setRecapDraft('')
  }

  function saveRecap(studentId: string, sessionId: string) {
    const r = updateStudentClassEndNote(studentId, sessionId, recapDraft)
    if (!r.ok) {
      toast.error(r.error)
      return
    }
    closeRecapEditor()
    toast.success('Note saved')
    refreshBoard()
  }

  function dismissRecap(studentId: string, sessionId: string) {
    const r = dismissPostClassRecapPrompt(studentId, sessionId)
    if (!r.ok) {
      toast.error(r.error)
      return
    }
    closeRecapEditor()
    refreshBoard()
  }

  function renderNoteIcon(row: DashboardDaySessionRow) {
    const key = rowKey(row)
    const existing = row.session.classEndNote?.trim() ?? ''
    const hasNote = existing.length > 0
    const needsPrompt = sessionNeedsPostClassRecap(row.session)
    const open = recapOpenKey === key

    return (
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (next) openRecapEditor(row)
          else closeRecapEditor()
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            title={hasNote ? 'Class note' : 'Leave a class note'}
            aria-label={hasNote ? 'View or edit class note' : 'Leave a class note'}
            className={cn(
              'chrome-icon-btn relative h-9 w-9',
              teacherFocusRingClass,
              hasNote && 'text-[var(--brand-green)]',
              !hasNote && needsPrompt && 'text-[color-mix(in_srgb,var(--brand-yellow)_85%,#1a1a18)]',
            )}
          >
            <NotebookPen className="h-4 w-4" strokeWidth={1.75} />
            {hasNote || needsPrompt ? (
              <span
                className={cn(
                  'absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full',
                  hasNote ? 'bg-[var(--brand-green)]' : 'bg-[var(--brand-yellow)]',
                )}
                aria-hidden
              />
            ) : null}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-80 space-y-3 rounded-2xl border-0 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.12)] ring-1 ring-[var(--chrome-frost-border)]"
        >
          <div>
            <p className="text-[15px] font-semibold tracking-tight text-foreground">
              {hasNote ? 'Class note' : 'Leave a note'}
            </p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {row.studentName}
              {row.session.title ? ` · ${row.session.title}` : ''}
            </p>
          </div>
          <textarea
            className={cn(teacherFieldClass, 'min-h-[88px] resize-none')}
            placeholder="What helped, what to repeat next class…"
            value={recapDraft}
            onChange={(e) => setRecapDraft(e.target.value)}
            autoFocus
          />
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {needsPrompt && !hasNote ? (
              <Button
                type="button"
                variant="ghost"
                className={teacherGhostBtnClass}
                onClick={() => dismissRecap(row.studentId, row.session.id)}
              >
                Not now
              </Button>
            ) : (
              <Button type="button" variant="ghost" className={teacherGhostBtnClass} onClick={closeRecapEditor}>
                Cancel
              </Button>
            )}
            <Button
              type="button"
              className={cn(teacherPrimaryBtnClass, 'bg-[var(--brand-green)] text-white hover:bg-[var(--brand-green-bright)]')}
              onClick={() => saveRecap(row.studentId, row.session.id)}
            >
              Save
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  function goToday() {
    setSelectedDay(startOfLocalDay(new Date()))
  }

  function shiftWeek(delta: number) {
    setSelectedDay(startOfLocalDay(addWeeks(selectedDay, delta)))
  }

  function selectDay(day: Date) {
    setSelectedDay(startOfLocalDay(day))
  }

  function renderRowActions(row: DashboardDaySessionRow) {
    const state = resolveTodayClassTeachingState(row.session, nowMs)
    const entry = resolveClassEntryAction(row.session, nowMs)
    const canMove = canMoveClassSessionStatus(row.session.status)

    if (state === 'missed' || entry === 'reschedule') {
      return (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          <Button type="button" className={teacherPrimaryBtnClass} onClick={() => setMoveRow(row)}>
            Reschedule
          </Button>
          <Button
            type="button"
            variant="ghost"
            className={teacherGhostBtnClass}
            disabled={taughtBusyId === row.session.id}
            onClick={() => void handleMarkTaught(row)}
          >
            {taughtBusyId === row.session.id ? '…' : 'Mark taught'}
          </Button>
        </div>
      )
    }

    if (state === 'done') {
      return renderNoteIcon(row)
    }

    if (state === 'cancelled' || entry === 'none') {
      return null
    }

    if (entry === 'enter' || entry === 'continue') {
      return (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {canMove ? (
            <Button type="button" variant="ghost" className={teacherGhostBtnClass} onClick={() => setMoveRow(row)}>
              Move
            </Button>
          ) : null}
          <Button
            type="button"
            className={cn(
              teacherPrimaryBtnClass,
              'bg-[var(--brand-green)] text-white hover:bg-[var(--brand-green-bright)]',
            )}
            disabled={startBusyId === row.session.id}
            onClick={() => void handleStartClass(row)}
          >
            {startBusyId === row.session.id ? (
              '…'
            ) : (
              <>
                <Play className="h-3.5 w-3.5" strokeWidth={2.25} />
                {classEntryActionLabel(entry)}
              </>
            )}
          </Button>
        </div>
      )
    }

    return (
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
        {canMove ? (
          <Button type="button" variant="ghost" className={teacherGhostBtnClass} onClick={() => setMoveRow(row)}>
            Move
          </Button>
        ) : null}
        <Button asChild className={teacherQuietBtnClass}>
          <Link href={buildPrepareLessonMapHref(row.studentId, row.session.id)}>Prepare</Link>
        </Button>
      </div>
    )
  }

  function renderClassRow(row: DashboardDaySessionRow) {
    const state = resolveTodayClassTeachingState(row.session, nowMs)
    const start = new Date(row.session.scheduledFor)
    const startLabel = Number.isFinite(start.getTime())
      ? fmtScheduleMinute(start.getHours() * 60 + start.getMinutes())
      : '—'
    const countdown = formatClassCountdown(row.session.scheduledFor, nowMs)
    const status = todayClassStateLabel(state)
    const isCancelled = state === 'cancelled'
    const chipTone = statusChipTone(state)
    const place = placeLine(row)

    return (
      <article
        key={rowKey(row)}
        className={cn(
          'rounded-[18px] bg-[var(--surface-2)] ring-1 ring-[var(--chrome-frost-border)]',
          isCancelled && 'opacity-55',
        )}
      >
        <div className="flex flex-col gap-3 px-3.5 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-4 sm:py-3.5">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <StudentFace studentId={row.studentId} name={row.studentName} avatarUrl={row.avatarUrl} />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Link
                  href={`/students/${row.studentId}`}
                  className={cn(
                    'truncate text-[15px] font-semibold tracking-tight text-foreground hover:underline',
                    isCancelled && 'line-through decoration-foreground/30',
                  )}
                >
                  {row.studentName}
                </Link>
                <StatusChip label={status} tone={chipTone} />
              </div>
              <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                <span className="font-medium tabular-nums text-foreground/80">{startLabel}</span>
                <span className="text-muted-foreground/80"> · {row.session.durationMin}m</span>
                {` · ${place}`}
                {countdown ? ` · ${countdown}` : ''}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 justify-end sm:pl-2">{renderRowActions(row)}</div>
        </div>
      </article>
    )
  }

  function renderLeftover(item: DashboardOffDayLeftover) {
    const key = `off-${item.kind}-${rowKey(item)}`
    return (
      <li
        key={key}
        className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] bg-[var(--surface-2)] px-3.5 py-2.5 ring-1 ring-[var(--chrome-frost-border)]"
      >
        <div className="flex min-w-0 items-center gap-3">
          <StudentFace studentId={item.studentId} name={item.studentName} avatarUrl={item.avatarUrl} />
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <p className="truncate text-[15px] font-semibold tracking-tight text-foreground">{item.studentName}</p>
              <StatusChip
                label={item.kind === 'missed' ? 'Missed' : 'Needs note'}
                tone={item.kind === 'missed' ? 'missed' : 'live'}
              />
            </div>
            <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
              {formatWhenLabel(item.session, nowMs)}
              {item.session.title ? ` · ${item.session.title}` : ''}
            </p>
          </div>
        </div>
        {item.kind === 'missed' ? (
          <div className="flex shrink-0 flex-wrap gap-1.5">
            <Button type="button" className={teacherPrimaryBtnClass} onClick={() => setMoveRow(item)}>
              Reschedule
            </Button>
            <Button
              type="button"
              variant="ghost"
              className={teacherGhostBtnClass}
              disabled={taughtBusyId === item.session.id}
              onClick={() => void handleMarkTaught(item)}
            >
              {taughtBusyId === item.session.id ? '…' : 'Mark taught'}
            </Button>
          </div>
        ) : (
          renderNoteIcon(item)
        )}
      </li>
    )
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={goToday}
            data-active={viewingToday}
            className="chrome-nav-pill px-3.5 py-1.5 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-blue)]/35"
          >
            Today
          </button>
          <div className="flex items-center">
            <button
              type="button"
              className={cn('chrome-icon-btn h-9 w-9', teacherFocusRingClass)}
              aria-label="Previous week"
              onClick={() => shiftWeek(-1)}
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </button>
            <button
              type="button"
              className={cn('chrome-icon-btn h-9 w-9', teacherFocusRingClass)}
              aria-label="Next week"
              onClick={() => shiftWeek(1)}
            >
              <ChevronRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </button>
          </div>
          <div className="min-w-0 pl-0.5">
            <h1 className="truncate text-[17px] font-semibold tracking-tight text-foreground sm:text-[22px]">
              {formatDayTitle(selectedDay)}
            </h1>
          </div>
        </div>
        <Link
          href="/schedule"
          className="chrome-nav-pill px-3.5 py-1.5 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-blue)]/35"
        >
          Full schedule
        </Link>
      </div>

      <div className="rounded-[22px] bg-[var(--surface-2)] p-1.5 ring-1 ring-[var(--chrome-frost-border)] sm:p-2">
        <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
          {weekSummaries.map(({ day, count, hasMissed }) => {
            const isSelected = isSameLocalDay(day, selectedDay)
            const isToday = isSameLocalDay(day, new Date(nowMs))
            const weekday = day.toLocaleDateString('en-US', { weekday: 'short' })
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => selectDay(day)}
                aria-pressed={isSelected}
                aria-current={isToday ? 'date' : undefined}
                aria-label={`${weekday} ${day.getDate()}${count > 0 ? `, ${count} ${count === 1 ? 'class' : 'classes'}` : ''}${hasMissed ? ', has missed class' : ''}`}
                className={cn(
                  'relative flex flex-col items-center gap-1 rounded-[16px] px-1 py-2.5 text-center chrome-motion',
                  teacherFocusRingClass,
                  isSelected
                    ? 'bg-[var(--chrome-pill-active)] text-[var(--chrome-pill-active-fg)]'
                    : 'text-foreground hover:bg-[var(--chrome-pill-hover)]',
                )}
              >
                <span
                  className={cn(
                    'text-[11px] font-medium tracking-tight',
                    isSelected
                      ? 'text-[var(--chrome-pill-active-fg)]'
                      : isToday
                        ? 'text-[var(--brand-blue)]'
                        : 'text-muted-foreground',
                  )}
                >
                  {weekday}
                </span>
                <span
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-[15px] font-semibold tabular-nums tracking-tight',
                    isToday && !isSelected && 'bg-[color-mix(in_srgb,var(--brand-blue)_12%,transparent)] text-[var(--brand-blue)]',
                    isToday && isSelected && 'bg-[color-mix(in_srgb,var(--brand-blue)_18%,transparent)]',
                  )}
                >
                  {day.getDate()}
                </span>
                <span
                  className={cn(
                    'min-h-[1rem] text-[11px] font-medium tabular-nums tracking-tight',
                    count === 0 && 'text-muted-foreground/35',
                    count > 0 && isSelected && 'text-[var(--chrome-pill-active-fg)]/80',
                    count > 0 && !isSelected && hasMissed && 'text-[var(--brand-red)]',
                    count > 0 && !isSelected && !hasMissed && 'text-muted-foreground',
                  )}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {leftovers.length > 0 ? (
        <section className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Still open
            <span className="ml-1 font-normal normal-case tracking-normal">({leftovers.length})</span>
          </p>
          <ul className="space-y-1.5">
            {(leftoversExpanded ? leftovers : leftovers.slice(0, LEFTOVER_PREVIEW)).map(renderLeftover)}
          </ul>
          {leftovers.length > LEFTOVER_PREVIEW ? (
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setLeftoversExpanded((v) => !v)}
            >
              {leftoversExpanded
                ? 'Show less'
                : `Show ${leftovers.length - LEFTOVER_PREVIEW} more`}
            </button>
          ) : null}
        </section>
      ) : null}

      {dayRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 bg-[var(--card)]/60 px-5 py-12 text-center">
          <p className="text-sm font-medium text-foreground">No classes this day</p>
          {nextAfterEmpty ? (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-muted-foreground">
                Next: {nextAfterEmpty.studentName} · {formatWhenLabel(nextAfterEmpty.session, nowMs)}
              </p>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  const when = new Date(nextAfterEmpty.session.scheduledFor)
                  if (!Number.isFinite(when.getTime())) return
                  const target = startOfLocalDay(when)
                  const inStrip = weekSummaries.find((s) => isSameLocalDay(s.day, target))
                  selectDay(inStrip?.day ?? target)
                }}
              >
                Open that day
              </Button>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Add classes on{' '}
              <Link href="/schedule" className="underline underline-offset-2">
                Schedule
              </Link>
              .
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {agenda.map((item) => {
            if (item.kind === 'gap') {
              return (
                <p key={item.id} className="px-1 text-[12px] text-muted-foreground">
                  {item.minutes >= 60
                    ? `${Math.floor(item.minutes / 60)}h${item.minutes % 60 ? ` ${item.minutes % 60}m` : ''} free`
                    : `${item.minutes}m free`}
                </p>
              )
            }
            if (item.kind === 'now') {
              return (
                <div key={item.id} className="flex items-center gap-2 px-1">
                  <span className="text-[11px] font-semibold tabular-nums text-[var(--brand-red)]">
                    {formatClock(new Date(nowMs))}
                  </span>
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--brand-red)]" aria-hidden />
                  <span className="h-px flex-1 bg-[var(--brand-red)]/70" />
                </div>
              )
            }
            return renderClassRow(item.row)
          })}
        </div>
      )}

      <MoveClassDialog
        open={!!moveRow}
        onOpenChange={(open) => {
          if (!open) setMoveRow(null)
        }}
        studentId={moveRow?.studentId ?? ''}
        studentName={moveRow?.studentName ?? ''}
        session={moveRow?.session ?? null}
        onMoved={() => {
          setMoveRow(null)
          refreshBoard()
        }}
      />
    </div>
  )
}

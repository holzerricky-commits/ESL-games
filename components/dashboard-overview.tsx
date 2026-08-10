'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarClock, Check, ChevronDown, Clock3, MoreHorizontal, Play, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoveClassDialog } from '@/components/schedule/move-class-dialog'
import { ReadingCheckPrepareGlanceLink } from '@/components/books/reading-check-prepare-glance-link'
import { ensureStudentRecordsHydrated } from '@/lib/local-data/student-records-client'
import { canMoveClassSessionStatus } from '@/lib/schedule/move-class-targets'
import {
  classEntryActionLabel,
  formatClassCountdown,
  resolveClassEntryAction,
  resolveTodayClassTeachingState,
  todayClassStateLabel,
  type TodayClassTeachingState,
} from '@/lib/students/class-schedule-lifecycle'
import { clearMapBookOverlayOpenSession } from '@/lib/students/map-book-overlay-session'
import {
  buildPrepareLessonMapHref,
  dismissPostClassRecapPrompt,
  getClassSessionsForDateRange,
  getDashboardStillOpenItems,
  getLocalDayBoundsMs,
  getTodaysClassSessionsForTeacher,
  getTodaysCompletedClassSessionsForTeacher,
  markMissedClassTaughtAnyway,
  pickDashboardNowRow,
  sessionNeedsPostClassRecap,
  startStudentClassSession,
  STUDENT_LOCAL_DATA_CHANGED_EVENT,
  updateStudentClassEndNote,
  type DashboardStillOpenItem,
  type TodaysClassSessionRow,
} from '@/lib/students/selectors'
import { cn } from '@/lib/utils'

const RECAP_PREVIEW_COUNT = 2

type StatusTone = 'neutral' | 'attention' | 'urgent' | 'success' | 'danger' | 'prep' | 'recap'

function toneForTeachingState(state: TodayClassTeachingState): StatusTone {
  switch (state) {
    case 'live':
    case 'starting':
      return 'attention'
    case 'grace':
    case 'ending':
      return 'urgent'
    case 'missed':
      return 'danger'
    case 'done':
      return 'success'
    case 'cancelled':
      return 'neutral'
    default:
      return 'neutral'
  }
}

function toneForStillOpenKind(kind: DashboardStillOpenItem['kind']): StatusTone {
  switch (kind) {
    case 'missed':
      return 'danger'
    case 'needs_recap':
      return 'recap'
    case 'needs_prep':
      return 'prep'
  }
}

function statusPillClass(tone: StatusTone): string {
  switch (tone) {
    case 'attention':
      return 'bg-[color-mix(in_srgb,var(--brand-yellow)_18%,white)] text-[color-mix(in_srgb,var(--brand-yellow)_85%,#1a1a18)]'
    case 'urgent':
      return 'bg-[color-mix(in_srgb,var(--brand-red)_14%,white)] text-[var(--brand-red)]'
    case 'success':
      return 'bg-[color-mix(in_srgb,var(--brand-green)_14%,white)] text-[var(--brand-green)]'
    case 'danger':
      return 'bg-[color-mix(in_srgb,var(--brand-red)_14%,white)] text-[var(--brand-red)]'
    case 'prep':
      return 'bg-[color-mix(in_srgb,var(--brand-blue)_12%,white)] text-[var(--brand-blue)]'
    case 'recap':
      return 'bg-[color-mix(in_srgb,var(--brand-yellow)_16%,white)] text-[color-mix(in_srgb,var(--brand-yellow)_80%,#1a1a18)]'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

function rowRailClass(tone: StatusTone): string {
  switch (tone) {
    case 'attention':
      return 'border-l-[3px] border-l-[var(--brand-yellow)]'
    case 'urgent':
    case 'danger':
      return 'border-l-[3px] border-l-[var(--brand-red)]'
    case 'success':
      return 'border-l-[3px] border-l-[var(--brand-green)]'
    case 'prep':
      return 'border-l-[3px] border-l-[var(--brand-blue)]'
    case 'recap':
      return 'border-l-[3px] border-l-[var(--brand-yellow)]'
    default:
      return 'border-l-[3px] border-l-transparent'
  }
}

function StatusPill({ label, tone }: { label: string; tone: StatusTone }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-none',
        statusPillClass(tone),
      )}
    >
      {label}
    </span>
  )
}

function formatClock(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function formatSessionTime(scheduledFor: string): string {
  const t = new Date(scheduledFor)
  if (!Number.isFinite(t.getTime())) return scheduledFor
  return formatClock(t)
}

function itemAnchorDate(session: TodaysClassSessionRow['session']): Date | null {
  const ended = session.classEndedAt ? new Date(session.classEndedAt) : null
  if (ended && Number.isFinite(ended.getTime())) return ended
  const scheduled = new Date(session.scheduledFor)
  return Number.isFinite(scheduled.getTime()) ? scheduled : null
}

/** Human when-label for leftovers (never time-only for other days). */
function formatWhenLabel(session: TodaysClassSessionRow['session'], nowMs: number): string {
  const anchor = itemAnchorDate(session)
  if (!anchor) return formatSessionTime(session.scheduledFor)
  const scheduled = new Date(session.scheduledFor)
  const displayTime = Number.isFinite(scheduled.getTime()) ? formatClock(scheduled) : formatClock(anchor)

  const today = getLocalDayBoundsMs(new Date(nowMs))
  const yesterday = getLocalDayBoundsMs(new Date(nowMs - 86_400_000))
  const tomorrow = getLocalDayBoundsMs(new Date(nowMs + 86_400_000))
  const anchorMs = anchor.getTime()

  if (anchorMs >= today.startMs && anchorMs < today.endMs) {
    return `Today · ${displayTime}`
  }
  if (anchorMs >= yesterday.startMs && anchorMs < yesterday.endMs) {
    return `Yesterday · ${displayTime}`
  }
  if (anchorMs >= tomorrow.startMs && anchorMs < tomorrow.endMs) {
    return `Tomorrow · ${displayTime}`
  }
  const dayLabel = anchor.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  return `${dayLabel} · ${displayTime}`
}

function stillOpenKindLabel(kind: DashboardStillOpenItem['kind']): string {
  switch (kind) {
    case 'missed':
      return 'Missed'
    case 'needs_recap':
      return 'Needs recap'
    case 'needs_prep':
      return 'Needs prep'
  }
}

function rowKey(row: Pick<TodaysClassSessionRow, 'studentId' | 'session'>): string {
  return `${row.studentId}:${row.session.id}`
}

function sessionSortMs(session: TodaysClassSessionRow['session']): number {
  const ended = session.classEndedAt ? new Date(session.classEndedAt).getTime() : NaN
  if (Number.isFinite(ended)) return ended
  const scheduled = new Date(session.scheduledFor).getTime()
  return Number.isFinite(scheduled) ? scheduled : 0
}

/** Cross-day leftovers; same-day missed is merged separately into To clear. */
function filterCrossDayLeftovers(
  items: DashboardStillOpenItem[],
  todaySessionIds: Set<string>,
  todayStartMs: number,
  todayEndMs: number,
): DashboardStillOpenItem[] {
  return items.filter((item) => {
    if (todaySessionIds.has(item.session.id)) return false
    if (item.kind === 'needs_prep') {
      const t = new Date(item.session.scheduledFor).getTime()
      if (Number.isFinite(t) && t >= todayStartMs && t < todayEndMs) return false
    }
    return true
  })
}

function pickNextUpRow(nowMs: number, excludeSessionId?: string | null): TodaysClassSessionRow | null {
  const now = new Date(nowMs)
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7)
  const rows = getClassSessionsForDateRange(now, end)
  const upcoming = rows
    .filter((row) => {
      if (excludeSessionId && row.session.id === excludeSessionId) return false
      const status = row.session.status
      if (status !== 'planned' && status !== 'prepared') return false
      const start = new Date(row.session.scheduledFor).getTime()
      return Number.isFinite(start) && start >= nowMs
    })
    .sort((a, b) => new Date(a.session.scheduledFor).getTime() - new Date(b.session.scheduledFor).getTime())
  return upcoming[0] ?? null
}

export function DashboardOverview() {
  const router = useRouter()
  const [todaysOpen, setTodaysOpen] = useState<TodaysClassSessionRow[]>([])
  const [todaysDone, setTodaysDone] = useState<TodaysClassSessionRow[]>([])
  const [stillOpen, setStillOpen] = useState<DashboardStillOpenItem[]>([])
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [startBusyId, setStartBusyId] = useState<string | null>(null)
  const [taughtBusyId, setTaughtBusyId] = useState<string | null>(null)
  const [moveRow, setMoveRow] = useState<TodaysClassSessionRow | null>(null)
  const [recapOpenKey, setRecapOpenKey] = useState<string | null>(null)
  const [recapDraft, setRecapDraft] = useState('')
  const [doneExpanded, setDoneExpanded] = useState(false)
  const [recapsExpanded, setRecapsExpanded] = useState(false)

  const refreshBoard = useCallback(() => {
    const nextNow = Date.now()
    setNowMs(nextNow)
    setTodaysOpen(getTodaysClassSessionsForTeacher())
    setTodaysDone(getTodaysCompletedClassSessionsForTeacher())
    setStillOpen(getDashboardStillOpenItems(nextNow))
  }, [])

  const needsFastTick = useMemo(
    () =>
      todaysOpen.some((row) => {
        const state = resolveTodayClassTeachingState(row.session, nowMs)
        return state === 'live' || state === 'grace' || state === 'ending' || state === 'starting'
      }),
    [todaysOpen, nowMs],
  )

  useEffect(() => {
    refreshBoard()
    const id = window.setInterval(refreshBoard, needsFastTick ? 15_000 : 60_000)
    const onChanged = () => refreshBoard()
    window.addEventListener(STUDENT_LOCAL_DATA_CHANGED_EVENT, onChanged)
    return () => {
      window.clearInterval(id)
      window.removeEventListener(STUDENT_LOCAL_DATA_CHANGED_EVENT, onChanged)
    }
  }, [refreshBoard, needsFastTick])

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      }),
    [],
  )

  const nowRow = useMemo(() => pickDashboardNowRow(todaysOpen, nowMs), [todaysOpen, nowMs])
  const nowKey = nowRow ? rowKey(nowRow) : null

  const { upcomingRows, doneRows, todayMissed } = useMemo(() => {
    const openSansSpotlight = todaysOpen.filter((row) => rowKey(row) !== nowKey)
    const doneSansSpotlight = todaysDone.filter((row) => rowKey(row) !== nowKey)
    const missed: TodaysClassSessionRow[] = []
    const upcoming: TodaysClassSessionRow[] = []
    for (const row of openSansSpotlight) {
      const state = resolveTodayClassTeachingState(row.session, nowMs)
      if (state === 'missed') missed.push(row)
      else if (state !== 'done' && state !== 'cancelled') upcoming.push(row)
    }
    upcoming.sort((a, b) => sessionSortMs(a.session) - sessionSortMs(b.session))
    missed.sort((a, b) => sessionSortMs(a.session) - sessionSortMs(b.session))
    const done = [...doneSansSpotlight].sort((a, b) => sessionSortMs(a.session) - sessionSortMs(b.session))
    return { upcomingRows: upcoming, doneRows: done, todayMissed: missed }
  }, [todaysOpen, todaysDone, nowKey, nowMs])

  const toClearItems = useMemo(() => {
    const todayIds = new Set([
      ...todaysOpen.map((r) => r.session.id),
      ...todaysDone.map((r) => r.session.id),
    ])
    const { startMs, endMs } = getLocalDayBoundsMs(new Date(nowMs))
    const crossDay = filterCrossDayLeftovers(stillOpen, todayIds, startMs, endMs)
    const todayMissedItems: DashboardStillOpenItem[] = todayMissed.map((row) => ({
      ...row,
      kind: 'missed' as const,
    }))
    const merged = [...todayMissedItems, ...crossDay]
    const kindRank: Record<DashboardStillOpenItem['kind'], number> = {
      missed: 0,
      needs_recap: 1,
      needs_prep: 2,
    }
    merged.sort((a, b) => {
      const kr = kindRank[a.kind] - kindRank[b.kind]
      if (kr !== 0) return kr
      return sessionSortMs(a.session) - sessionSortMs(b.session)
    })
    return merged
  }, [stillOpen, todaysOpen, todaysDone, todayMissed, nowMs])

  const toClearGroups = useMemo(() => {
    const missed = toClearItems.filter((i) => i.kind === 'missed')
    const recaps = toClearItems.filter((i) => i.kind === 'needs_recap')
    const prep = toClearItems.filter((i) => i.kind === 'needs_prep')
    return { missed, recaps, prep }
  }, [toClearItems])

  const nextUp = useMemo(() => {
    if (nowRow) return null
    const row = pickNextUpRow(nowMs, null)
    if (!row) return null
    // Don't repeat a student already listed under To clear (e.g. tomorrow prep).
    if (toClearItems.some((item) => item.session.id === row.session.id)) return null
    return row
  }, [nowRow, nowMs, toClearItems])

  const leadWithToClear = !nowRow && toClearItems.length > 0

  async function handleStartClass(row: TodaysClassSessionRow) {
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

  async function handleMarkTaught(row: TodaysClassSessionRow) {
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

  function openRecapEditor(studentId: string, sessionId: string) {
    setRecapOpenKey(`${studentId}:${sessionId}`)
    setRecapDraft('')
  }

  function saveRecap(studentId: string, sessionId: string) {
    const r = updateStudentClassEndNote(studentId, sessionId, recapDraft)
    if (!r.ok) {
      toast.error(r.error)
      return
    }
    setRecapOpenKey(null)
    setRecapDraft('')
    toast.success('Recap saved')
    refreshBoard()
  }

  function dismissRecap(studentId: string, sessionId: string) {
    const r = dismissPostClassRecapPrompt(studentId, sessionId)
    if (!r.ok) {
      toast.error(r.error)
      return
    }
    setRecapOpenKey(null)
    setRecapDraft('')
    refreshBoard()
  }

  function renderMoveMenu(row: TodaysClassSessionRow, label = 'Move') {
    if (!canMoveClassSessionStatus(row.session.status)) return null
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="ui-icon-btn" title="More">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setMoveRow(row)}>{label}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  function renderPrimaryActions(
    row: TodaysClassSessionRow,
    options?: { spotlight?: boolean },
  ) {
    const state = resolveTodayClassTeachingState(row.session, nowMs)
    const entry = resolveClassEntryAction(row.session, nowMs)
    const isLiveBand = state === 'live' || state === 'grace' || state === 'ending'

    if (state === 'missed' || entry === 'reschedule') {
      return (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
          <Button type="button" size="sm" onClick={() => setMoveRow(row)}>
            Reschedule
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={taughtBusyId === row.session.id}
            onClick={() => void handleMarkTaught(row)}
          >
            {taughtBusyId === row.session.id ? '…' : 'Mark taught'}
          </Button>
        </div>
      )
    }

    if (entry === 'enter' || entry === 'continue') {
      return (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
          <Button asChild variant="ghost" size="icon" className="ui-icon-btn" title="Prepare">
            <Link href={buildPrepareLessonMapHref(row.studentId, row.session.id)}>
              <CalendarClock className="h-4 w-4" />
            </Link>
          </Button>
          {isLiveBand || options?.spotlight ? (
            canMoveClassSessionStatus(row.session.status) ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setMoveRow(row)}>
                Move
              </Button>
            ) : null
          ) : (
            renderMoveMenu(row)
          )}
          <Button
            type="button"
            size="sm"
            className="bg-[var(--brand-green)] text-white hover:bg-[var(--brand-green-bright)]"
            disabled={startBusyId === row.session.id}
            onClick={() => void handleStartClass(row)}
          >
            {startBusyId === row.session.id ? (
              '…'
            ) : (
              <>
                <Play className="h-4 w-4" />
                {classEntryActionLabel(entry)}
              </>
            )}
          </Button>
        </div>
      )
    }

    return (
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
        <Button asChild variant="secondary" size="sm">
          <Link href={buildPrepareLessonMapHref(row.studentId, row.session.id)}>Prepare</Link>
        </Button>
        {renderMoveMenu(row)}
      </div>
    )
  }

  function renderRecapActions(row: TodaysClassSessionRow) {
    const key = rowKey(row)
    const needsRecap = sessionNeedsPostClassRecap(row.session)
    if (!needsRecap) {
      const note = row.session.classEndNote?.trim()
      const checks = row.session.readingCheckWrapLine?.trim()
      if (note || checks) {
        const line = [note, checks].filter(Boolean).join(' · ')
        return (
          <p className="max-w-xs truncate text-xs text-muted-foreground" title={line}>
            {line}
          </p>
        )
      }
      return <StatusPill label="Done" tone="success" />
    }

    if (recapOpenKey === key) {
      return (
        <div className="w-full space-y-2 sm:w-72">
          <textarea
            className="min-h-[64px] w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            placeholder="What helped, what to repeat next class…"
            value={recapDraft}
            onChange={(e) => setRecapDraft(e.target.value)}
          />
          <div className="flex flex-wrap gap-1">
            <Button type="button" size="sm" onClick={() => saveRecap(row.studentId, row.session.id)}>
              Save recap
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => dismissRecap(row.studentId, row.session.id)}>
              Not now
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setRecapOpenKey(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )
    }

    return (
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
        <Button
          type="button"
          size="sm"
          className="bg-[color-mix(in_srgb,var(--brand-yellow)_18%,white)] text-[color-mix(in_srgb,var(--brand-yellow)_85%,#1a1a18)] hover:bg-[color-mix(in_srgb,var(--brand-yellow)_26%,white)]"
          onClick={() => openRecapEditor(row.studentId, row.session.id)}
        >
          Add recap
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => dismissRecap(row.studentId, row.session.id)}>
          Not now
        </Button>
      </div>
    )
  }

  function renderClassRow(row: TodaysClassSessionRow, options?: { done?: boolean }) {
    const state = resolveTodayClassTeachingState(row.session, nowMs)
    const tone = options?.done ? 'success' : toneForTeachingState(state)
    const label = options?.done ? 'Done' : todayClassStateLabel(state)
    const countdown = formatClassCountdown(row.session.scheduledFor, nowMs)
    const timeStr = formatSessionTime(row.session.scheduledFor)

    return (
      <li
        key={rowKey(row)}
        className={cn('ui-row flex-wrap sm:flex-nowrap pl-2.5', rowRailClass(tone))}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="inline-flex shrink-0 items-center gap-1 font-mono text-xs font-medium tabular-nums text-foreground/80">
            <Clock3 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            {timeStr}
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 truncate text-sm font-medium text-foreground">
              <span className="truncate">{row.studentName}</span>
              <StatusPill label={label} tone={tone} />
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {row.session.title}
              {!options?.done && countdown ? ` · ${countdown}` : ''}
            </p>
            {!options?.done &&
            row.session.selectedSection?.bookId &&
            row.session.selectedSection?.unitId ? (
              <ReadingCheckPrepareGlanceLink
                bookId={row.session.selectedSection.bookId}
                unitId={row.session.selectedSection.unitId}
                lessonId={row.session.selectedSection.lessonId}
                partId={row.session.selectedSection.partId}
                studentId={row.studentId}
                classSessionId={row.session.id}
              />
            ) : null}
          </div>
        </div>
        {options?.done ? renderRecapActions(row) : renderPrimaryActions(row)}
      </li>
    )
  }

  function renderToClearItem(item: DashboardStillOpenItem) {
    const key = rowKey(item)
    const tone = toneForStillOpenKind(item.kind)
    const when = formatWhenLabel(item.session, nowMs)

    return (
      <li
        key={`clear-${item.kind}-${key}`}
        className={cn('ui-row flex-wrap sm:flex-nowrap pl-2.5', rowRailClass(tone))}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 truncate text-sm font-medium text-foreground">
              <span className="truncate">{item.studentName}</span>
              <StatusPill label={stillOpenKindLabel(item.kind)} tone={tone} />
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {when}
              {item.session.title ? ` · ${item.session.title}` : ''}
            </p>
          </div>
        </div>
        {item.kind === 'needs_prep' ? (
          <div className="flex shrink-0 items-center justify-end">
            <Button asChild variant="secondary" size="sm">
              <Link href={buildPrepareLessonMapHref(item.studentId, item.session.id)}>Prepare</Link>
            </Button>
          </div>
        ) : null}
        {item.kind === 'missed' ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
            <Button type="button" size="sm" onClick={() => setMoveRow(item)}>
              Reschedule
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={taughtBusyId === item.session.id}
              onClick={() => void handleMarkTaught(item)}
            >
              {taughtBusyId === item.session.id ? '…' : 'Mark taught'}
            </Button>
          </div>
        ) : null}
        {item.kind === 'needs_recap' ? (
          recapOpenKey === key ? (
            <div className="w-full space-y-2 sm:w-72">
              <textarea
                className="min-h-[64px] w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                placeholder="What helped, what to repeat next class…"
                value={recapDraft}
                onChange={(e) => setRecapDraft(e.target.value)}
              />
              <div className="flex flex-wrap gap-1">
                <Button type="button" size="sm" onClick={() => saveRecap(item.studentId, item.session.id)}>
                  Save recap
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => dismissRecap(item.studentId, item.session.id)}
                >
                  Not now
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setRecapOpenKey(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
              <Button
                type="button"
                size="sm"
                className="bg-[color-mix(in_srgb,var(--brand-yellow)_18%,white)] text-[color-mix(in_srgb,var(--brand-yellow)_85%,#1a1a18)] hover:bg-[color-mix(in_srgb,var(--brand-yellow)_26%,white)]"
                onClick={() => openRecapEditor(item.studentId, item.session.id)}
              >
                Add recap
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => dismissRecap(item.studentId, item.session.id)}
              >
                Not now
              </Button>
            </div>
          )
        ) : null}
      </li>
    )
  }

  function renderToClearSection() {
    const { missed, recaps, prep } = toClearGroups
    const visibleRecaps = recapsExpanded ? recaps : recaps.slice(0, RECAP_PREVIEW_COUNT)
    const hiddenRecapCount = Math.max(0, recaps.length - RECAP_PREVIEW_COUNT)

    return (
      <section className="ui-section">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h3 className="ui-section-title">To clear</h3>
            <p className="text-xs text-muted-foreground">Follow-ups with a date — not today’s live schedule.</p>
          </div>
        </div>
        {toClearItems.length === 0 ? (
          <p className="flex items-center gap-1.5 text-sm text-[var(--brand-green)]">
            <Check className="h-3.5 w-3.5" aria-hidden />
            You’re clear.
          </p>
        ) : (
          <div className="space-y-4">
            {missed.length > 0 ? (
              <div className="space-y-1">
                <p className="text-xs font-medium text-[var(--brand-red)]">Missed ({missed.length})</p>
                <ul className="space-y-1">{missed.map(renderToClearItem)}</ul>
              </div>
            ) : null}

            {recaps.length > 0 ? (
              <div className="space-y-1">
                <p className="text-xs font-medium text-[color-mix(in_srgb,var(--brand-yellow)_80%,#1a1a18)]">
                  Needs recap ({recaps.length})
                </p>
                <ul className="space-y-1">{visibleRecaps.map(renderToClearItem)}</ul>
                {hiddenRecapCount > 0 && !recapsExpanded ? (
                  <button
                    type="button"
                    className="text-sm text-muted-foreground hover:text-foreground"
                    onClick={() => setRecapsExpanded(true)}
                  >
                    Show {hiddenRecapCount} more
                  </button>
                ) : null}
                {recapsExpanded && recaps.length > RECAP_PREVIEW_COUNT ? (
                  <button
                    type="button"
                    className="text-sm text-muted-foreground hover:text-foreground"
                    onClick={() => setRecapsExpanded(false)}
                  >
                    Show less
                  </button>
                ) : null}
              </div>
            ) : null}

            {prep.length > 0 ? (
              <div className="space-y-1">
                <p className="text-xs font-medium text-[var(--brand-blue)]">Needs prep ({prep.length})</p>
                <ul className="space-y-1">{prep.map(renderToClearItem)}</ul>
              </div>
            ) : null}
          </div>
        )}
      </section>
    )
  }

  function renderTodaySection() {
    const hasRestOfToday = upcomingRows.length > 0 || doneRows.length > 0

    return (
      <section className="ui-section">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="ui-section-title">Today</p>
            <h3 className="text-lg font-semibold text-foreground">{todayLabel}</h3>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ui-icon-btn h-8 w-8"
            onClick={() => refreshBoard()}
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {!hasRestOfToday && !nowRow ? (
          <p className="text-sm text-muted-foreground">
            {todayMissed.length > 0
              ? 'No more upcoming classes today. Missed ones are under To clear.'
              : 'No classes today.'}
          </p>
        ) : !hasRestOfToday && nowRow ? (
          <p className="text-sm text-muted-foreground">No other classes today.</p>
        ) : (
          <div className="space-y-3">
            {upcomingRows.length > 0 ? (
              <ul className="space-y-1">{upcomingRows.map((row) => renderClassRow(row))}</ul>
            ) : null}

            {doneRows.length > 0 ? (
              <div className="space-y-1">
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-md px-1 py-0.5 text-sm text-[var(--brand-green)] hover:bg-[color-mix(in_srgb,var(--brand-green)_10%,transparent)]"
                  onClick={() => setDoneExpanded((v) => !v)}
                  aria-expanded={doneExpanded}
                >
                  <ChevronDown
                    className={cn('h-4 w-4 transition-transform', doneExpanded ? 'rotate-0' : '-rotate-90')}
                    aria-hidden
                  />
                  <Check className="h-3.5 w-3.5" aria-hidden />
                  Done today ({doneRows.length})
                </button>
                {doneExpanded ? (
                  <ul className="space-y-1">{doneRows.map((row) => renderClassRow(row, { done: true }))}</ul>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </section>
    )
  }

  function renderNowSection() {
    const nowState = nowRow ? resolveTodayClassTeachingState(nowRow.session, nowMs) : null
    const nowTone = nowState ? toneForTeachingState(nowState) : 'neutral'
    const nowCountdown = nowRow ? formatClassCountdown(nowRow.session.scheduledFor, nowMs) : null
    const nowIsLiveBand =
      nowState === 'live' || nowState === 'grace' || nowState === 'ending' || nowState === 'starting'

    if (!nowRow) {
      // Quiet empty: no duplicate sidebar buttons. Optional next-up one-liner.
      if (leadWithToClear) {
        return nextUp ? (
          <p className="text-sm text-muted-foreground">
            Next up:{' '}
            <span className="font-medium text-foreground">{nextUp.studentName}</span>
            {' · '}
            {formatWhenLabel(nextUp.session, nowMs)}
          </p>
        ) : null
      }

      return (
        <section className="ui-section border-b border-border pb-4">
          <p className="ui-section-title">Now</p>
          <p className="text-sm text-muted-foreground">
            Nothing live right now
            {nextUp ? (
              <>
                {' · '}
                next is <span className="font-medium text-foreground">{nextUp.studentName}</span>
                {' · '}
                {formatWhenLabel(nextUp.session, nowMs)}
              </>
            ) : (
              '.'
            )}
          </p>
        </section>
      )
    }

    return (
      <section
        className={cn(
          'ui-section border-b border-border pb-6',
          nowIsLiveBand &&
            'rounded-lg bg-[color-mix(in_srgb,var(--brand-yellow)_8%,transparent)] px-3 pt-3 -mx-1',
        )}
      >
        <p className="ui-section-title">Now</p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-foreground">{nowRow.studentName}</h2>
              {nowState ? <StatusPill label={todayClassStateLabel(nowState)} tone={nowTone} /> : null}
              {nowCountdown ? (
                <span className="inline-flex items-center rounded-md bg-background/80 px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-foreground ring-1 ring-border/70">
                  {nowCountdown}
                </span>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">
              <span className="font-mono tabular-nums text-foreground/80">
                {formatSessionTime(nowRow.session.scheduledFor)}
              </span>
              {' · '}
              {nowRow.session.title}
            </p>
            {nowRow.session.selectedSection?.bookId && nowRow.session.selectedSection?.unitId ? (
              <ReadingCheckPrepareGlanceLink
                bookId={nowRow.session.selectedSection.bookId}
                unitId={nowRow.session.selectedSection.unitId}
                lessonId={nowRow.session.selectedSection.lessonId}
                partId={nowRow.session.selectedSection.partId}
                studentId={nowRow.studentId}
                classSessionId={nowRow.session.id}
              />
            ) : null}
          </div>
          {renderPrimaryActions(nowRow, { spotlight: true })}
        </div>
      </section>
    )
  }

  return (
    <div className="space-y-8">
      {leadWithToClear ? (
        <>
          {renderToClearSection()}
          {renderNowSection()}
          {renderTodaySection()}
        </>
      ) : (
        <>
          {renderNowSection()}
          {renderTodaySection()}
          {renderToClearSection()}
        </>
      )}

      <MoveClassDialog
        open={moveRow != null}
        onOpenChange={(next) => {
          if (!next) setMoveRow(null)
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

'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SlotFormFields,
  formatSessionDateTime,
  type SlotFormValues,
} from '@/components/schedule/slot-form-fields'
import { MoveClassDialog } from '@/components/schedule/move-class-dialog'
import {
  dateInWeekForDayOfWeek,
  getWeekDays,
  getWeekStart,
  isSessionToday,
} from '@/lib/schedule/week-view-layout'
import { normalizeClassDurationMinutes } from '@/lib/schedule/class-duration'
import { canMoveClassSessionStatus } from '@/lib/schedule/move-class-targets'
import type { PendingRecurringScheduleChange } from '@/lib/schedule/recurring-change-types'
import { ensureStudentRecordsHydrated } from '@/lib/local-data/student-records-client'
import {
  cancelClassOccurrence,
  clearStudentClassesInDateRange,
  getWeeklySlotAssignments,
  markMissedClassTaughtAnyway,
  removeStudentFromCalendar,
  removeWeeklySlotAssignment,
  startStudentClassSession,
  updateOneOffClassSession,
  type TodaysClassSessionRow,
} from '@/lib/students/selectors'
import type { TeacherWeeklyScheduleConfig } from '@/lib/types'

interface EventDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventRow: TodaysClassSessionRow | null
  config: TeacherWeeklyScheduleConfig
  students: Array<{ id: string; name: string }>
  onChanged: () => void
  onPendingRecurringChange: (change: PendingRecurringScheduleChange) => void
  /** Visible week bounds when in week view; month falls back to the class’s week. */
  weekStart?: Date | null
  weekEnd?: Date | null
}

const STATUS_LABELS: Record<string, string> = {
  planned: 'Planned',
  prepared: 'Prepared',
  in_progress: 'Live',
  completed: 'Completed',
  cancelled: 'Cancelled',
  missed: 'Missed',
}

export function EventDetailDialog({
  open,
  onOpenChange,
  eventRow,
  config,
  students,
  onChanged,
  onPendingRecurringChange,
  weekStart = null,
  weekEnd = null,
}: EventDetailDialogProps) {
  const router = useRouter()
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [values, setValues] = useState<SlotFormValues>({
    dayOfWeek: 1,
    startMinute: 9 * 60,
    durationMinutes: 30,
    studentId: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [moveTarget, setMoveTarget] = useState<{
    studentId: string
    studentName: string
    session: TodaysClassSessionRow['session']
  } | null>(null)

  const slot = useMemo(() => {
    if (!eventRow?.session.sourceSlotId) return null
    return getWeeklySlotAssignments().find((row) => row.id === eventRow.session.sourceSlotId) ?? null
  }, [eventRow, open])

  const isOneOff = Boolean(eventRow && !eventRow.session.sourceSlotId?.trim())

  useEffect(() => {
    if (!open || !eventRow) return
    setMode('view')
    setError(null)
    setMoveOpen(false)
    setMoveTarget(null)
    const sessionDate = new Date(eventRow.session.scheduledFor)
    if (slot) {
      setValues({
        dayOfWeek: slot.dayOfWeek,
        startMinute: slot.startMinute,
        durationMinutes: slot.durationMinutes,
        studentId: slot.studentId,
      })
    } else if (Number.isFinite(sessionDate.getTime())) {
      setValues({
        dayOfWeek: sessionDate.getDay(),
        startMinute: sessionDate.getHours() * 60 + sessionDate.getMinutes(),
        durationMinutes: normalizeClassDurationMinutes(eventRow.session.durationMin, 30),
        studentId: eventRow.studentId,
      })
    }
  }, [open, eventRow, slot])

  const sessionAnchorDate = useMemo(() => {
    if (!eventRow) return null
    const d = new Date(eventRow.session.scheduledFor)
    return Number.isFinite(d.getTime()) ? d : null
  }, [eventRow])

  const resolvedWeekRange = useMemo(() => {
    if (weekStart && weekEnd) {
      return { start: weekStart, end: weekEnd }
    }
    if (!eventRow) return null
    const when = new Date(eventRow.session.scheduledFor)
    if (!Number.isFinite(when.getTime())) return null
    const start = getWeekStart(when)
    const days = getWeekDays(start)
    return { start, end: days[6] ?? start }
  }, [weekStart, weekEnd, eventRow])

  if (!eventRow) return null

  const { studentId, studentName, session } = eventRow
  const isMissed = session.status === 'missed'
  const canStart =
    isSessionToday(session.scheduledFor) &&
    session.status !== 'completed' &&
    session.status !== 'cancelled' &&
    session.status !== 'missed'
  const isLive = session.status === 'in_progress'
  const canMove = canMoveClassSessionStatus(session.status)
  const canEditOneOff =
    isOneOff &&
    session.status !== 'completed' &&
    session.status !== 'cancelled' &&
    session.status !== 'in_progress' &&
    session.status !== 'missed'
  const canCancel =
    session.status !== 'completed' && session.status !== 'cancelled'

  async function handleMarkTaught() {
    setBusy(true)
    try {
      await ensureStudentRecordsHydrated()
      const result = markMissedClassTaughtAnyway(studentId, session.id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Marked as taught')
      onChanged()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update class.')
    } finally {
      setBusy(false)
    }
  }

  async function handleStart() {
    setBusy(true)
    try {
      await ensureStudentRecordsHydrated()
      if (session.status !== 'in_progress') {
        const started = startStudentClassSession(studentId, session.id)
        if (!started.ok) {
          toast.error(started.error)
          return
        }
        onChanged()
      }
      router.push(`/students/${studentId}/map?classSession=${encodeURIComponent(session.id)}`)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not start class.')
    } finally {
      setBusy(false)
    }
  }

  function handleSaveEdit() {
    if (slot) {
      const unchanged =
        values.dayOfWeek === slot.dayOfWeek &&
        values.startMinute === slot.startMinute &&
        values.durationMinutes === slot.durationMinutes &&
        values.studentId === slot.studentId
      if (unchanged) {
        setMode('view')
        return
      }

      const sessionDate = new Date(session.scheduledFor)
      const targetDate = Number.isFinite(sessionDate.getTime())
        ? dateInWeekForDayOfWeek(sessionDate, values.dayOfWeek)
        : new Date()

      onPendingRecurringChange({
        studentId: values.studentId,
        studentName,
        sessionId: session.id,
        slotId: slot.id,
        targetDate,
        startMinute: values.startMinute,
        durationMinutes: values.durationMinutes,
        dayOfWeek: values.dayOfWeek,
      })
      onOpenChange(false)
      setMode('view')
      return
    }

    if (!isOneOff || !sessionAnchorDate) return

    setBusy(true)
    setError(null)
    const targetDate = dateInWeekForDayOfWeek(sessionAnchorDate, values.dayOfWeek)
    const result = updateOneOffClassSession(
      studentId,
      session.id,
      targetDate,
      values.startMinute,
      values.durationMinutes,
    )
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    toast.success('Class updated')
    onChanged()
    setMode('view')
  }

  function handleRemoveWeeklyTime() {
    if (!slot) return
    if (
      !window.confirm(
        `Remove this weekly time for ${studentName}? Future classes from this slot will be cancelled.`,
      )
    ) {
      return
    }
    setBusy(true)
    const result = removeWeeklySlotAssignment(slot.id)
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    toast.success('Weekly time removed')
    onChanged()
    onOpenChange(false)
  }

  function handleCancelClass() {
    if (!window.confirm(`Cancel this class for ${studentName}? It will leave the calendar.`)) return
    setBusy(true)
    const result = cancelClassOccurrence(studentId, session.id)
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    toast.success('Class cancelled')
    onChanged()
    onOpenChange(false)
  }

  function handleClearStudentWeek() {
    if (!resolvedWeekRange) {
      setError('Could not determine the week for this class.')
      return
    }
    if (
      !window.confirm(
        `Cancel ${studentName}’s planned classes this week? Their weekly time stays; other students are not changed.`,
      )
    ) {
      return
    }
    setBusy(true)
    const result = clearStudentClassesInDateRange(
      studentId,
      resolvedWeekRange.start,
      resolvedWeekRange.end,
    )
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      toast.error(result.error)
      return
    }
    if (result.cancelledCount === 0) {
      toast.message(`No planned classes for ${studentName} in this week.`)
    } else {
      toast.success(
        result.cancelledCount === 1
          ? `Cancelled 1 class for ${studentName} this week`
          : `Cancelled ${result.cancelledCount} classes for ${studentName} this week`,
      )
    }
    onChanged()
    onOpenChange(false)
  }

  function handleRemoveStudentFromCalendar() {
    if (
      !window.confirm(
        `Remove ${studentName} from the whole calendar? This deletes their weekly times and cancels upcoming/live classes. Completed history stays. Other students are not changed.`,
      )
    ) {
      return
    }
    if (
      !window.confirm(
        `Really remove ${studentName} from the schedule? You can book them again later.`,
      )
    ) {
      return
    }
    setBusy(true)
    const result = removeStudentFromCalendar(studentId)
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      toast.error(result.error)
      return
    }
    toast.success(
      `Removed ${studentName} from the calendar · ${result.removedSlots} weekly time${result.removedSlots === 1 ? '' : 's'}, ${result.cancelledSessions} class${result.cancelledSessions === 1 ? '' : 'es'} cancelled`,
    )
    onChanged()
    onOpenChange(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{studentName}</DialogTitle>
            <DialogDescription>
              {formatSessionDateTime(session.scheduledFor)} · {session.durationMin} min
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2">
            <span className="inline-flex rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs font-medium text-foreground">
              {STATUS_LABELS[session.status] ?? session.status}
            </span>
            {slot ? (
              <span className="inline-flex rounded-full border border-[var(--border)] px-2 py-0.5 text-xs font-medium">
                Repeats weekly
              </span>
            ) : isOneOff ? (
              <span className="inline-flex rounded-full border border-[var(--border)] px-2 py-0.5 text-xs font-medium">
                One-time class
              </span>
            ) : null}
          </div>

          {mode === 'edit' && (slot || isOneOff) ? (
            <SlotFormFields
              values={values}
              onChange={(patch) => setValues((prev) => ({ ...prev, ...patch }))}
              students={students}
              config={config}
              hideStudentField={isOneOff}
              showRecurringHint={Boolean(slot)}
              anchorDate={isOneOff ? sessionAnchorDate : null}
            />
          ) : null}

          {error ? <p className="text-sm text-[var(--brand-red)]">{error}</p> : null}

          <DialogFooter className="flex-col gap-2 sm:items-stretch">
            {mode === 'view' ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                {canStart ? (
                  <Button type="button" onClick={handleStart} disabled={busy}>
                    Enter
                  </Button>
                ) : null}
                {isMissed ? (
                  <Button type="button" variant="secondary" onClick={() => void handleMarkTaught()} disabled={busy}>
                    Mark taught
                  </Button>
                ) : null}
                {canMove ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setMoveTarget({ studentId, studentName, session })
                      setMoveOpen(true)
                      onOpenChange(false)
                    }}
                  >
                    {isMissed ? 'Reschedule' : isLive ? 'Move instead' : 'Move'}
                  </Button>
                ) : null}
                <Button type="button" variant="outline" asChild>
                  <Link href={`/students/${studentId}?tab=classes`}>Prep</Link>
                </Button>
                {slot || canEditOneOff ? (
                  <Button type="button" variant="outline" onClick={() => setMode('edit')} disabled={busy}>
                    Edit time
                  </Button>
                ) : null}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" disabled={busy}>
                      Remove…
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[14rem]">
                    {canCancel ? (
                      <DropdownMenuItem
                        onSelect={() => {
                          handleCancelClass()
                        }}
                      >
                        This class only
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem
                      disabled={!resolvedWeekRange}
                      onSelect={() => {
                        handleClearStudentWeek()
                      }}
                    >
                      {studentName}’s week
                    </DropdownMenuItem>
                    {slot ? (
                      <DropdownMenuItem
                        onSelect={() => {
                          handleRemoveWeeklyTime()
                        }}
                      >
                        This weekly time
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => {
                        handleRemoveStudentFromCalendar()
                      }}
                    >
                      All of {studentName}’s schedule
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setMode('view')}>
                  Back
                </Button>
                <Button type="button" onClick={handleSaveEdit} disabled={busy}>
                  {slot ? 'Continue' : 'Save'}
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MoveClassDialog
        open={moveOpen}
        onOpenChange={(next) => {
          setMoveOpen(next)
          if (!next) setMoveTarget(null)
        }}
        studentId={moveTarget?.studentId ?? ''}
        studentName={moveTarget?.studentName ?? ''}
        session={moveTarget?.session ?? null}
        onMoved={() => {
          setMoveOpen(false)
          setMoveTarget(null)
          onChanged()
        }}
      />
    </>
  )
}

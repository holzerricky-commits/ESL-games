'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { toast } from 'sonner'
import { CreateSlotDialog } from '@/components/schedule/create-slot-dialog'
import { ScheduleTimeGrid } from '@/components/schedule/schedule-time-grid'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DAY_LABELS, fmtScheduleMinute } from '@/lib/schedule/schedule-time-labels'
import { addWeeks, formatWeekRangeLabel, getWeekDays, getWeekStart } from '@/lib/schedule/week-view-layout'
import {
  getClassSessionsForDateRange,
  getStudentsListView,
  getTeacherWeeklyScheduleConfig,
  getWeeklySlotAssignments,
  removeWeeklySlotAssignment,
  STUDENT_LOCAL_DATA_CHANGED_EVENT,
} from '@/lib/students/selectors'

interface StudentSetupScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  studentId: string
  studentName: string
  onChanged: () => void
}

export function StudentSetupScheduleDialog({
  open,
  onOpenChange,
  studentId,
  studentName,
  onChanged,
}: StudentSetupScheduleDialogProps) {
  const [version, setVersion] = useState(0)
  const [weekAnchor, setWeekAnchor] = useState(() => getWeekStart(new Date()))
  const [createOpen, setCreateOpen] = useState(false)
  const [createDate, setCreateDate] = useState<Date | null>(null)
  const [createMinute, setCreateMinute] = useState<number | null>(null)
  const suppressParentCloseRef = useRef(false)

  function refresh() {
    setVersion((v) => v + 1)
  }

  useEffect(() => {
    if (!open) return
    const bump = () => refresh()
    window.addEventListener(STUDENT_LOCAL_DATA_CHANGED_EVENT, bump)
    return () => window.removeEventListener(STUDENT_LOCAL_DATA_CHANGED_EVENT, bump)
  }, [open])

  useEffect(() => {
    if (open) {
      setWeekAnchor(getWeekStart(new Date()))
      refresh()
    }
  }, [open])

  const config = useMemo(() => getTeacherWeeklyScheduleConfig(), [version])
  const students = useMemo(() => getStudentsListView(), [version])
  const weekDays = useMemo(() => getWeekDays(weekAnchor), [weekAnchor])
  const weekEnd = weekDays[6] ?? weekAnchor
  const periodLabel = formatWeekRangeLabel(weekAnchor)

  const sessions = useMemo(() => {
    return getClassSessionsForDateRange(weekDays[0] ?? weekAnchor, weekEnd)
  }, [weekDays, weekAnchor, weekEnd, version])

  const studentSlots = useMemo(() => {
    void version
    return getWeeklySlotAssignments().filter((slot) => slot.studentId === studentId)
  }, [studentId, version])

  function handleEmptyClick(date: Date, startMinute: number) {
    setCreateDate(date)
    setCreateMinute(startMinute)
    setCreateOpen(true)
  }

  function handleSlotSaved() {
    refresh()
    onChanged()
  }

  function handleRemoveSlot(slotId: string) {
    const result = removeWeeklySlotAssignment(slotId)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    refresh()
    onChanged()
    toast.success('Time removed.')
  }

  function handleDone() {
    onChanged()
    onOpenChange(false)
  }

  function handleScheduleOpenChange(nextOpen: boolean) {
    // Nested Add class dialog dismiss must not close this module.
    if (!nextOpen && (createOpen || suppressParentCloseRef.current)) return
    onOpenChange(nextOpen)
  }

  function handleCreateOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      // Child close can bubble a dismiss to the parent in the same tick.
      suppressParentCloseRef.current = true
      window.setTimeout(() => {
        suppressParentCloseRef.current = false
      }, 0)
    }
    setCreateOpen(nextOpen)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleScheduleOpenChange}>
        <DialogContent
          className="flex max-h-[min(92vh,56rem)] w-full max-w-[calc(100%-1.5rem)] flex-col gap-4 overflow-hidden sm:max-w-5xl"
          onPointerDownOutside={(event) => {
            if (createOpen) event.preventDefault()
          }}
          onFocusOutside={(event) => {
            if (createOpen) event.preventDefault()
          }}
          onInteractOutside={(event) => {
            if (createOpen) event.preventDefault()
          }}
        >
          <DialogHeader>
            <DialogTitle>Schedule {studentName}</DialogTitle>
            <DialogDescription>
              Click an empty time to add a class. Add as many as you need, then tap Done.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setWeekAnchor(getWeekStart(new Date()))}>
              Today
            </Button>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setWeekAnchor((prev) => addWeeks(prev, -1))}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
                <span className="sr-only">Previous week</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setWeekAnchor((prev) => addWeeks(prev, 1))}
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
                <span className="sr-only">Next week</span>
              </Button>
            </div>
            <h3 className="text-sm font-semibold text-foreground sm:text-base">{periodLabel}</h3>
          </div>

          <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-[var(--border)]">
            <ScheduleTimeGrid
              weekDays={weekDays}
              config={config}
              sessions={sessions}
              onEmptyClick={handleEmptyClick}
              onEventClick={() => {}}
              onPendingRecurringChange={() => {}}
              highlightStudentId={studentId}
            />
          </div>

          {studentSlots.length > 0 ? (
            <ul className="max-h-28 space-y-1 overflow-auto border-t border-[var(--border)] pt-3">
              {studentSlots.map((slot) => (
                <li key={slot.id} className="flex items-center justify-between gap-3 py-1 text-sm">
                  <span>
                    <span className="font-semibold text-foreground">{DAY_LABELS[slot.dayOfWeek]}</span>
                    <span className="text-muted-foreground">
                      {' '}
                      · {fmtScheduleMinute(slot.startMinute)} · {slot.durationMinutes} min · every week
                    </span>
                  </span>
                  <button
                    type="button"
                    className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Remove ${DAY_LABELS[slot.dayOfWeek]} ${fmtScheduleMinute(slot.startMinute)}`}
                    onClick={() => handleRemoveSlot(slot.id)}
                  >
                    <X size={14} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No weekly times yet — click the calendar to add one.</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              className="bg-[var(--brand-blue)] text-white hover:bg-[var(--brand-blue-bright)]"
              onClick={handleDone}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateSlotDialog
        open={createOpen}
        onOpenChange={handleCreateOpenChange}
        date={createDate}
        startMinute={createMinute}
        config={config}
        students={students}
        defaultStudentId={studentId}
        onSaved={handleSlotSaved}
      />
    </>
  )
}

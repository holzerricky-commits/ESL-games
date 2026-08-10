'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  clearScheduledClassesInDateRange,
  getClassSessionsForDateRange,
  getStudentProfileView,
  getStudentsListView,
  getTeacherWeeklyScheduleConfig,
  resetTeacherCalendar,
  saveTeacherWeeklyScheduleConfig,
  STUDENT_LOCAL_DATA_CHANGED_EVENT,
} from '@/lib/students/selectors'
import { applyRecurringScheduleChange } from '@/lib/schedule/apply-recurring-schedule-change'
import type {
  PendingRecurringScheduleChange,
  RecurringChangeScope,
} from '@/lib/schedule/recurring-change-types'
import {
  addMonths,
  daysAheadToCover,
  formatMonthLabel,
  getMonthGridDays,
  getMonthStart,
} from '@/lib/schedule/month-view-layout'
import { addWeeks, formatWeekRangeLabel, getWeekDays, getWeekStart } from '@/lib/schedule/week-view-layout'
import {
  ScheduleWeekHeader,
  type ScheduleViewMode,
} from '@/components/schedule/schedule-week-header'
import { ScheduleTimeGrid } from '@/components/schedule/schedule-time-grid'
import { ScheduleMonthGrid } from '@/components/schedule/schedule-month-grid'
import { TeachingHoursSheet } from '@/components/schedule/teaching-hours-sheet'
import { CreateSlotDialog } from '@/components/schedule/create-slot-dialog'
import { EventDetailDialog } from '@/components/schedule/event-detail-dialog'
import { RecurringChangeDialog } from '@/components/schedule/recurring-change-dialog'
import { useScheduleKeyboardShortcuts } from '@/lib/schedule/use-schedule-keyboard-shortcuts'
import type { TodaysClassSessionRow } from '@/lib/students/selectors'
import type { TeacherWeeklyScheduleConfig } from '@/lib/types'

interface WeekScheduleViewProps {
  highlightStudentId?: string | null
}

export function WeekScheduleView({ highlightStudentId = null }: WeekScheduleViewProps) {
  const [version, setVersion] = useState(0)
  const [viewMode, setViewMode] = useState<ScheduleViewMode>('week')
  const [weekAnchor, setWeekAnchor] = useState(() => getWeekStart(new Date()))
  const [monthAnchor, setMonthAnchor] = useState(() => getMonthStart(new Date()))
  const [hoursOpen, setHoursOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [createDate, setCreateDate] = useState<Date | null>(null)
  const [createMinute, setCreateMinute] = useState<number | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<TodaysClassSessionRow | null>(null)
  const [pendingChange, setPendingChange] = useState<PendingRecurringScheduleChange | null>(null)
  const [recurringDialogOpen, setRecurringDialogOpen] = useState(false)
  const [liveMessage, setLiveMessage] = useState('')
  const [focusedDay, setFocusedDay] = useState<Date | null>(null)

  const announce = useCallback((message: string) => {
    setLiveMessage(message)
  }, [])

  const shortcutsEnabled = !createOpen && !detailOpen && !hoursOpen && !recurringDialogOpen

  const config = useMemo(() => getTeacherWeeklyScheduleConfig(), [version])
  const students = useMemo(() => getStudentsListView(), [version])
  const weekDays = useMemo(() => getWeekDays(weekAnchor), [weekAnchor])
  const weekEnd = weekDays[6] ?? weekAnchor
  const monthGridDays = useMemo(() => getMonthGridDays(monthAnchor), [monthAnchor])
  const monthGridEnd = monthGridDays[monthGridDays.length - 1] ?? monthAnchor

  const highlightStudent = useMemo(() => {
    if (!highlightStudentId) return null
    return (
      students.find((student) => student.id === highlightStudentId) ??
      getStudentProfileView(highlightStudentId)
    )
  }, [highlightStudentId, students, version])

  const weekSessions = useMemo(() => {
    return getClassSessionsForDateRange(weekDays[0] ?? weekAnchor, weekEnd)
  }, [weekDays, weekAnchor, weekEnd, version])

  const monthSessions = useMemo(() => {
    const rangeStart = monthGridDays[0] ?? monthAnchor
    const rangeEnd = monthGridEnd
    return getClassSessionsForDateRange(rangeStart, rangeEnd, {
      daysAhead: daysAheadToCover(rangeEnd),
    })
  }, [monthGridDays, monthAnchor, monthGridEnd, version])

  const sessions = viewMode === 'week' ? weekSessions : monthSessions
  const periodLabel =
    viewMode === 'week' ? formatWeekRangeLabel(weekAnchor) : formatMonthLabel(monthAnchor)

  function refresh() {
    setVersion((v) => v + 1)
  }

  useEffect(() => {
    const bump = () => refresh()
    window.addEventListener(STUDENT_LOCAL_DATA_CHANGED_EVENT, bump)
    window.addEventListener('focus', bump)
    return () => {
      window.removeEventListener(STUDENT_LOCAL_DATA_CHANGED_EVENT, bump)
      window.removeEventListener('focus', bump)
    }
  }, [])

  function saveConfig(next: Partial<TeacherWeeklyScheduleConfig>) {
    saveTeacherWeeklyScheduleConfig({
      workingDays: next.workingDays ?? config.workingDays,
      startMinute: next.startMinute ?? config.startMinute,
      endMinute: next.endMinute ?? config.endMinute,
      slotMinutes: 30,
    })
    refresh()
  }

  function handleMonthDayZoom(date: Date) {
    const day = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    setWeekAnchor(getWeekStart(day))
    setFocusedDay(day)
    setViewMode('week')
    const label = day.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    announce(`Showing week view for ${label}.`)
  }

  function handleEmptyClick(date: Date, startMinute: number) {
    setFocusedDay(null)
    setCreateDate(date)
    setCreateMinute(startMinute)
    setCreateOpen(true)
  }

  function handleEventClick(row: TodaysClassSessionRow) {
    setFocusedDay(null)
    setSelectedEvent(row)
    setDetailOpen(true)
  }

  const handlePendingRecurringChange = useCallback((change: PendingRecurringScheduleChange) => {
    setPendingChange(change)
    setRecurringDialogOpen(true)
  }, [])

  const handleViewModeChange = useCallback((mode: ScheduleViewMode) => {
    if (mode === viewMode) return
    if (mode === 'month') {
      setMonthAnchor(getMonthStart(weekAnchor))
      setFocusedDay(null)
    } else {
      setWeekAnchor(getWeekStart(monthAnchor))
    }
    setViewMode(mode)
  }, [viewMode, weekAnchor, monthAnchor])

  const handleToday = useCallback(() => {
    const today = new Date()
    setFocusedDay(null)
    if (viewMode === 'week') {
      setWeekAnchor(getWeekStart(today))
    } else {
      setMonthAnchor(getMonthStart(today))
    }
  }, [viewMode])

  const handlePrev = useCallback(() => {
    setFocusedDay(null)
    if (viewMode === 'week') {
      setWeekAnchor((prev) => addWeeks(prev, -1))
    } else {
      setMonthAnchor((prev) => addMonths(prev, -1))
    }
  }, [viewMode])

  const handleNext = useCallback(() => {
    setFocusedDay(null)
    if (viewMode === 'week') {
      setWeekAnchor((prev) => addWeeks(prev, 1))
    } else {
      setMonthAnchor((prev) => addMonths(prev, 1))
    }
  }, [viewMode])

  useScheduleKeyboardShortcuts({
    enabled: shortcutsEnabled,
    viewMode,
    onToday: handleToday,
    onPrev: handlePrev,
    onNext: handleNext,
    onViewModeChange: handleViewModeChange,
  })

  function handleRecurringChoice(scope: RecurringChangeScope) {
    if (!pendingChange) return
    const result = applyRecurringScheduleChange(pendingChange, scope)
    if (!result.ok) {
      toast.error(result.error)
      announce(result.error)
      return
    }
    const message = scope === 'occurrence' ? 'This class was updated' : 'Weekly time updated'
    toast.success(message)
    announce(message)
    setRecurringDialogOpen(false)
    setPendingChange(null)
    refresh()
  }

  function handleClearWeek() {
    const weekStart = weekDays[0] ?? weekAnchor
    const weekEndDay = weekDays[6] ?? weekAnchor
    if (
      !window.confirm(
        'Cancel all planned/prepared classes in this week? Weekly times stay; you can remove those from a class card.',
      )
    ) {
      return
    }
    const result = clearScheduledClassesInDateRange(weekStart, weekEndDay)
    if (result.cancelledCount === 0) {
      toast.message('Nothing to clear in this week.')
      announce('Nothing to clear in this week.')
    } else {
      toast.success(
        result.cancelledCount === 1
          ? 'Cancelled 1 class this week'
          : `Cancelled ${result.cancelledCount} classes this week`,
      )
      announce(`Cancelled ${result.cancelledCount} classes.`)
    }
    refresh()
  }

  function handleResetCalendar() {
    if (
      !window.confirm(
        'Reset the whole calendar? This removes every weekly time and cancels all upcoming/live classes. Students and completed class history stay. You cannot undo this.',
      )
    ) {
      return
    }
    if (
      !window.confirm(
        'Really reset? The schedule grid will be empty so you can book classes again from scratch.',
      )
    ) {
      return
    }
    const result = resetTeacherCalendar()
    if (result.removedSlots === 0 && result.cancelledSessions === 0) {
      toast.message('Calendar was already empty.')
      announce('Calendar was already empty.')
    } else {
      toast.success(
        `Calendar reset · removed ${result.removedSlots} weekly time${result.removedSlots === 1 ? '' : 's'}, cancelled ${result.cancelledSessions} class${result.cancelledSessions === 1 ? '' : 'es'}`,
      )
      announce('Calendar reset.')
    }
    refresh()
  }

  return (
    <div className="space-y-4">
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </div>
      <ScheduleWeekHeader
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        periodLabel={periodLabel}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        onOpenHours={() => setHoursOpen(true)}
        onClearWeek={handleClearWeek}
        onResetCalendar={handleResetCalendar}
        highlightStudentId={highlightStudentId}
        highlightStudentName={highlightStudent?.name ?? null}
      />

      {viewMode === 'week' ? (
        <ScheduleTimeGrid
          weekDays={weekDays}
          config={config}
          sessions={sessions}
          focusedDay={focusedDay}
          onClearFocusedDay={() => setFocusedDay(null)}
          onEmptyClick={handleEmptyClick}
          onEventClick={handleEventClick}
          onPendingRecurringChange={handlePendingRecurringChange}
          onAnnounce={announce}
          highlightStudentId={highlightStudentId}
        />
      ) : (
        <ScheduleMonthGrid
          monthAnchor={monthAnchor}
          sessions={sessions}
          onDayZoom={handleMonthDayZoom}
          onEventClick={handleEventClick}
          highlightStudentId={highlightStudentId}
          workingDays={config.workingDays}
        />
      )}

      <TeachingHoursSheet
        open={hoursOpen}
        onOpenChange={setHoursOpen}
        config={config}
        onSave={saveConfig}
      />

      <CreateSlotDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        date={createDate}
        startMinute={createMinute}
        config={config}
        students={students}
        defaultStudentId={highlightStudentId ?? ''}
        onSaved={refresh}
      />

      <EventDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        eventRow={selectedEvent}
        config={config}
        students={students}
        onChanged={refresh}
        onPendingRecurringChange={handlePendingRecurringChange}
        weekStart={viewMode === 'week' ? (weekDays[0] ?? weekAnchor) : null}
        weekEnd={viewMode === 'week' ? weekEnd : null}
      />

      <RecurringChangeDialog
        open={recurringDialogOpen}
        onOpenChange={(open) => {
          setRecurringDialogOpen(open)
          if (!open) setPendingChange(null)
        }}
        change={pendingChange}
        onChoose={handleRecurringChoice}
      />
    </div>
  )
}

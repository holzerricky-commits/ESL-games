'use client'

import { useEffect, useState } from 'react'
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
  SlotFormFields,
  slotFormValuesFromDate,
  type SlotFormValues,
} from '@/components/schedule/slot-form-fields'
import { fmtScheduleMinute } from '@/lib/schedule/schedule-time-labels'
import { DAY_LABELS } from '@/lib/schedule/schedule-time-labels'
import { dateInWeekForDayOfWeek } from '@/lib/schedule/week-view-layout'
import { createOneOffClassSession, upsertWeeklySlotAssignment } from '@/lib/students/selectors'
import type { TeacherWeeklyScheduleConfig } from '@/lib/types'
import {
  scheduleDialogContentClass,
  scheduleDialogDescriptionClass,
  scheduleDialogOverlayClass,
  scheduleDialogTitleClass,
  scheduleGhostBtnClass,
  schedulePrimaryBtnClass,
} from '@/components/schedule/schedule-sheet-chrome'

type ScheduleKind = 'once' | 'weekly'

interface CreateSlotDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  date: Date | null
  startMinute: number | null
  config: TeacherWeeklyScheduleConfig
  students: Array<{ id: string; name: string }>
  defaultStudentId?: string
  onSaved: () => void
}

export function CreateSlotDialog({
  open,
  onOpenChange,
  date,
  startMinute,
  config,
  students,
  defaultStudentId = '',
  onSaved,
}: CreateSlotDialogProps) {
  const [scheduleKind, setScheduleKind] = useState<ScheduleKind>('weekly')
  const [values, setValues] = useState<SlotFormValues>({
    dayOfWeek: 1,
    startMinute: config.startMinute,
    durationMinutes: 30,
    studentId: defaultStudentId,
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !date || startMinute == null) return
    setScheduleKind('weekly')
    setValues(slotFormValuesFromDate(date, startMinute, defaultStudentId, 30))
    setError(null)
  }, [open, date, startMinute, defaultStudentId, config.startMinute])

  function handleSave() {
    if (!values.studentId) {
      setError('Pick a student.')
      return
    }
    if (!date) {
      setError('Pick a time on the calendar.')
      return
    }

    setSaving(true)
    setError(null)

    if (scheduleKind === 'weekly') {
      const result = upsertWeeklySlotAssignment({
        dayOfWeek: values.dayOfWeek,
        startMinute: values.startMinute,
        durationMinutes: values.durationMinutes,
        studentId: values.studentId,
      })
      setSaving(false)
      if (!result.ok) {
        setError(result.error)
        return
      }
    } else {
      const targetDate = dateInWeekForDayOfWeek(date, values.dayOfWeek)
      const result = createOneOffClassSession(
        values.studentId,
        targetDate,
        values.startMinute,
        values.durationMinutes,
      )
      setSaving(false)
      if (!result.ok) {
        setError(result.error)
        return
      }
    }

    onSaved()
    onOpenChange(false)
  }

  const titleDay = date ? DAY_LABELS[date.getDay()] : DAY_LABELS[values.dayOfWeek]
  const titleTime = startMinute != null ? fmtScheduleMinute(startMinute) : fmtScheduleMinute(values.startMinute)
  const isWeekly = scheduleKind === 'weekly'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName={scheduleDialogOverlayClass}
        className={scheduleDialogContentClass}
      >
        <DialogHeader>
          <DialogTitle className={scheduleDialogTitleClass}>Add class</DialogTitle>
          <DialogDescription className={scheduleDialogDescriptionClass}>
            {titleDay} at {titleTime}
            {isWeekly ? ' — repeats every week, or just once.' : ' — one-time class.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1" role="radiogroup" aria-label="Repeat">
          <button
            type="button"
            role="radio"
            aria-checked={isWeekly}
            data-active={isWeekly}
            className="chrome-nav-pill flex-1 justify-center px-3.5 py-2 text-[13px]"
            onClick={() => setScheduleKind('weekly')}
          >
            Every week
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={!isWeekly}
            data-active={!isWeekly}
            className="chrome-nav-pill flex-1 justify-center px-3.5 py-2 text-[13px]"
            onClick={() => setScheduleKind('once')}
          >
            Once
          </button>
        </div>

        <SlotFormFields
          values={values}
          onChange={(patch) => setValues((prev) => ({ ...prev, ...patch }))}
          students={students}
          config={config}
          studentIdLocked={Boolean(defaultStudentId)}
          showRecurringHint={isWeekly}
          anchorDate={isWeekly ? null : date}
        />

        {error ? <p className="text-[13px] text-[var(--brand-red)]">{error}</p> : null}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            className={scheduleGhostBtnClass}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className={schedulePrimaryBtnClass}
            onClick={handleSave}
            disabled={saving || !values.studentId}
          >
            {saving ? 'Saving…' : isWeekly ? 'Save weekly slot' : 'Save one-time class'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

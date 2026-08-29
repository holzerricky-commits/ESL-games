'use client'

import { useEffect, useMemo, useState } from 'react'
import { DAY_LABELS, fmtScheduleMinute, scheduleMinuteOptions } from '@/lib/schedule/schedule-time-labels'
import { dateInWeekForDayOfWeek, recurringLabel } from '@/lib/schedule/week-view-layout'
  import {
  CLASS_DURATION_MAX,
  CLASS_DURATION_MIN,
  CLASS_DURATION_PRESETS,
  isClassDurationPreset,
  normalizeClassDurationMinutes,
} from '@/lib/schedule/class-duration'
import type { TeacherWeeklyScheduleConfig } from '@/lib/types'

const selectClass =
  'w-full rounded-xl border-0 bg-[var(--surface-3)] px-3 py-2 text-sm tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-blue)]/25'

export interface SlotFormValues {
  dayOfWeek: number
  startMinute: number
  durationMinutes: number
  studentId: string
}

interface SlotFormFieldsProps {
  values: SlotFormValues
  onChange: (patch: Partial<SlotFormValues>) => void
  students: Array<{ id: string; name: string }>
  config: TeacherWeeklyScheduleConfig
  studentIdLocked?: boolean
  hideStudentField?: boolean
  showRecurringHint?: boolean
  /** When set with showRecurringHint=false, shows a one-time class date hint for that week. */
  anchorDate?: Date | null
}

export function SlotFormFields({
  values,
  onChange,
  students,
  config,
  studentIdLocked = false,
  hideStudentField = false,
  showRecurringHint = true,
  anchorDate = null,
}: SlotFormFieldsProps) {
  const workingDays = config.workingDays.length > 0 ? config.workingDays : [1, 2, 3, 4, 5]
  const minuteOptions = scheduleMinuteOptions(config.startMinute, config.endMinute)
  const dayOptions = workingDays
  const [otherMode, setOtherMode] = useState(() => !isClassDurationPreset(values.durationMinutes))
  const [otherDraft, setOtherDraft] = useState(String(values.durationMinutes))
  const selectValue = otherMode ? 'other' : String(values.durationMinutes)
  const otherVisible = otherMode

  useEffect(() => {
    setOtherMode(!isClassDurationPreset(values.durationMinutes))
    setOtherDraft(String(values.durationMinutes))
  }, [values.durationMinutes])

  const lengthHint = useMemo(() => {
    if (!otherVisible) return null
    return `${CLASS_DURATION_MIN}–${CLASS_DURATION_MAX} minutes`
  }, [otherVisible])

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {!hideStudentField ? (
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Student</span>
            <select
              className={selectClass}
              value={values.studentId}
              disabled={studentIdLocked}
              onChange={(e) => onChange({ studentId: e.target.value })}
            >
              <option value="">Select student</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className={hideStudentField ? 'space-y-1 sm:col-span-2' : 'space-y-1'}>
          <label className="space-y-1 block">
            <span className="text-xs font-medium text-muted-foreground">Length</span>
            <select
              className={selectClass}
              value={selectValue}
              onChange={(e) => {
                const v = e.target.value
                if (v === 'other') {
                  setOtherMode(true)
                  setOtherDraft(String(values.durationMinutes))
                  return
                }
                setOtherMode(false)
                onChange({ durationMinutes: normalizeClassDurationMinutes(Number(v), 30) })
              }}
            >
              {CLASS_DURATION_PRESETS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} min
                </option>
              ))}
              <option value="other">Other…</option>
            </select>
          </label>
          {otherVisible ? (
            <label className="mt-2 block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Minutes</span>
              <input
                type="number"
                min={CLASS_DURATION_MIN}
                max={CLASS_DURATION_MAX}
                step={1}
                className={selectClass}
                value={otherDraft}
                onChange={(e) => {
                  setOtherDraft(e.target.value)
                  const n = Number(e.target.value)
                  if (Number.isFinite(n)) {
                    onChange({ durationMinutes: normalizeClassDurationMinutes(n, 30) })
                  }
                }}
                onBlur={() => {
                  const next = normalizeClassDurationMinutes(otherDraft, values.durationMinutes)
                  setOtherDraft(String(next))
                  onChange({ durationMinutes: next })
                }}
              />
              {lengthHint ? <p className="text-xs text-muted-foreground">{lengthHint}</p> : null}
            </label>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Day</span>
          <select
            className={selectClass}
            value={values.dayOfWeek}
            onChange={(e) => onChange({ dayOfWeek: Number(e.target.value) })}
          >
            {dayOptions.map((day) => (
              <option key={day} value={day}>
                {DAY_LABELS[day]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Time</span>
          <select
            className={selectClass}
            value={values.startMinute}
            onChange={(e) => onChange({ startMinute: Number(e.target.value) })}
          >
            {minuteOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {showRecurringHint ? (
        <p className="text-xs text-muted-foreground">
          {recurringLabel(values.dayOfWeek, values.startMinute)} · {values.durationMinutes} min
        </p>
      ) : anchorDate ? (
        <p className="text-xs text-muted-foreground">
          {onceClassLabel(anchorDate, values.dayOfWeek, values.startMinute, values.durationMinutes)}
        </p>
      ) : null}
    </div>
  )
}

export function slotFormValuesFromDate(
  date: Date,
  startMinute: number,
  studentId: string,
  durationMinutes: number = 30,
): SlotFormValues {
  return {
    dayOfWeek: date.getDay(),
    startMinute,
    durationMinutes: normalizeClassDurationMinutes(durationMinutes, 30),
    studentId,
  }
}

function onceClassLabel(
  anchorDate: Date,
  dayOfWeek: number,
  startMinute: number,
  durationMinutes: number,
): string {
  const target = dateInWeekForDayOfWeek(anchorDate, dayOfWeek)
  const datePart = target.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  return `One time · ${datePart} at ${fmtScheduleMinute(startMinute)} · ${durationMinutes} min`
}

export function formatSessionDateTime(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export { fmtScheduleMinute }

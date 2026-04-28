'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { getStudentsListView, getTeacherWeeklyScheduleConfig, getWeeklySlotAssignments, removeWeeklySlotAssignment, saveTeacherWeeklyScheduleConfig, upsertWeeklySlotAssignment } from '@/lib/students/selectors'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function fmtMinute(total: number): string {
  const h24 = Math.floor(total / 60)
  const m = total % 60
  const ampm = h24 >= 12 ? 'PM' : 'AM'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

function minuteOptions(): Array<{ value: number; label: string }> {
  const out: Array<{ value: number; label: string }> = []
  for (let minute = 0; minute <= 24 * 60; minute += 30) {
    out.push({ value: minute, label: fmtMinute(minute) })
  }
  return out
}

export function WeeklyScheduleGrid() {
  const [version, setVersion] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [slotDay, setSlotDay] = useState<number | null>(null)
  const [slotMinute, setSlotMinute] = useState<number | null>(null)
  const [studentId, setStudentId] = useState('')
  const [durationMinutes, setDurationMinutes] = useState<'30' | '60'>('30')

  const cfg = useMemo(() => getTeacherWeeklyScheduleConfig(), [version])
  const slots = useMemo(() => getWeeklySlotAssignments(), [version])
  const students = useMemo(() => getStudentsListView(), [version])
  const minuteList = useMemo(() => minuteOptions(), [])

  const visibleDays = cfg.workingDays
  const rows: number[] = []
  for (let minute = cfg.startMinute; minute < cfg.endMinute; minute += 30) rows.push(minute)

  const slotMap = new Map<string, { id: string; studentName: string; durationMinutes: number; spanStart: boolean }>()
  for (const slot of slots) {
    const studentName = students.find((student) => student.id === slot.studentId)?.name ?? 'Unknown'
    const firstKey = `${slot.dayOfWeek}-${slot.startMinute}`
    slotMap.set(firstKey, {
      id: slot.id,
      studentName,
      durationMinutes: slot.durationMinutes,
      spanStart: true,
    })
    if (slot.durationMinutes === 60) {
      slotMap.set(`${slot.dayOfWeek}-${slot.startMinute + 30}`, {
        id: slot.id,
        studentName,
        durationMinutes: slot.durationMinutes,
        spanStart: false,
      })
    }
  }

  function refresh() {
    setVersion((v) => v + 1)
  }

  function saveConfig(next: Partial<{ workingDays: number[]; startMinute: number; endMinute: number; slotMinutes: 30 }>) {
    setError(null)
    saveTeacherWeeklyScheduleConfig({
      workingDays: next.workingDays ?? cfg.workingDays,
      startMinute: next.startMinute ?? cfg.startMinute,
      endMinute: next.endMinute ?? cfg.endMinute,
      slotMinutes: 30,
    })
    refresh()
  }

  function toggleWorkingDay(day: number) {
    const has = cfg.workingDays.includes(day)
    const next = has ? cfg.workingDays.filter((d) => d !== day) : [...cfg.workingDays, day].sort((a, b) => a - b)
    if (next.length === 0) return
    saveConfig({ workingDays: next })
  }

  function assignSlot() {
    if (slotDay == null || slotMinute == null) return
    const result = upsertWeeklySlotAssignment({
      dayOfWeek: slotDay,
      startMinute: slotMinute,
      durationMinutes: durationMinutes === '60' ? 60 : 30,
      studentId,
    })
    if (!result.ok) {
      setError(result.error)
      return
    }
    setError(null)
    setSlotDay(null)
    setSlotMinute(null)
    setStudentId('')
    setDurationMinutes('30')
    refresh()
  }

  function removeSlot(slotId: string) {
    const result = removeWeeklySlotAssignment(slotId)
    if (!result.ok) {
      setError(result.error)
      return
    }
    refresh()
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
        <h3 className="text-base font-semibold text-foreground">Teaching window</h3>
        <p className="mt-1 text-xs text-muted-foreground">Set your weekly working days and time range (30-minute blocks).</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {DAY_LABELS.map((label, day) => (
            <Button
              key={label}
              type="button"
              size="sm"
              variant={cfg.workingDays.includes(day) ? 'default' : 'outline'}
              onClick={() => toggleWorkingDay(day)}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">Start</span>
            <select
              className="w-full rounded-md border border-[var(--border)] bg-background px-3 py-2 text-sm"
              value={cfg.startMinute}
              onChange={(e) => saveConfig({ startMinute: Number(e.target.value) })}
            >
              {minuteList.map((item) => (
                <option key={`start-${item.value}`} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">End</span>
            <select
              className="w-full rounded-md border border-[var(--border)] bg-background px-3 py-2 text-sm"
              value={cfg.endMinute}
              onChange={(e) => saveConfig({ endMinute: Number(e.target.value) })}
            >
              {minuteList.map((item) => (
                <option key={`end-${item.value}`} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-foreground">Weekly calendar</h3>
          <Button type="button" variant="outline" size="sm" onClick={refresh}>
            Refresh upcoming 30 days
          </Button>
        </div>
        {error ? <p className="mb-3 text-sm text-[var(--brand-red)]">{error}</p> : null}

        <div className="overflow-x-auto">
          <table className="min-w-[920px] table-fixed border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="w-28 rounded-md bg-[var(--surface-2)] px-2 py-2 text-left text-xs font-semibold text-muted-foreground">
                  Time
                </th>
                {visibleDays.map((day) => (
                  <th
                    key={`head-${day}`}
                    className="rounded-md bg-[var(--surface-2)] px-2 py-2 text-left text-xs font-semibold text-muted-foreground"
                  >
                    {DAY_LABELS[day]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((minute) => (
                <tr key={`row-${minute}`}>
                  <td className="rounded-md bg-[var(--surface-2)] px-2 py-2 text-xs font-medium text-muted-foreground">
                    {fmtMinute(minute)}
                  </td>
                  {visibleDays.map((day) => {
                    const key = `${day}-${minute}`
                    const slot = slotMap.get(key)
                    if (slot && !slot.spanStart) {
                      return (
                        <td key={key} className="rounded-md border border-[var(--border)] bg-[var(--surface-2)]/40 px-2 py-2 text-[11px] text-muted-foreground">
                          ↳ continues
                        </td>
                      )
                    }
                    if (slot && slot.spanStart) {
                      return (
                        <td key={key} className="rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-2 align-top">
                          <p className="text-xs font-semibold text-foreground">{slot.studentName}</p>
                          <p className="text-[11px] text-muted-foreground">{slot.durationMinutes} min</p>
                          <Button type="button" size="sm" variant="outline" className="mt-2 h-7 text-[11px]" onClick={() => removeSlot(slot.id)}>
                            Remove
                          </Button>
                        </td>
                      )
                    }
                    return (
                      <td key={key} className="rounded-md border border-dashed border-[var(--border)] px-2 py-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 w-full justify-start px-1 text-xs text-muted-foreground"
                          onClick={() => {
                            setSlotDay(day)
                            setSlotMinute(minute)
                            setError(null)
                          }}
                        >
                          + Assign
                        </Button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {slotDay != null && slotMinute != null ? (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          <h3 className="text-base font-semibold text-foreground">
            Assign slot · {DAY_LABELS[slotDay]} {fmtMinute(slotMinute)}
          </h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">Student</span>
              <select
                className="w-full rounded-md border border-[var(--border)] bg-background px-3 py-2 text-sm"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
              >
                <option value="">Select student</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">Duration</span>
              <select
                className="w-full rounded-md border border-[var(--border)] bg-background px-3 py-2 text-sm"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value as '30' | '60')}
              >
                <option value="30">30 min</option>
                <option value="60">60 min</option>
              </select>
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" onClick={assignSlot} disabled={!studentId}>
              Save slot
            </Button>
            <Button type="button" variant="outline" onClick={() => {
              setSlotDay(null)
              setSlotMinute(null)
            }}>
              Cancel
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  )
}

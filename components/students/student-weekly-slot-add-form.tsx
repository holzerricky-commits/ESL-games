'use client'

import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { SlotFormFields, type SlotFormValues } from '@/components/schedule/slot-form-fields'
import { DAY_LABELS, fmtScheduleMinute, scheduleMinuteOptions } from '@/lib/schedule/schedule-time-labels'
import { getTeacherWeeklyScheduleConfig, upsertWeeklySlotAssignment } from '@/lib/students/selectors'

interface StudentWeeklySlotAddFormProps {
  studentId: string
  onSaved: () => void
  addLabel?: string
}

export function StudentWeeklySlotAddForm({
  studentId,
  onSaved,
  addLabel = 'Add time',
}: StudentWeeklySlotAddFormProps) {
  const config = useMemo(() => getTeacherWeeklyScheduleConfig(), [])
  const workingDays = config.workingDays.length > 0 ? config.workingDays : [1, 2, 3, 4, 5]
  const minuteOptions = useMemo(
    () => scheduleMinuteOptions(config.startMinute, config.endMinute),
    [config.endMinute, config.startMinute],
  )
  const defaultDay = workingDays[0] ?? 1
  const defaultMinute = minuteOptions[0]?.value ?? config.startMinute

  const [values, setValues] = useState<SlotFormValues>({
    dayOfWeek: defaultDay,
    startMinute: defaultMinute,
    durationMinutes: 30,
    studentId,
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function handleSave() {
    setSaving(true)
    setError(null)
    const result = upsertWeeklySlotAssignment({
      dayOfWeek: values.dayOfWeek,
      startMinute: values.startMinute,
      durationMinutes: values.durationMinutes,
      studentId,
    })
    setSaving(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    toast.success(`Weekly time set · ${DAY_LABELS[values.dayOfWeek]} ${fmtScheduleMinute(values.startMinute)}`)
    onSaved()
  }

  return (
    <div className="space-y-3">
      <SlotFormFields
        values={{ ...values, studentId }}
        onChange={(patch) => setValues((prev) => ({ ...prev, ...patch }))}
        students={[]}
        config={config}
        studentIdLocked
        hideStudentField
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleSave}
          disabled={saving}
        >
          <Plus size={16} aria-hidden />
          {saving ? 'Saving…' : addLabel}
        </Button>
      </div>
      {error ? <p className="text-sm text-[var(--brand-red)]">{error}</p> : null}
    </div>
  )
}

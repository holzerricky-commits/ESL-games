'use client'

import { useEffect, useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { setStudentFirstClassWelcome } from '@/lib/students/selectors'
import type { StudentProfileView } from '@/lib/students/types'

interface TeacherFirstClassWelcomeToggleProps {
  student: StudentProfileView
  studentId: string
  onUpdated: () => void
}

/** Teacher-only: lesson screen says "Welcome" vs "Welcome back" before the first class ends. */
export function TeacherFirstClassWelcomeToggle({
  student,
  studentId,
  onUpdated,
}: TeacherFirstClassWelcomeToggleProps) {
  const completedCount = student.scheduledClasses.filter((session) => session.status === 'completed').length
  const [checked, setChecked] = useState(student.showFirstClassWelcome)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setChecked(student.showFirstClassWelcome)
  }, [student.showFirstClassWelcome])

  if (completedCount > 0) return null

  const handleToggle = (next: boolean) => {
    setChecked(next)
    setSaving(true)
    const result = setStudentFirstClassWelcome(studentId, next)
    setSaving(false)
    if (result.ok) {
      onUpdated()
    } else {
      setChecked(student.showFirstClassWelcome)
    }
  }

  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-3)] px-3 py-3">
      <Checkbox
        checked={checked}
        disabled={saving}
        onCheckedChange={(value) => handleToggle(value === true)}
        className="mt-0.5"
      />
      <span className="space-y-1">
        <span className="block text-sm font-medium text-foreground">Brand-new student</span>
        <span className="block text-sm text-muted-foreground">
          First class with you — lesson screen says &ldquo;Welcome&rdquo; instead of &ldquo;Welcome back.&rdquo;
        </span>
      </span>
    </label>
  )
}

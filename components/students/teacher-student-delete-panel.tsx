'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { RemoveStudentDialog } from '@/components/students/remove-student-dialog'
import {
  isStudentOnBreak,
  putStudentOnBreak,
  restoreStudentFromBreak,
  STUDENT_LOCAL_DATA_CHANGED_EVENT,
} from '@/lib/students/selectors'
import { getStudents } from '@/lib/storage'
import { useToast } from '@/hooks/use-toast'

interface TeacherStudentDeletePanelProps {
  studentId: string
  studentName: string
}

export function TeacherStudentDeletePanel({ studentId, studentName }: TeacherStudentDeletePanelProps) {
  const [open, setOpen] = useState(false)
  const [version, setVersion] = useState(0)
  const { toast } = useToast()

  useEffect(() => {
    const bump = () => setVersion((v) => v + 1)
    window.addEventListener(STUDENT_LOCAL_DATA_CHANGED_EVENT, bump)
    return () => window.removeEventListener(STUDENT_LOCAL_DATA_CHANGED_EVENT, bump)
  }, [])

  const record = getStudents().find((row) => row.id === studentId)
  void version
  const onBreak = record ? isStudentOnBreak(record) : false

  const handleRestore = () => {
    const result = restoreStudentFromBreak(studentId)
    if (!result.ok) {
      toast({ variant: 'destructive', title: 'Could not restore', description: result.error })
      return
    }
    setVersion((v) => v + 1)
    toast({ title: `${studentName} is active again`, description: 'They are back on your student list.' })
  }

  const handlePutOnBreak = () => {
    const result = putStudentOnBreak(studentId)
    if (!result.ok) {
      toast({ variant: 'destructive', title: 'Could not put on break', description: result.error })
      return
    }
    setVersion((v) => v + 1)
    toast({
      title: `${studentName} is on break`,
      description: 'Hidden from the main list. Weekly times are free.',
    })
  }

  return (
    <>
      <div className="space-y-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 sm:p-5">
          <p className="text-sm font-semibold text-foreground">Roster</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {onBreak
              ? `${studentName} is on break — hidden from your main list, history kept.`
              : `Put ${studentName} on break to hide them without deleting history.`}
          </p>
          {onBreak ? (
            <Button type="button" className="mt-4" onClick={handleRestore}>
              Restore to active list
            </Button>
          ) : (
            <Button type="button" variant="secondary" className="mt-4" onClick={handlePutOnBreak}>
              Put on break
            </Button>
          )}
        </div>

        <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-4 sm:p-5">
          <p className="text-sm font-semibold text-destructive">Delete forever</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Permanently remove {studentName}, including progress, quiz history for this name, and weekly
            times. This cannot be undone.
          </p>
          <Button type="button" variant="destructive" className="mt-4" onClick={() => setOpen(true)}>
            Delete forever…
          </Button>
        </div>
      </div>

      <RemoveStudentDialog
        studentId={studentId}
        studentName={studentName}
        open={open}
        onOpenChange={setOpen}
        redirectToStudents
        deleteOnly
      />
    </>
  )
}

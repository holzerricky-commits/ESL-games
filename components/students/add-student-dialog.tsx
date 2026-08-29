'use client'

import { useState } from 'react'
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
import { Checkbox } from '@/components/ui/checkbox'
import {
  teacherDialogContentClass,
  teacherDialogDescriptionClass,
  teacherDialogOverlayClass,
  teacherDialogTitleClass,
  teacherFieldClass,
  teacherFocusRingClass,
  teacherGhostBtnClass,
  teacherPrimaryBtnClass,
} from '@/components/teacher-chrome'
import { ensureStudentAvatarOnServer, ensureStudentAvatarsForAdded } from '@/lib/students/student-avatar-client'
import { addStudentRecord, addStudentRecords } from '@/lib/students/selectors'
import { cn } from '@/lib/utils'

type AddStudentMode = 'single' | 'batch' | 'batch-result'

interface BatchResult {
  added: Array<{ name: string; studentId: string }>
  failed: Array<{ name: string; error: string }>
}

interface AddStudentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onStudentsAdded: (studentIds: string[]) => void
}

export function AddStudentDialog({ open, onOpenChange, onStudentsAdded }: AddStudentDialogProps) {
  const [mode, setMode] = useState<AddStudentMode>('single')
  const [studentName, setStudentName] = useState('')
  const [batchNames, setBatchNames] = useState('')
  const [firstClassWelcome, setFirstClassWelcome] = useState(false)
  const [formError, setFormError] = useState('')
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null)
  const [saving, setSaving] = useState(false)

  const resetForm = () => {
    setMode('single')
    setStudentName('')
    setBatchNames('')
    setFirstClassWelcome(false)
    setFormError('')
    setBatchResult(null)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen)
    if (!nextOpen) resetForm()
  }

  const handleAddStudent = async () => {
    const result = addStudentRecord({ name: studentName, firstClassWelcome })
    if (!result.ok) {
      setFormError(result.error)
      return
    }
    const addedName = studentName.trim()
    setSaving(true)
    try {
      await ensureStudentAvatarOnServer(result.studentId, addedName)
      onStudentsAdded([result.studentId])
      handleOpenChange(false)
      toast.success(`Added ${addedName}`)
    } finally {
      setSaving(false)
    }
  }

  const handleAddBatch = async () => {
    const lines = batchNames.split(/\r?\n/)
    if (lines.every((line) => !line.trim())) {
      setFormError('Enter at least one name.')
      return
    }

    const result = addStudentRecords(lines, { firstClassWelcome })
    if (result.added.length === 0 && result.failed.length === 0) {
      setFormError('Enter at least one name.')
      return
    }

    setFormError('')
    setBatchResult(result)
    setMode('batch-result')
    if (result.added.length > 0) {
      setSaving(true)
      try {
        await ensureStudentAvatarsForAdded(
          result.added.map((row) => ({ studentId: row.studentId, name: row.name })),
        )
        onStudentsAdded(result.added.map((row) => row.studentId))
      } finally {
        setSaving(false)
      }
    }
  }

  const handleBatchDone = () => {
    handleOpenChange(false)
  }

  const isBatch = mode === 'batch'

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        overlayClassName={teacherDialogOverlayClass}
        className={teacherDialogContentClass}
      >
        {mode === 'batch-result' && batchResult ? (
          <>
            <DialogHeader>
              <DialogTitle className={teacherDialogTitleClass}>
                {batchResult.added.length === 1
                  ? 'Added 1 student'
                  : `Added ${batchResult.added.length} students`}
              </DialogTitle>
              <DialogDescription className={teacherDialogDescriptionClass}>
                {batchResult.failed.length > 0
                  ? 'Some names could not be added.'
                  : 'All names were added successfully.'}
              </DialogDescription>
            </DialogHeader>

            {batchResult.failed.length > 0 ? (
              <ul className="space-y-2 text-[13px]">
                {batchResult.failed.map((item) => (
                  <li key={`${item.name}-${item.error}`} className="text-[var(--brand-red)]">
                    <span className="font-medium">{item.name}</span>
                    <span className="text-muted-foreground"> — {item.error}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            <DialogFooter>
              <Button className={cn(teacherPrimaryBtnClass, teacherFocusRingClass)} onClick={handleBatchDone}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className={teacherDialogTitleClass}>
                {isBatch ? 'Add several students' : 'Add student'}
              </DialogTitle>
              <DialogDescription className={teacherDialogDescriptionClass}>
                {isBatch
                  ? 'One name per line. Empty lines are ignored.'
                  : 'You can assign a book and class time after they’re added.'}
              </DialogDescription>
            </DialogHeader>

            <div className="flex gap-1" role="radiogroup" aria-label="How many to add">
              <button
                type="button"
                role="radio"
                aria-checked={!isBatch}
                data-active={!isBatch}
                className={cn('chrome-nav-pill flex-1 justify-center px-3.5 py-2 text-[13px]', teacherFocusRingClass)}
                onClick={() => {
                  setMode('single')
                  setFormError('')
                }}
              >
                One
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={isBatch}
                data-active={isBatch}
                className={cn('chrome-nav-pill flex-1 justify-center px-3.5 py-2 text-[13px]', teacherFocusRingClass)}
                onClick={() => {
                  setMode('batch')
                  setFormError('')
                }}
              >
                Several
              </button>
            </div>

            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault()
                if (isBatch) void handleAddBatch()
                else void handleAddStudent()
              }}
            >
              {isBatch ? (
                <div className="space-y-1">
                  <label htmlFor="add-students-batch" className="text-[13px] font-medium text-muted-foreground">
                    Names
                  </label>
                  <textarea
                    id="add-students-batch"
                    value={batchNames}
                    onChange={(event) => setBatchNames(event.target.value)}
                    placeholder={'Ella\nParker'}
                    className={cn(teacherFieldClass, 'min-h-[140px] resize-y')}
                    autoFocus
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <label htmlFor="add-student-name" className="text-[13px] font-medium text-muted-foreground">
                    Name
                  </label>
                  <input
                    id="add-student-name"
                    value={studentName}
                    onChange={(event) => setStudentName(event.target.value)}
                    placeholder="Student name"
                    className={teacherFieldClass}
                    autoFocus
                  />
                </div>
              )}

              <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-[var(--surface-3)] px-3 py-3">
                <Checkbox
                  checked={firstClassWelcome}
                  onCheckedChange={(checked) => setFirstClassWelcome(checked === true)}
                  className="mt-0.5"
                />
                <span className="space-y-1">
                  <span className="block text-[13px] font-medium tracking-tight text-foreground">
                    {isBatch ? 'Brand-new students' : 'Brand-new student'}
                  </span>
                  <span className="block text-[13px] text-muted-foreground">
                    First class with you — the lesson screen will say “Welcome” instead of “Welcome back.”
                  </span>
                </span>
              </label>

              {formError ? <p className="text-[13px] text-[var(--brand-red)]">{formError}</p> : null}

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className={cn(teacherGhostBtnClass, teacherFocusRingClass)}
                  onClick={() => handleOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className={cn(teacherPrimaryBtnClass, teacherFocusRingClass)}>
                  {saving ? 'Adding…' : isBatch ? 'Add students' : 'Add student'}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

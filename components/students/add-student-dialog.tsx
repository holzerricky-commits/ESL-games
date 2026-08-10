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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { ensureStudentAvatarOnServer, ensureStudentAvatarsForAdded } from '@/lib/students/student-avatar-client'
import { addStudentRecord, addStudentRecords } from '@/lib/students/selectors'

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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        {mode === 'batch-result' && batchResult ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {batchResult.added.length === 1
                  ? 'Added 1 student'
                  : `Added ${batchResult.added.length} students`}
              </DialogTitle>
              <DialogDescription>
                {batchResult.failed.length > 0
                  ? 'Some names could not be added.'
                  : 'All names were added successfully.'}
              </DialogDescription>
            </DialogHeader>

            {batchResult.failed.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {batchResult.failed.map((item) => (
                  <li key={`${item.name}-${item.error}`} className="text-[var(--brand-red)]">
                    <span className="font-medium">{item.name}</span>
                    <span className="text-muted-foreground"> — {item.error}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            <DialogFooter>
              <Button
                className="bg-[var(--brand-blue)] text-white hover:bg-[var(--brand-blue-bright)]"
                onClick={handleBatchDone}
              >
                Done
              </Button>
            </DialogFooter>
          </>
        ) : mode === 'batch' ? (
          <>
            <DialogHeader>
              <DialogTitle>Add several students</DialogTitle>
              <DialogDescription>One name per line. Empty lines are ignored.</DialogDescription>
            </DialogHeader>

            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault()
                void handleAddBatch()
              }}
            >
              <div className="space-y-1">
                <label htmlFor="add-students-batch" className="text-sm font-medium text-foreground">
                  Names
                </label>
                <Textarea
                  id="add-students-batch"
                  value={batchNames}
                  onChange={(event) => setBatchNames(event.target.value)}
                  placeholder={'Ella\nParker'}
                  className="min-h-[140px]"
                  autoFocus
                />
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3">
                <Checkbox
                  checked={firstClassWelcome}
                  onCheckedChange={(checked) => setFirstClassWelcome(checked === true)}
                  className="mt-0.5"
                />
                <span className="space-y-1">
                  <span className="block text-sm font-medium text-foreground">Brand-new students</span>
                  <span className="block text-sm text-muted-foreground">
                    First class with you — the lesson screen will say &ldquo;Welcome&rdquo; instead of &ldquo;Welcome back.&rdquo;
                  </span>
                </span>
              </label>

              {formError ? <p className="text-sm text-[var(--brand-red)]">{formError}</p> : null}

              <button
                type="button"
                className="text-sm font-medium text-[var(--brand-blue)] hover:underline"
                onClick={() => {
                  setMode('single')
                  setFormError('')
                }}
              >
                Add one student
              </button>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-[var(--brand-blue)] text-white hover:bg-[var(--brand-blue-bright)]"
                >
                  {saving ? 'Adding…' : 'Add students'}
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Add student</DialogTitle>
              <DialogDescription>Assign books and plan classes from each student’s Plan screen.</DialogDescription>
            </DialogHeader>

            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault()
                void handleAddStudent()
              }}
            >
              <div className="space-y-1">
                <label htmlFor="add-student-name" className="text-sm font-medium text-foreground">
                  Name
                </label>
                <Input
                  id="add-student-name"
                  value={studentName}
                  onChange={(event) => setStudentName(event.target.value)}
                  placeholder="Student name"
                  autoFocus
                />
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3">
                <Checkbox
                  checked={firstClassWelcome}
                  onCheckedChange={(checked) => setFirstClassWelcome(checked === true)}
                  className="mt-0.5"
                />
                <span className="space-y-1">
                  <span className="block text-sm font-medium text-foreground">Brand-new student</span>
                  <span className="block text-sm text-muted-foreground">
                    First class with you — the lesson screen will say &ldquo;Welcome&rdquo; instead of &ldquo;Welcome back.&rdquo;
                  </span>
                </span>
              </label>

              {formError ? <p className="text-sm text-[var(--brand-red)]">{formError}</p> : null}

              <button
                type="button"
                className="text-sm font-medium text-[var(--brand-blue)] hover:underline"
                onClick={() => {
                  setMode('batch')
                  setFormError('')
                }}
              >
                Add several students…
              </button>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-[var(--brand-blue)] text-white hover:bg-[var(--brand-blue-bright)]"
                >
                  {saving ? 'Adding…' : 'Add student'}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

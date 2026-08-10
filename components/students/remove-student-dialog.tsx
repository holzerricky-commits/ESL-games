'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { removeStudentWorkFolderOnServer } from '@/lib/storage'
import {
  deleteStudentPermanently,
  putStudentOnBreak,
} from '@/lib/students/selectors'

type RemoveMode = 'choose' | 'confirm-delete'

interface RemoveStudentDialogProps {
  studentId: string
  studentName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onRemoved?: () => void
  /** When true, navigates to /students after removal (plan page). */
  redirectToStudents?: boolean
  /** Skip the choose step and go straight to the final “are you sure?” check. */
  deleteOnly?: boolean
}

export function RemoveStudentDialog({
  studentId,
  studentName,
  open,
  onOpenChange,
  onRemoved,
  redirectToStudents = false,
  deleteOnly = false,
}: RemoveStudentDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [mode, setMode] = useState<RemoveMode>(deleteOnly ? 'confirm-delete' : 'choose')
  const [busy, setBusy] = useState(false)

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next)
    if (!next) {
      setMode(deleteOnly ? 'confirm-delete' : 'choose')
      setBusy(false)
    } else {
      setMode(deleteOnly ? 'confirm-delete' : 'choose')
    }
  }

  const finishAndClose = () => {
    handleOpenChange(false)
    onRemoved?.()
    if (redirectToStudents) {
      router.push('/students')
      router.refresh()
    }
  }

  const handlePutOnBreak = () => {
    setBusy(true)
    const result = putStudentOnBreak(studentId)
    setBusy(false)
    if (!result.ok) {
      toast({
        variant: 'destructive',
        title: 'Could not put on break',
        description: result.error,
      })
      return
    }
    toast({
      title: `${studentName} is on break`,
      description: 'Hidden from your list. Weekly times are free. You can restore them anytime.',
    })
    finishAndClose()
  }

  const handleConfirmDelete = async () => {
    setBusy(true)
    const removed = deleteStudentPermanently(studentId)
    if (!removed.ok) {
      toast({
        variant: 'destructive',
        title: 'Could not delete student',
        description: removed.error,
      })
      setBusy(false)
      return
    }

    // Best-effort: also clear local homework/exports folder when running locally.
    const disk = await removeStudentWorkFolderOnServer(studentId)
    if (!disk.ok) {
      toast({
        title: `${removed.name} deleted`,
        description: 'Profile and schedule are gone. Local export folder could not be removed.',
      })
      setBusy(false)
      finishAndClose()
      return
    }

    toast({
      title: `${removed.name} deleted`,
      description: 'Gone for good — including progress and weekly times.',
    })
    setBusy(false)
    finishAndClose()
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        {mode === 'choose' ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>What should happen to {studentName}?</AlertDialogTitle>
              <AlertDialogDescription>
                Most of the time you want them off the active list without throwing away their history.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3 py-1">
              <button
                type="button"
                disabled={busy}
                onClick={handlePutOnBreak}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 text-left transition-colors hover:border-[var(--brand-blue)]/40 hover:bg-[var(--surface-1)] disabled:opacity-60"
              >
                <p className="text-sm font-semibold text-foreground">Put on break</p>
                <p className="mt-1 text-xs leading-snug text-muted-foreground">
                  Hide from your student list and free their weekly times. Keep notes, progress, and past
                  classes. You can restore them later.
                </p>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setMode('confirm-delete')}
                className="w-full rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-left transition-colors hover:border-destructive/50 disabled:opacity-60"
              >
                <p className="text-sm font-semibold text-destructive">Delete forever</p>
                <p className="mt-1 text-xs leading-snug text-muted-foreground">
                  Remove everything for this student. This cannot be undone.
                </p>
              </button>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Really delete {studentName}?</AlertDialogTitle>
              <AlertDialogDescription>
                This cannot be undone. Their profile, progress, and weekly times will be gone for good.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              {deleteOnly ? null : (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setMode('choose')}
                >
                  Back
                </Button>
              )}
              <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
              <Button
                type="button"
                variant="destructive"
                disabled={busy}
                onClick={() => void handleConfirmDelete()}
              >
                {busy ? 'Deleting…' : 'Yes, delete forever'}
              </Button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}

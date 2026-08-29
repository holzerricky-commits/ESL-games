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
import {
  teacherDialogContentClass,
  teacherDialogDescriptionClass,
  teacherDialogOverlayClass,
  teacherDialogTitleClass,
  teacherFocusRingClass,
  teacherGhostBtnClass,
  teacherPrimaryBtnClass,
  teacherQuietBtnClass,
} from '@/components/teacher-chrome'
import { cn } from '@/lib/utils'

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
      <AlertDialogContent
        overlayClassName={teacherDialogOverlayClass}
        className={teacherDialogContentClass}
      >
        {mode === 'choose' ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className={teacherDialogTitleClass}>
                What should happen to {studentName}?
              </AlertDialogTitle>
              <AlertDialogDescription className={teacherDialogDescriptionClass}>
                Most of the time you want them off the active list without throwing away their history.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2 py-1">
              <button
                type="button"
                disabled={busy}
                onClick={handlePutOnBreak}
                className={cn(
                  'w-full rounded-xl bg-[var(--surface-3)] p-3.5 text-left transition-colors hover:bg-[var(--surface-4)] disabled:opacity-60',
                  teacherFocusRingClass,
                )}
              >
                <p className="text-[13px] font-semibold tracking-tight text-foreground">Put on break</p>
                <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
                  Hide from your student list and free their weekly times. Keep notes, progress, and past
                  classes. You can restore them later.
                </p>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setMode('confirm-delete')}
                className={cn(
                  'w-full rounded-xl bg-[color-mix(in_srgb,var(--brand-red)_8%,var(--surface-3))] p-3.5 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--brand-red)_12%,var(--surface-3))] disabled:opacity-60',
                  teacherFocusRingClass,
                )}
              >
                <p className="text-[13px] font-semibold tracking-tight text-[var(--brand-red)]">Delete forever</p>
                <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
                  Remove everything for this student. This cannot be undone.
                </p>
              </button>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy} className={cn(teacherGhostBtnClass, teacherFocusRingClass)}>
                Cancel
              </AlertDialogCancel>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className={teacherDialogTitleClass}>
                Really delete {studentName}?
              </AlertDialogTitle>
              <AlertDialogDescription className={teacherDialogDescriptionClass}>
                This cannot be undone. Their profile, progress, and weekly times will be gone for good.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              {deleteOnly ? null : (
                <Button
                  type="button"
                  variant="ghost"
                  className={cn(teacherGhostBtnClass, teacherFocusRingClass)}
                  disabled={busy}
                  onClick={() => setMode('choose')}
                >
                  Back
                </Button>
              )}
              <AlertDialogCancel disabled={busy} className={cn(teacherQuietBtnClass, teacherFocusRingClass)}>
                Cancel
              </AlertDialogCancel>
              <Button
                type="button"
                variant="destructive"
                className={cn(teacherPrimaryBtnClass, teacherFocusRingClass)}
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

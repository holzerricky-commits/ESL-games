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
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { removeStudentFromBrowserStorage, removeStudentWorkFolderOnServer } from '@/lib/storage'

interface TeacherStudentDeletePanelProps {
  studentId: string
  studentName: string
}

export function TeacherStudentDeletePanel({ studentId, studentName }: TeacherStudentDeletePanelProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [deleteDiskFolder, setDeleteDiskFolder] = useState(false)
  const [busy, setBusy] = useState(false)

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      setDeleteDiskFolder(false)
      setBusy(false)
    }
  }

  const handleConfirmDelete = async () => {
    setBusy(true)
    const removed = removeStudentFromBrowserStorage(studentId)
    if (!removed.ok) {
      toast({
        variant: 'destructive',
        title: 'Could not remove student',
        description: 'Student was not found in local storage.',
      })
      setBusy(false)
      return
    }

    if (deleteDiskFolder) {
      const disk = await removeStudentWorkFolderOnServer(studentId)
      if (!disk.ok) {
        toast({
          variant: 'destructive',
          title: 'Student removed, but folder delete failed',
          description: disk.error,
        })
      }
    }

    setOpen(false)
    setBusy(false)
    setDeleteDiskFolder(false)
    router.push('/students')
    router.refresh()
  }

  return (
    <>
      <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-4 sm:p-5">
        <p className="text-sm font-semibold text-destructive">Danger zone</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Permanently remove {studentName} from this browser, including challenge progress and quiz history for this name.
        </p>
        <Button type="button" variant="destructive" className="mt-4" onClick={() => setOpen(true)}>
          Remove student…
        </Button>
      </div>

      <AlertDialog open={open} onOpenChange={handleOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {studentName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the student profile, assigned path, challenge progress, and saved quiz results that match this
              student name in this browser. It cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
            <Checkbox
              id="delete-student-disk"
              checked={deleteDiskFolder}
              onCheckedChange={(v) => setDeleteDiskFolder(v === true)}
              disabled={busy}
              className="mt-0.5"
            />
            <div className="min-w-0 space-y-1">
              <Label htmlFor="delete-student-disk" className="cursor-pointer text-foreground">
                Also delete local files on this computer
              </Label>
              <p className="text-xs leading-snug text-muted-foreground">
                Removes the <span className="font-mono text-foreground/90">student-work/{studentId}</span> folder from this
                project (exports, homework, materials). Only works while the app runs locally on this machine.
              </p>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <Button type="button" variant="destructive" disabled={busy} onClick={() => void handleConfirmDelete()}>
              {busy ? 'Removing…' : 'Remove student'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

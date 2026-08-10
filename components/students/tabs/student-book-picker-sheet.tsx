'use client'

import { StudentBookPickSteps } from '@/components/students/student-book-pick-steps'
import type { BookLibraryPayload } from '@/lib/books/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface StudentBookPickerSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  library: BookLibraryPayload | null
  libraryLoading?: boolean
  pdfReady: boolean
  studentName: string
  assignedBookIds: string[]
  onAssignedBookIdsChange: (ids: string[]) => void
  onSave: (ids: string[]) => void | Promise<void>
  isSaving?: boolean
}

export function StudentBookPickerSheet({
  open,
  onOpenChange,
  library,
  libraryLoading = false,
  pdfReady,
  studentName,
  assignedBookIds,
  onAssignedBookIdsChange,
  onSave,
  isSaving = false,
}: StudentBookPickerSheetProps) {
  function handleConfirm(ids: string[]) {
    onAssignedBookIdsChange(ids)
    void onSave(ids)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,720px)] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-[var(--border)] px-6 py-4 text-left">
          <DialogTitle>Add books for {studentName}</DialogTitle>
          <DialogDescription className="sr-only">
            Pick series, grade, then books.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {open ? (
            <StudentBookPickSteps
              mode="multi"
              library={library}
              libraryLoading={libraryLoading}
              pdfReady={pdfReady}
              resetKey={open}
              initialSelectedIds={assignedBookIds}
              isSaving={isSaving}
              onConfirm={handleConfirm}
            />
          ) : null}
        </div>

        <DialogFooter className="shrink-0 border-t border-[var(--border)] px-6 py-4 sm:justify-start">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

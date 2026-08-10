'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { fmtScheduleMinute } from '@/lib/schedule/schedule-time-labels'
import { DAY_LABELS } from '@/lib/schedule/schedule-time-labels'
import type { PendingRecurringScheduleChange } from '@/lib/schedule/recurring-change-types'
import type { RecurringChangeScope } from '@/lib/schedule/recurring-change-types'

interface RecurringChangeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  change: PendingRecurringScheduleChange | null
  onChoose: (scope: RecurringChangeScope) => void
}

export function RecurringChangeDialog({
  open,
  onOpenChange,
  change,
  onChoose,
}: RecurringChangeDialogProps) {
  if (!change) return null

  const dayLabel = DAY_LABELS[change.dayOfWeek] ?? 'Day'
  const timeLabel = fmtScheduleMinute(change.startMinute)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change recurring class?</DialogTitle>
          <DialogDescription>
            {change.studentName} · {dayLabel} {timeLabel} · {change.durationMinutes} min
          </DialogDescription>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Choose whether this change applies to just this class or every week going forward.
        </p>

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:items-stretch">
          <Button type="button" onClick={() => onChoose('occurrence')}>
            Only this class
          </Button>
          <Button type="button" variant="outline" onClick={() => onChoose('series')}>
            Every week
          </Button>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

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
import {
  scheduleDialogContentClass,
  scheduleDialogDescriptionClass,
  scheduleDialogOverlayClass,
  scheduleDialogTitleClass,
  scheduleGhostBtnClass,
  schedulePrimaryBtnClass,
  scheduleQuietBtnClass,
} from '@/components/schedule/schedule-sheet-chrome'

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
      <DialogContent
        overlayClassName={scheduleDialogOverlayClass}
        className={scheduleDialogContentClass}
      >
        <DialogHeader>
          <DialogTitle className={scheduleDialogTitleClass}>Change recurring class?</DialogTitle>
          <DialogDescription className={scheduleDialogDescriptionClass}>
            {change.studentName} · {dayLabel} {timeLabel} · {change.durationMinutes} min
          </DialogDescription>
        </DialogHeader>

        <p className="text-[13px] text-muted-foreground">
          Apply this to just this class, or every week going forward.
        </p>

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:items-stretch">
          <Button type="button" className={schedulePrimaryBtnClass} onClick={() => onChoose('occurrence')}>
            Only this class
          </Button>
          <Button
            type="button"
            variant="secondary"
            className={scheduleQuietBtnClass}
            onClick={() => onChoose('series')}
          >
            Every week
          </Button>
          <Button
            type="button"
            variant="ghost"
            className={scheduleGhostBtnClass}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

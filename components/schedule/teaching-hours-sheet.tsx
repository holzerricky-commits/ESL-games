'use client'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { DAY_LABELS, scheduleMinuteOptions } from '@/lib/schedule/schedule-time-labels'
import { cn } from '@/lib/utils'
import type { TeacherWeeklyScheduleConfig } from '@/lib/types'
import {
  scheduleDialogOverlayClass,
  scheduleFieldClass,
  schedulePrimaryBtnClass,
} from '@/components/schedule/schedule-sheet-chrome'

interface TeachingHoursSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: TeacherWeeklyScheduleConfig
  onSave: (next: Partial<TeacherWeeklyScheduleConfig>) => void
}

export function TeachingHoursSheet({ open, onOpenChange, config, onSave }: TeachingHoursSheetProps) {
  const minuteList = scheduleMinuteOptions(0, 24 * 60)

  function toggleWorkingDay(day: number) {
    const has = config.workingDays.includes(day)
    const next = has ? config.workingDays.filter((d) => d !== day) : [...config.workingDays, day].sort((a, b) => a - b)
    if (next.length === 0) return
    onSave({ workingDays: next })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        overlayClassName={scheduleDialogOverlayClass}
        className="w-full rounded-l-[22px] border-l-0 bg-[var(--card)] sm:max-w-md"
      >
        <SheetHeader>
          <SheetTitle className="text-[17px] font-semibold tracking-tight">Working hours</SheetTitle>
          <SheetDescription className="text-[13px]">Days and times you take classes.</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-4">
          <div className="flex flex-wrap gap-2">
            {DAY_LABELS.map((label, day) => {
              const active = config.workingDays.includes(day)
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={active}
                  aria-label={label}
                  onClick={() => toggleWorkingDay(day)}
                  className={cn(
                    'chrome-motion h-9 min-w-9 rounded-full px-3 text-[13px] font-semibold tracking-tight',
                    active
                      ? 'bg-[var(--brand-blue)] text-white'
                      : 'bg-[var(--surface-3)] text-muted-foreground hover:bg-[var(--surface-4)]',
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">Start</span>
              <select
                className={scheduleFieldClass}
                value={config.startMinute}
                onChange={(e) => onSave({ startMinute: Number(e.target.value) })}
              >
                {minuteList.map((item) => (
                  <option key={`start-${item.value}`} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">End</span>
              <select
                className={scheduleFieldClass}
                value={config.endMinute}
                onChange={(e) => onSave({ endMinute: Number(e.target.value) })}
              >
                {minuteList.map((item) => (
                  <option key={`end-${item.value}`} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex justify-end">
            <Button type="button" className={schedulePrimaryBtnClass} onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

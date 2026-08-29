'use client'

import { useEffect, useMemo, useState } from 'react'
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
import { formatSessionDateTime } from '@/components/schedule/slot-form-fields'
import {
  CLASS_DURATION_MAX,
  CLASS_DURATION_MIN,
  CLASS_DURATION_PRESETS,
  isClassDurationPreset,
  normalizeClassDurationMinutes,
} from '@/lib/schedule/class-duration'
import { fmtScheduleMinute, scheduleMinuteOptions } from '@/lib/schedule/schedule-time-labels'
import {
  canMoveClassSessionStatus,
  computePlusMinutesMoveTarget,
  computeTomorrowSameTimeMoveTarget,
  dateFromLocalDateKey,
  isMoveClassUrgent,
  normalizeMoveDuration,
  type MoveClassTarget,
} from '@/lib/schedule/move-class-targets'
import { ensureStudentRecordsHydrated } from '@/lib/local-data/student-records-client'
import { hydrateWeeklyScheduleFromDisk } from '@/lib/local-data/weekly-schedule-disk-client'
import {
  cancelClassOccurrence,
  getTeacherWeeklyScheduleConfig,
  localDateKey,
  moveClassOccurrence,
} from '@/lib/students/selectors'
import type { StudentClassSession } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  scheduleDialogContentClass,
  scheduleDialogDescriptionClass,
  scheduleDialogOverlayClass,
  scheduleDialogTitleClass,
  scheduleFieldClass,
  scheduleGhostBtnClass,
  schedulePrimaryBtnClass,
  scheduleQuietBtnClass,
} from '@/components/schedule/schedule-sheet-chrome'

export interface MoveClassDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  studentId: string
  studentName: string
  session: StudentClassSession | null
  onMoved: () => void
}

export function MoveClassDialog({
  open,
  onOpenChange,
  studentId,
  studentName,
  session,
  onMoved,
}: MoveClassDialogProps) {
  const [mode, setMode] = useState<'chips' | 'pick'>('chips')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pickDateKey, setPickDateKey] = useState('')
  const [pickStartMinute, setPickStartMinute] = useState(9 * 60)
  const [pickDuration, setPickDuration] = useState(30)
  const [otherMode, setOtherMode] = useState(false)
  const [otherDraft, setOtherDraft] = useState('30')

  const config = useMemo(() => getTeacherWeeklyScheduleConfig(), [open])
  const minuteOptions = useMemo(
    () => scheduleMinuteOptions(config.startMinute, config.endMinute),
    [config.endMinute, config.startMinute],
  )

  const urgent = session
    ? isMoveClassUrgent(session.scheduledFor, Date.now(), undefined, session.status)
    : false
  const isLive = session?.status === 'in_progress'
  const isMissed = session?.status === 'missed'

  useEffect(() => {
    if (!open || !session) return
    setMode('chips')
    setError(null)
    setBusy(false)
    const start = new Date(session.scheduledFor)
    const day = Number.isFinite(start.getTime()) ? start : new Date()
    setPickDateKey(localDateKey(day))
    setPickStartMinute(
      Number.isFinite(start.getTime())
        ? Math.floor((start.getHours() * 60 + start.getMinutes()) / 30) * 30
        : config.startMinute,
    )
    const duration = normalizeMoveDuration(session.durationMin)
    setPickDuration(duration)
    setOtherMode(!isClassDurationPreset(duration))
    setOtherDraft(String(duration))
  }, [open, session, config.startMinute])

  if (!session) return null

  const canMove = canMoveClassSessionStatus(session.status)

  async function applyTarget(target: MoveClassTarget) {
    if (!session || !canMove) return
    setBusy(true)
    setError(null)
    try {
      await ensureStudentRecordsHydrated()
      await hydrateWeeklyScheduleFromDisk()
      const result = moveClassOccurrence(
        studentId,
        session.id,
        target.targetDay,
        target.startMinute,
        target.durationMinutes,
      )
      if (!result.ok) {
        setError(result.error)
        toast.error(result.error)
        return
      }
      toast.success(
        isLive
          ? `Live ended · moved to ${formatSessionDateTime(result.scheduledFor)}`
          : `Moved to ${formatSessionDateTime(result.scheduledFor)}`,
      )
      onMoved()
      onOpenChange(false)
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Could not move class.'
      const msg =
        /exceeded the quota|QuotaExceeded|storage is full/i.test(raw)
          ? 'Browser storage is full. Download a backup in Settings, free some space, then try again.'
          : raw
      setError(msg)
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  function handlePlus30() {
    if (!session) return
    const computed = computePlusMinutesMoveTarget({
      scheduledForIso: session.scheduledFor,
      durationMin: session.durationMin,
    })
    if (!computed.ok) {
      setError(computed.error)
      toast.error(computed.error)
      return
    }
    void applyTarget(computed.target)
  }

  function handleTomorrow() {
    if (!session) return
    const computed = computeTomorrowSameTimeMoveTarget({
      scheduledForIso: session.scheduledFor,
      durationMin: session.durationMin,
    })
    if (!computed.ok) {
      setError(computed.error)
      toast.error(computed.error)
      return
    }
    void applyTarget(computed.target)
  }

  function handleConfirmPick() {
    const day = dateFromLocalDateKey(pickDateKey)
    if (!day) {
      setError('Pick a valid date.')
      return
    }
    void applyTarget({
      targetDay: day,
      startMinute: pickStartMinute,
      durationMinutes: pickDuration,
    })
  }

  async function handleCancelInstead() {
    if (!session || busy) return
    const ok = window.confirm(
      `Cancel this class for ${studentName}? It won’t happen. Prep and board stay; this slot won’t count as taught.`,
    )
    if (!ok) return
    setBusy(true)
    setError(null)
    try {
      await ensureStudentRecordsHydrated()
      const result = cancelClassOccurrence(studentId, session.id)
      if (!result.ok) {
        setError(result.error)
        toast.error(result.error)
        return
      }
      toast.success('Class cancelled')
      onOpenChange(false)
      onMoved()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not cancel class.'
      setError(msg)
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName={scheduleDialogOverlayClass}
        className={scheduleDialogContentClass}
      >
        <DialogHeader>
          <DialogTitle className={scheduleDialogTitleClass}>
            {isMissed ? 'Reschedule' : isLive ? 'Move instead' : 'Move class'}
          </DialogTitle>
          <DialogDescription className={scheduleDialogDescriptionClass}>
            {studentName} · {formatSessionDateTime(session.scheduledFor)} · {session.durationMin}{' '}
            min
          </DialogDescription>
        </DialogHeader>

        <p className="text-[13px] text-muted-foreground">
          Moves <span className="font-medium text-foreground">this class only</span>. The weekly
          time stays the same unless you change it on the schedule.
          {isLive ? (
            <>
              {' '}
              This ends the live session <span className="font-medium text-foreground">without</span>{' '}
              marking it completed — no bookmark is written.
            </>
          ) : null}
          {isMissed ? (
            <>
              {' '}
              The class returns to planned at the new time (not left as missed).
            </>
          ) : null}
        </p>

        {!canMove ? (
          <p className="text-[13px] text-[var(--brand-red)]">This class cannot be moved.</p>
        ) : null}

        {mode === 'chips' && canMove ? (
          <div className={cn('flex flex-col gap-2', urgent && 'gap-3')}>
            <Button
              type="button"
              className={schedulePrimaryBtnClass}
              disabled={busy}
              onClick={handlePlus30}
            >
              +30 min
            </Button>
            <Button
              type="button"
              variant="secondary"
              className={scheduleQuietBtnClass}
              disabled={busy}
              onClick={handleTomorrow}
            >
              Tomorrow same time
            </Button>
            <Button
              type="button"
              variant="ghost"
              className={scheduleGhostBtnClass}
              disabled={busy}
              onClick={() => setMode('pick')}
            >
              Pick date & time
            </Button>
          </div>
        ) : null}

        {mode === 'pick' && canMove ? (
          <div className="space-y-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Date</span>
              <input
                type="date"
                className={scheduleFieldClass}
                value={pickDateKey}
                onChange={(e) => setPickDateKey(e.target.value)}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Time</span>
                <select
                  className={scheduleFieldClass}
                  value={pickStartMinute}
                  onChange={(e) => setPickStartMinute(Number(e.target.value))}
                >
                  {minuteOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Length</span>
                <select
                  className={scheduleFieldClass}
                  value={otherMode ? 'other' : String(pickDuration)}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v === 'other') {
                      setOtherMode(true)
                      setOtherDraft(String(pickDuration))
                      return
                    }
                    setOtherMode(false)
                    setPickDuration(normalizeClassDurationMinutes(Number(v), 30))
                  }}
                >
                  {CLASS_DURATION_PRESETS.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes} min
                    </option>
                  ))}
                  <option value="other">Other…</option>
                </select>
              </label>
              {otherMode ? (
                <label className="space-y-1 sm:col-span-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Minutes ({CLASS_DURATION_MIN}–{CLASS_DURATION_MAX})
                  </span>
                  <input
                    type="number"
                    min={CLASS_DURATION_MIN}
                    max={CLASS_DURATION_MAX}
                    step={1}
                    className={scheduleFieldClass}
                    value={otherDraft}
                    onChange={(e) => {
                      setOtherDraft(e.target.value)
                      const n = Number(e.target.value)
                      if (Number.isFinite(n)) {
                        setPickDuration(normalizeClassDurationMinutes(n, 30))
                      }
                    }}
                    onBlur={() => {
                      const next = normalizeClassDurationMinutes(otherDraft, pickDuration)
                      setOtherDraft(String(next))
                      setPickDuration(next)
                    }}
                  />
                </label>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              {pickDateKey
                ? `${pickDateKey} · ${fmtScheduleMinute(pickStartMinute)} · ${pickDuration} min`
                : null}
            </p>
          </div>
        ) : null}

        {error ? <p className="text-[13px] text-[var(--brand-red)]">{error}</p> : null}

        {isLive ? (
          <div className="pt-1">
            <button
              type="button"
              className="text-[12px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
              disabled={busy}
              onClick={() => void handleCancelInstead()}
            >
              Cancel this class instead
            </button>
          </div>
        ) : null}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          {mode === 'pick' && canMove ? (
            <>
              <Button
                type="button"
                variant="ghost"
                className={scheduleGhostBtnClass}
                disabled={busy}
                onClick={() => setMode('chips')}
              >
                Back
              </Button>
              <Button
                type="button"
                className={schedulePrimaryBtnClass}
                disabled={busy}
                onClick={handleConfirmPick}
              >
                {busy ? 'Moving…' : 'Confirm move'}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="ghost"
              className={scheduleGhostBtnClass}
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

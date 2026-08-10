'use client'

import { Pause, Play, RotateCcw } from 'lucide-react'
import {
  ClassToolboxCountdownDigitPicker,
  ClassToolboxCountdownFinishedBanner,
} from '@/components/students/class-toolbox/ClassToolboxCountdownDigitPicker'
import type { CountdownDigitIndex, CountdownStatus } from '@/lib/class-toolbox/countdown'
import { cn } from '@/lib/utils'

/** In-dock activity timer — MM:SS digits + icon start / pause / reset. */
export function ClassToolboxCountdownDock({
  durationSec,
  remainingMs,
  status,
  onAdjustDigit,
  onStart,
  onPause,
  onReset,
  finishedAlertActive = false,
}: {
  durationSec: number
  remainingMs: number
  status: CountdownStatus
  onAdjustDigit: (index: CountdownDigitIndex, delta: 1 | -1) => void
  onStart: () => void
  onPause: () => void
  onReset: () => void
  finishedAlertActive?: boolean
}) {
  const finished = status === 'finished'
  const running = status === 'running'
  const editable = !running && !finished

  const displaySec =
    status === 'idle' || finished
      ? durationSec
      : Math.max(0, Math.ceil(remainingMs / 1000))

  const startDisabled = displaySec <= 0 && !finished
  const startLabel = finished ? 'Start again' : status === 'paused' ? 'Resume' : 'Start'

  return (
    <div className="flex flex-col gap-4 px-0.5 py-0.5">
      {finished ? (
        <ClassToolboxCountdownFinishedBanner alert={finishedAlertActive} />
      ) : (
        <ClassToolboxCountdownDigitPicker
          totalSec={displaySec}
          editable={editable}
          onAdjust={onAdjustDigit}
        />
      )}

      <div className="flex gap-2">
        {running ? (
          <button
            type="button"
            onClick={onPause}
            title="Pause"
            aria-label="Pause timer"
            className={cn(
              'flex flex-1 items-center justify-center rounded-xl bg-emerald-500 py-3 text-white',
              'hover:bg-emerald-400',
            )}
          >
            <Pause size={22} strokeWidth={2.5} aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            onClick={onStart}
            disabled={startDisabled}
            title={startLabel}
            aria-label={startLabel}
            className={cn(
              'flex flex-1 items-center justify-center rounded-xl bg-emerald-500 py-3 text-white',
              'hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            <Play size={22} strokeWidth={2.5} className="ml-0.5" aria-hidden />
          </button>
        )}
        <button
          type="button"
          onClick={onReset}
          title="Reset"
          aria-label="Reset timer"
          className={cn(
            'flex flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/10 py-3 text-white',
            'hover:bg-white/15',
          )}
        >
          <RotateCcw size={20} strokeWidth={2.25} aria-hidden />
        </button>
      </div>
    </div>
  )
}

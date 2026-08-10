'use client'

import { Pause, Play, RotateCcw } from 'lucide-react'
import { secToDigits } from '@/lib/class-toolbox/countdown'
import {
  stopwatchMsToSec,
  type StopwatchStatus,
} from '@/lib/class-toolbox/stopwatch'
import { cn } from '@/lib/utils'

/** Read-only flip-clock MM:SS — same digit boxes as the timer, no steppers. */
function StopwatchDigitDisplay({ totalSec }: { totalSec: number }) {
  const digits = secToDigits(totalSec)

  return (
    <div
      className="class-toolbox-countdown-picker"
      role="timer"
      aria-label="Stopwatch elapsed"
      aria-live="polite"
    >
      {digits.map((digit, index) => (
        <span key={index} className="contents">
          {index === 2 ? (
            <span className="class-toolbox-countdown-colon" aria-hidden>
              :
            </span>
          ) : null}
          <div className="class-toolbox-countdown-digit" aria-hidden>
            {digit}
          </div>
        </span>
      ))}
    </div>
  )
}

/** In-dock activity stopwatch — counts up; play / pause / reset icons. */
export function ClassToolboxStopwatchDock({
  elapsedMs,
  status,
  onStart,
  onPause,
  onReset,
}: {
  elapsedMs: number
  status: StopwatchStatus
  onStart: () => void
  onPause: () => void
  onReset: () => void
}) {
  const running = status === 'running'
  const startLabel = status === 'paused' ? 'Resume' : 'Start'

  return (
    <div className="flex flex-col gap-4 px-0.5 py-0.5">
      <StopwatchDigitDisplay totalSec={stopwatchMsToSec(elapsedMs)} />

      <div className="flex gap-2">
        {running ? (
          <button
            type="button"
            onClick={onPause}
            title="Pause"
            aria-label="Pause stopwatch"
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
            title={startLabel}
            aria-label={startLabel}
            className={cn(
              'flex flex-1 items-center justify-center rounded-xl bg-emerald-500 py-3 text-white',
              'hover:bg-emerald-400',
            )}
          >
            <Play size={22} strokeWidth={2.5} className="ml-0.5" aria-hidden />
          </button>
        )}
        <button
          type="button"
          onClick={onReset}
          title="Reset"
          aria-label="Reset stopwatch"
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

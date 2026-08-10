'use client'

import { ChevronDown, ChevronUp } from 'lucide-react'
import {
  secToDigits,
  type CountdownDigitIndex,
  type CountdownDigits,
} from '@/lib/class-toolbox/countdown'
import { cn } from '@/lib/utils'

function DigitColumn({
  value,
  index,
  editable,
  onAdjust,
}: {
  value: number
  index: CountdownDigitIndex
  editable: boolean
  onAdjust: (index: CountdownDigitIndex, delta: 1 | -1) => void
}) {
  return (
    <div className="class-toolbox-countdown-digit-col">
      <button
        type="button"
        disabled={!editable}
        onClick={() => onAdjust(index, 1)}
        className="class-toolbox-countdown-digit-arrow"
        aria-label={`Increase digit ${index + 1}`}
      >
        <ChevronUp size={16} strokeWidth={2.5} aria-hidden />
      </button>
      <div className="class-toolbox-countdown-digit" aria-hidden>
        {value}
      </div>
      <button
        type="button"
        disabled={!editable}
        onClick={() => onAdjust(index, -1)}
        className="class-toolbox-countdown-digit-arrow"
        aria-label={`Decrease digit ${index + 1}`}
      >
        <ChevronDown size={16} strokeWidth={2.5} aria-hidden />
      </button>
    </div>
  )
}

/** Flip-clock MM:SS stepper — four digits with up/down arrows. */
export function ClassToolboxCountdownDigitPicker({
  totalSec,
  editable,
  onAdjust,
}: {
  totalSec: number
  editable: boolean
  onAdjust: (index: CountdownDigitIndex, delta: 1 | -1) => void
}) {
  const digits: CountdownDigits = secToDigits(totalSec)

  return (
    <div
      className="class-toolbox-countdown-picker"
      role="group"
      aria-label="Timer duration"
      aria-live="polite"
    >
      {digits.map((digit, index) => (
        <span key={index} className="contents">
          {index === 2 ? (
            <span className="class-toolbox-countdown-colon" aria-hidden>
              :
            </span>
          ) : null}
          <DigitColumn
            value={digit}
            index={index as CountdownDigitIndex}
            editable={editable}
            onAdjust={onAdjust}
          />
        </span>
      ))}
    </div>
  )
}

/** Banner when timer reaches zero. Blinks only while `alert` is true (during chime). */
export function ClassToolboxCountdownFinishedBanner({
  alert = false,
  className,
}: {
  alert?: boolean
  className?: string
}) {
  return (
    <p
      className={cn(
        'class-toolbox-countdown-finished text-center text-2xl font-bold',
        alert && 'class-toolbox-countdown-finished--alert',
        className,
      )}
      aria-live="polite"
    >
      Time&apos;s up!
    </p>
  )
}

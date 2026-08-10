'use client'

import { coinSideLabel, type CoinSide } from '@/lib/class-toolbox/coin-flip'
import { cn } from '@/lib/utils'

/** Compact dock controls — Flip + result text only (spectacle lives on the stage). */
export function ClassToolboxCoinDock({
  side,
  flipping,
  onFlip,
}: {
  side: CoinSide | null
  flipping: boolean
  onFlip: () => void
}) {
  const label = coinSideLabel(side, flipping)

  return (
    <div className="flex flex-col gap-3 px-0.5 py-0.5">
      <p
        className={cn(
          'min-h-[2rem] text-center text-3xl font-bold tracking-wide',
          side === null && !flipping ? 'text-white/40' : 'text-white',
        )}
        aria-live="polite"
      >
        {label}
      </p>
      <button
        type="button"
        onClick={onFlip}
        disabled={flipping}
        className={cn(
          'rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white',
          'hover:bg-white/15 disabled:cursor-wait disabled:opacity-50',
        )}
      >
        {side === null && !flipping ? 'Flip' : 'Flip again'}
      </button>
    </div>
  )
}

'use client'

import Image from 'next/image'

export type CoverRewardPillVariant = 'default' | 'emphasis' | 'muted'

interface CoverRewardPillProps {
  amount: number
  variant?: CoverRewardPillVariant
  className?: string
}

/** Coins + golden +N in the top-right of a challenge cover. Hidden when amount is 0. */
export function CoverRewardPill({ amount, variant = 'default', className = '' }: CoverRewardPillProps) {
  if (amount <= 0) return null

  const isEmphasis = variant === 'emphasis'
  const isMuted = variant === 'muted'
  const imgSize = isEmphasis ? 24 : 20
  const textClass = isEmphasis ? 'text-sm' : 'text-xs'

  return (
    <div
      className={[
        'pointer-events-none absolute right-2 top-2 z-10 flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-1)]/85 px-2 py-0.5 backdrop-blur-sm',
        isMuted && 'opacity-90',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={`Reward ${amount} coins`}
    >
      <Image
        src="/coins.png"
        alt=""
        width={imgSize}
        height={imgSize}
        className={[isEmphasis ? 'h-6 w-6' : 'h-5 w-5', 'shrink-0 object-contain'].join(' ')}
        aria-hidden
      />
      <span className={`font-bold tabular-nums text-[var(--brand-yellow)] ${textClass}`}>+{amount}</span>
    </div>
  )
}

'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { CoinSide } from '@/lib/class-toolbox/coin-flip'
import { CLASS_TOOLBOX_COIN_FLIP_MS } from '@/lib/class-toolbox/coin-flip'
import { cn } from '@/lib/utils'

const COIN_HEADS_SRC = '/class-toolbox/coin-heads.png'
const COIN_TAILS_SRC = '/class-toolbox/coin-tails.png'

/** Extra full turns during a flip. */
const SPIN_TURNS = 3

function faceDegrees(side: CoinSide): number {
  return side === 'tails' ? 180 : 0
}

function nextSpinTarget(from: number, pending: CoinSide): number {
  const targetFace = faceDegrees(pending)
  let to = from + SPIN_TURNS * 360
  const remainder = ((to % 360) + 360) % 360
  to += (targetFace - remainder + 360) % 360
  return to
}

function CoinFace({
  src,
  alt,
  className,
}: {
  src: string
  alt: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'class-toolbox-coin-face absolute inset-0 overflow-hidden rounded-full',
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- stage prop; not layout LCP */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        decoding="async"
        className="pointer-events-none h-full w-full select-none object-cover"
      />
    </div>
  )
}

/**
 * Large two-face cartoon coin for the over-book stage.
 * Hop and spin are separate layers. Shadow stays off the 3D coin node so
 * preserve-3d / backface still works (filter would flatten faces → always heads).
 */
export function ClassToolboxCoinStage({
  side,
  pendingSide,
  flipping,
}: {
  side: CoinSide | null
  pendingSide: CoinSide | null
  flipping: boolean
}) {
  const angleRef = useRef(0)
  const [spin, setSpin] = useState<{ key: number; from: number; to: number } | null>(
    null,
  )
  const prevFlipping = useRef(false)

  useEffect(() => {
    const started = flipping && !prevFlipping.current
    prevFlipping.current = flipping
    if (!started || !pendingSide) return

    const from = angleRef.current
    const to = nextSpinTarget(from, pendingSide)
    angleRef.current = to
    setSpin((prev) => ({ key: (prev?.key ?? 0) + 1, from, to }))
  }, [flipping, pendingSide])

  if (!flipping && side === null) return null

  const settledDeg = side != null ? faceDegrees(side) : faceDegrees('heads')
  const isSpinning = flipping && spin != null

  const spinStyle = isSpinning
    ? ({
        animationDuration: `${CLASS_TOOLBOX_COIN_FLIP_MS}ms`,
        '--coin-spin-from': `${spin.from}deg`,
        '--coin-spin-to': `${spin.to}deg`,
      } as CSSProperties)
    : {
        // Normalize to 0 / 180 so the correct face is always visible after land
        transform: `rotateY(${settledDeg}deg)`,
      }

  return (
    <div className="class-toolbox-coin-scene" aria-hidden>
      <div
        className={cn(
          'class-toolbox-coin-hop',
          isSpinning && 'class-toolbox-coin-hop--active',
        )}
        style={
          isSpinning
            ? { animationDuration: `${CLASS_TOOLBOX_COIN_FLIP_MS}ms` }
            : undefined
        }
        key={spin ? `hop-${spin.key}` : 'hop-idle'}
      >
        <div
          className={cn(
            'class-toolbox-coin relative h-52 w-52',
            isSpinning && 'class-toolbox-coin--spinning',
          )}
          style={spinStyle}
          key={spin ? `spin-${spin.key}` : `settle-${side ?? 'none'}`}
        >
          <CoinFace
            src={COIN_HEADS_SRC}
            alt="Heads"
            className="class-toolbox-coin-face--front"
          />
          <CoinFace
            src={COIN_TAILS_SRC}
            alt="Tails"
            className="class-toolbox-coin-face--back"
          />
        </div>
      </div>
    </div>
  )
}

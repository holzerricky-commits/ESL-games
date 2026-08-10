'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Lock, X } from 'lucide-react'
import {
  CLASS_TOOLBOX_DICE_ROLL_MS,
  diceRollMotionStyle,
  type DiceRollMotion,
  type DiceRollMotions,
  type ToolboxDie,
} from '@/lib/class-toolbox/dice-roll'
import { diceFaceSrc } from '@/lib/class-toolbox/dice-art'
import { cn } from '@/lib/utils'

function clampDisplayValue(sides: ToolboxDie['sides'], value: number): number {
  return Math.max(1, Math.min(sides, value))
}

function SingleDieVisual({
  die,
  holdValue,
  resultValue,
  revealed,
  rolling,
  compact,
  parked,
  motion,
}: {
  die: ToolboxDie
  holdValue: number
  resultValue: number
  revealed: boolean
  rolling: boolean
  compact: boolean
  parked: boolean
  motion: DiceRollMotion | null
}) {
  const isTumbling = rolling && !die.locked && motion != null
  const motionStyle: CSSProperties | undefined = isTumbling
    ? (diceRollMotionStyle(motion) as CSSProperties)
    : rolling && !die.locked
      ? { animationDuration: `${CLASS_TOOLBOX_DICE_ROLL_MS}ms` }
      : undefined

  const settled = !rolling || die.locked
  const showResult = settled || revealed

  return (
    <div
      className={cn(
        'class-toolbox-dice',
        !parked && `class-toolbox-dice--d${die.sides}`,
        !parked && compact && 'class-toolbox-dice--compact',
        parked && 'class-toolbox-dice--parked',
        die.locked && 'class-toolbox-dice--locked',
        isTumbling && 'class-toolbox-dice--rolling',
        isTumbling && !revealed && 'class-toolbox-dice--spinning-face',
      )}
      style={motionStyle}
    >
      <span className="relative block h-full w-full">
        {/* eslint-disable-next-line @next/next/no-img-element -- stage prop */}
        <img
          src={diceFaceSrc(die.sides, holdValue)}
          alt=""
          draggable={false}
          decoding="async"
          className={cn(
            'pointer-events-none absolute inset-0 h-full w-full select-none object-contain',
            'transition-opacity duration-200 ease-out',
            showResult && holdValue !== resultValue ? 'opacity-0' : 'opacity-100',
          )}
        />
        {/* eslint-disable-next-line @next/next/no-img-element -- stage prop */}
        <img
          src={diceFaceSrc(die.sides, resultValue)}
          alt=""
          draggable={false}
          decoding="async"
          className={cn(
            'pointer-events-none absolute inset-0 h-full w-full select-none object-contain',
            'transition-opacity duration-200 ease-out',
            showResult ? 'opacity-100' : 'opacity-0',
          )}
        />
      </span>
      {die.locked ? (
        <span className="class-toolbox-dice-lock-badge" aria-hidden>
          <Lock size={parked ? 10 : 14} strokeWidth={2.5} />
        </span>
      ) : null}
    </div>
  )
}

/**
 * Multi-die stage over the book.
 * Tap a die to lock/unlock (keeps that number on the next Roll).
 * Small X removes the die. Parked mode shrinks results to the corner.
 */
export function ClassToolboxDiceStage({
  dice,
  pendingValues,
  motions,
  rolling,
  parked,
  onToggleLock,
  onRemoveDie,
}: {
  dice: ToolboxDie[]
  pendingValues: Record<string, number> | null
  motions: DiceRollMotions | null
  rolling: boolean
  parked: boolean
  onToggleLock: (id: string) => void
  onRemoveDie: (id: string) => void
}) {
  const [revealedIds, setRevealedIds] = useState<ReadonlySet<string>>(() => new Set())
  const [holdFaces, setHoldFaces] = useState<Record<string, number>>({})

  const compact = !parked && dice.length > 3

  useEffect(() => {
    if (!rolling) {
      setRevealedIds(new Set())
      return
    }
    const bag = dice
    const motionMap = motions
    const holds: Record<string, number> = {}
    for (const die of bag) {
      holds[die.id] = clampDisplayValue(die.sides, die.value ?? 1)
    }
    setHoldFaces(holds)
    setRevealedIds(new Set())

    const tumbling = bag.filter((die) => !die.locked)
    if (tumbling.length === 0) return

    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = now - start
      const next = new Set<string>()
      let allDone = true
      for (const die of tumbling) {
        const revealAt = motionMap?.[die.id]?.revealAtMs ?? CLASS_TOOLBOX_DICE_ROLL_MS * 0.8
        if (t >= revealAt) {
          next.add(die.id)
        } else {
          allDone = false
        }
      }
      setRevealedIds((prev) => {
        if (prev.size === next.size && [...next].every((id) => prev.has(id))) return prev
        return next
      })
      if (allDone) return
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bag frozen for this roll
  }, [rolling, pendingValues, motions])

  const facesById = useMemo(() => {
    const map: Record<string, { hold: number; result: number; revealed: boolean }> = {}
    for (const die of dice) {
      const hold = clampDisplayValue(die.sides, holdFaces[die.id] ?? die.value ?? 1)
      const result = clampDisplayValue(
        die.sides,
        pendingValues?.[die.id] ?? die.value ?? hold,
      )
      map[die.id] = {
        hold,
        result,
        revealed: die.locked || !rolling || revealedIds.has(die.id),
      }
    }
    return map
  }, [dice, rolling, holdFaces, pendingValues, revealedIds])

  if (dice.length === 0) return null

  return (
    <div
      className={cn(
        'class-toolbox-dice-scene',
        parked ? 'class-toolbox-dice-scene--parked' : 'class-toolbox-dice-scene--multi',
        !parked && compact && 'class-toolbox-dice-scene--compact',
      )}
    >
      {parked ? (
        <p className="class-toolbox-dice-parked-label" aria-hidden>
          Rolled
        </p>
      ) : null}
      {dice.map((die) => {
        const faces = facesById[die.id]
        const canLock = die.value != null || die.locked
        const lockTitle = die.locked
          ? `Unlock d${die.sides}`
          : canLock
            ? `Lock d${die.sides} (keep this number)`
            : `Roll first to lock`
        return (
          <div key={die.id} className="class-toolbox-dice-stage-slot">
            <button
              type="button"
              disabled={rolling || !canLock}
              onClick={() => onToggleLock(die.id)}
              className={cn(
                'class-toolbox-dice-stage-item',
                rolling && 'class-toolbox-dice-stage-item--rolling',
                die.locked && 'class-toolbox-dice-stage-item--locked',
              )}
              title={rolling ? undefined : lockTitle}
              aria-label={lockTitle}
              aria-pressed={die.locked}
            >
              <SingleDieVisual
                die={die}
                holdValue={faces?.hold ?? 1}
                resultValue={faces?.result ?? 1}
                revealed={faces?.revealed ?? true}
                rolling={rolling}
                compact={compact}
                parked={parked}
                motion={motions?.[die.id] ?? null}
              />
            </button>
            {!rolling ? (
              <button
                type="button"
                className="class-toolbox-dice-remove"
                onClick={() => onRemoveDie(die.id)}
                title={`Remove d${die.sides}`}
                aria-label={`Remove d${die.sides}`}
              >
                <X size={parked ? 10 : 12} strokeWidth={2.5} aria-hidden />
              </button>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

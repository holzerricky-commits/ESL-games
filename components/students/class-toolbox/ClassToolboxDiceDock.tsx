'use client'

import {
  CLASS_TOOLBOX_DICE_MAX,
  CLASS_TOOLBOX_DICE_SIDES,
  formatDiceTotal,
  formatDiceValuesList,
  isDiceSidesReady,
  type DiceSides,
  type ToolboxDie,
} from '@/lib/class-toolbox/dice-roll'
import { diceFaceSrc } from '@/lib/class-toolbox/dice-art'
import { cn } from '@/lib/utils'

const DOCK_ICON_PX = 36

/**
 * Small bottom-right dock: total, one row of dice, Roll below.
 * Remove dice by tapping them on the stage.
 * Only d4 / d6 / d8 (PNG art) can be added; others show as coming soon.
 */
export function ClassToolboxDiceDock({
  dice,
  rolling,
  parked,
  atMax,
  onAddDie,
  onRoll,
  onPark,
  onUnpark,
}: {
  dice: ToolboxDie[]
  rolling: boolean
  parked: boolean
  atMax: boolean
  onAddDie: (sides: DiceSides) => void
  onRoll: () => void
  onPark: () => void
  onUnpark: () => void
}) {
  const total = formatDiceTotal(dice, rolling)
  const valuesLine = formatDiceValuesList(dice, rolling)
  const hasRolled = dice.some((die) => die.value != null)
  const canPark = hasRolled && !rolling && !parked
  const hasUnlocked = dice.some((die) => !die.locked)
  const canRoll = !rolling && dice.length > 0 && hasUnlocked

  return (
    <div className="flex flex-col gap-3">
      <div className="min-w-0 text-center">
        <div className="flex items-baseline justify-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wide text-white/45">
            Total
          </span>
          <span
            className={cn(
              'text-2xl font-bold tabular-nums leading-none tracking-wide',
              total === '—' || total === '…' ? 'text-white/40' : 'text-white',
            )}
            aria-live="polite"
          >
            {total}
          </span>
          <span className="text-[10px] tabular-nums text-white/40">
            {dice.length}/{CLASS_TOOLBOX_DICE_MAX}
          </span>
        </div>
        <p className="mt-1 truncate text-xs tabular-nums text-white/50">{valuesLine}</p>
      </div>

      <div className="flex items-end justify-center gap-3 px-0.5">
        {CLASS_TOOLBOX_DICE_SIDES.map((sides) => {
          const ready = isDiceSidesReady(sides)
          const disabled = !ready || rolling || atMax
          const title = !ready
            ? `d${sides} — coming soon`
            : atMax
              ? 'Maximum dice reached'
              : `Add d${sides}`

          return (
            <button
              key={sides}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (!ready) return
                onAddDie(sides)
              }}
              className={cn(
                'flex w-11 shrink-0 flex-col items-center gap-1.5 rounded-lg bg-transparent py-1',
                ready
                  ? 'transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-35'
                  : 'cursor-not-allowed opacity-30 grayscale',
              )}
              title={title}
              aria-label={title}
              aria-disabled={!ready}
            >
              <span
                className="flex items-center justify-center"
                style={{ width: DOCK_ICON_PX, height: DOCK_ICON_PX }}
              >
                {ready ? (
                  // eslint-disable-next-line @next/next/no-img-element -- dock picker art
                  <img
                    src={diceFaceSrc(sides, 1)}
                    alt=""
                    draggable={false}
                    decoding="async"
                    className="pointer-events-none h-full w-full select-none object-contain"
                  />
                ) : (
                  <span
                    className="block h-full w-full rounded-md bg-white/10"
                    aria-hidden
                  />
                )}
              </span>
              <span
                className={cn(
                  'text-[10px] font-semibold tabular-nums leading-none',
                  ready ? 'text-white/55' : 'text-white/35',
                )}
              >
                {ready ? sides : 'Soon'}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onRoll}
          disabled={!canRoll}
          title={
            !hasUnlocked && dice.length > 0
              ? 'Unlock at least one die to roll'
              : undefined
          }
          className={cn(
            'w-full rounded-xl border border-white/15 bg-sky-500/90 py-2.5 text-sm font-semibold text-white',
            'hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          {!hasRolled && !rolling ? 'Roll' : 'Roll again'}
        </button>
        {parked ? (
          <button
            type="button"
            onClick={onUnpark}
            disabled={rolling}
            className={cn(
              'w-full rounded-xl border border-white/15 bg-white/10 py-2 text-sm font-medium text-white/90',
              'hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40',
            )}
          >
            Show large
          </button>
        ) : (
          <button
            type="button"
            onClick={onPark}
            disabled={!canPark}
            title={
              canPark
                ? 'Move results to the corner so you can keep teaching'
                : 'Roll first, then park the results'
            }
            className={cn(
              'w-full rounded-xl border border-white/15 bg-white/10 py-2 text-sm font-medium text-white/90',
              'hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40',
            )}
          >
            Park in corner
          </button>
        )}
      </div>
    </div>
  )
}

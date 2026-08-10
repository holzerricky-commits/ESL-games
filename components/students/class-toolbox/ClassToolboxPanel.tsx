'use client'

import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { ClassToolboxCoinDock } from '@/components/students/class-toolbox/ClassToolboxCoinDock'
import { ClassToolboxCountdownDock } from '@/components/students/class-toolbox/ClassToolboxCountdownDock'
import { ClassToolboxDiceDock } from '@/components/students/class-toolbox/ClassToolboxDiceDock'
import { ClassToolboxStopwatchDock } from '@/components/students/class-toolbox/ClassToolboxStopwatchDock'
import { useClassToolboxPanelDrag } from '@/components/students/class-toolbox/useClassToolboxPanelDrag'
import {
  getClassToolboxToolMeta,
  type ClassToolboxToolId,
} from '@/lib/class-toolbox/types'
import type { CoinSide } from '@/lib/class-toolbox/coin-flip'
import type { CountdownDigitIndex, CountdownStatus } from '@/lib/class-toolbox/countdown'
import type { DiceSides, ToolboxDie } from '@/lib/class-toolbox/dice-roll'
import type { StopwatchStatus } from '@/lib/class-toolbox/stopwatch'
import { cn } from '@/lib/utils'

const BOTTOM_RIGHT_DOCK = new Set<ClassToolboxToolId>(['coin', 'dice', 'countdown', 'stopwatch'])

/**
 * Floating dock. Coin, dice, and timers sit bottom-right; others stay centered.
 * Drag the title bar to move; spot is remembered for this session.
 */
export function ClassToolboxPanel({
  toolId,
  onClose,
  mounted,
  coinSide = null,
  coinFlipping = false,
  onCoinFlip,
  dice = [],
  diceRolling = false,
  diceParked = false,
  diceAtMax = false,
  onDiceAdd,
  onDiceRoll,
  onDicePark,
  onDiceUnpark,
  countdownDurationSec = 60,
  countdownRemainingMs = 60_000,
  countdownStatus = 'idle',
  countdownFinishedAlertActive = false,
  onCountdownAdjustDigit,
  onCountdownStart,
  onCountdownPause,
  onCountdownReset,
  stopwatchElapsedMs = 0,
  stopwatchStatus = 'idle',
  onStopwatchStart,
  onStopwatchPause,
  onStopwatchReset,
}: {
  toolId: ClassToolboxToolId | null
  onClose: () => void
  mounted: boolean
  coinSide?: CoinSide | null
  coinFlipping?: boolean
  onCoinFlip?: () => void
  dice?: ToolboxDie[]
  diceRolling?: boolean
  diceParked?: boolean
  diceAtMax?: boolean
  onDiceAdd?: (sides: DiceSides) => void
  onDiceRemove?: (id: string) => void
  onDiceRoll?: () => void
  onDicePark?: () => void
  onDiceUnpark?: () => void
  countdownDurationSec?: number
  countdownRemainingMs?: number
  countdownStatus?: CountdownStatus
  countdownFinishedAlertActive?: boolean
  onCountdownAdjustDigit?: (index: CountdownDigitIndex, delta: 1 | -1) => void
  onCountdownStart?: () => void
  onCountdownPause?: () => void
  onCountdownReset?: () => void
  stopwatchElapsedMs?: number
  stopwatchStatus?: StopwatchStatus
  onStopwatchStart?: () => void
  onStopwatchPause?: () => void
  onStopwatchReset?: () => void
}) {
  const open = Boolean(mounted && toolId)
  const {
    panelRef,
    position,
    dragging,
    onHandlePointerDown,
    onPanelPointerMove,
    endDrag,
  } = useClassToolboxPanelDrag(open, toolId)

  if (!mounted || !toolId) return null

  const meta = getClassToolboxToolMeta(toolId)
  const isDice = toolId === 'dice'
  const isTimerTool = toolId === 'countdown' || toolId === 'stopwatch'
  const isBottomRight = BOTTOM_RIGHT_DOCK.has(toolId)

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 z-[710]"
      data-class-toolbox-panel={toolId}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="false"
        aria-label={meta.label}
        className={cn(
          'pointer-events-auto absolute z-10 border border-white/15 bg-[#1c1c20] text-white shadow-2xl',
          dragging && 'touch-none',
          !position && isBottomRight && 'bottom-4 right-4',
          !position && !isBottomRight && 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
          'rounded-2xl',
          isDice
            ? 'w-[min(21rem,calc(100vw-2rem))] px-3.5 py-3'
            : isTimerTool
              ? 'w-[min(24rem,calc(100vw-2rem))] px-4 py-3.5'
              : 'w-[min(17rem,calc(100vw-2rem))] p-3',
        )}
        style={
          position
            ? { left: position.left, top: position.top, right: 'auto', bottom: 'auto' }
            : undefined
        }
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onPointerMove={onPanelPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          className={cn(
            'flex items-center justify-between gap-2 select-none',
            dragging ? 'cursor-grabbing' : 'cursor-grab',
            isDice ? 'mb-1.5' : isTimerTool ? 'mb-3' : 'mb-3 items-start',
          )}
          onPointerDown={onHandlePointerDown}
          title="Drag to move"
        >
          <div>
            <p className="text-sm font-semibold tracking-wide">{meta.label}</p>
            {!isDice && !isTimerTool ? (
              <p className="mt-0.5 text-[11px] text-white/55">{meta.blurb}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            data-toolbox-no-drag
            className="rounded-md p-1.5 text-white/60 hover:bg-white/10 hover:text-white cursor-pointer"
            title="Close"
            aria-label={`Close ${meta.label}`}
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        <div data-toolbox-no-drag>
          {toolId === 'coin' && onCoinFlip ? (
            <ClassToolboxCoinDock side={coinSide} flipping={coinFlipping} onFlip={onCoinFlip} />
          ) : toolId === 'dice' && onDiceAdd && onDiceRoll && onDicePark && onDiceUnpark ? (
            <ClassToolboxDiceDock
              dice={dice}
              rolling={diceRolling}
              parked={diceParked}
              atMax={diceAtMax}
              onAddDie={onDiceAdd}
              onRoll={onDiceRoll}
              onPark={onDicePark}
              onUnpark={onDiceUnpark}
            />
          ) : toolId === 'countdown' &&
            onCountdownAdjustDigit &&
            onCountdownStart &&
            onCountdownPause &&
            onCountdownReset ? (
            <ClassToolboxCountdownDock
              durationSec={countdownDurationSec}
              remainingMs={countdownRemainingMs}
              status={countdownStatus}
              finishedAlertActive={countdownFinishedAlertActive}
              onAdjustDigit={onCountdownAdjustDigit}
              onStart={onCountdownStart}
              onPause={onCountdownPause}
              onReset={onCountdownReset}
            />
          ) : toolId === 'stopwatch' &&
            onStopwatchStart &&
            onStopwatchPause &&
            onStopwatchReset ? (
            <ClassToolboxStopwatchDock
              elapsedMs={stopwatchElapsedMs}
              status={stopwatchStatus}
              onStart={onStopwatchStart}
              onPause={onStopwatchPause}
              onReset={onStopwatchReset}
            />
          ) : (
            <div className="flex min-h-[8.5rem] items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/5 px-4 py-6 text-center">
              <p className="text-xs leading-relaxed text-white/55">
                Tool shell ready. {meta.label} comes in a later step — book stays usable behind this
                panel.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

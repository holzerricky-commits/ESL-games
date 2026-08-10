'use client'

import { useEffect, useLayoutEffect, useState } from 'react'
import { ClassToolboxMenu } from '@/components/students/class-toolbox/ClassToolboxMenu'
import { ClassToolboxPanel } from '@/components/students/class-toolbox/ClassToolboxPanel'
import { ClassToolboxStage } from '@/components/students/class-toolbox/ClassToolboxStage'
import { ClassToolboxCoinStage } from '@/components/students/class-toolbox/ClassToolboxCoinStage'
import { ClassToolboxDiceStage } from '@/components/students/class-toolbox/ClassToolboxDiceStage'
import { useClassToolboxCountdown } from '@/components/students/class-toolbox/useClassToolboxCountdown'
import { useClassToolboxCoin } from '@/components/students/class-toolbox/useClassToolboxCoin'
import { useClassToolboxDice } from '@/components/students/class-toolbox/useClassToolboxDice'
import { useClassToolboxStopwatch } from '@/components/students/class-toolbox/useClassToolboxStopwatch'
import { preloadReadyDicePngArt } from '@/lib/class-toolbox/dice-art'
import type { ClassToolboxToolId } from '@/lib/class-toolbox/types'

/**
 * Owns toolbox menu + dock + stage spectacle for the book overlay.
 * Escape closes the menu first, then the open tool.
 */
export function ClassToolboxHost({
  menuOpen,
  onMenuOpenChange,
  activeTool,
  onActiveToolChange,
}: {
  menuOpen: boolean
  onMenuOpenChange: (open: boolean) => void
  activeTool: ClassToolboxToolId | null
  onActiveToolChange: (tool: ClassToolboxToolId | null) => void
}) {
  const [mounted, setMounted] = useState(false)
  const coinActive = activeTool === 'coin'
  const diceActive = activeTool === 'dice'
  const countdownActive = activeTool === 'countdown'
  const stopwatchActive = activeTool === 'stopwatch'
  const coin = useClassToolboxCoin(coinActive)
  const dice = useClassToolboxDice(diceActive)
  const countdown = useClassToolboxCountdown(countdownActive)
  const stopwatch = useClassToolboxStopwatch(stopwatchActive)

  useLayoutEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!diceActive) return
    preloadReadyDicePngArt()
  }, [diceActive])

  useEffect(() => {
    if (!menuOpen && !activeTool) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      if (menuOpen) {
        onMenuOpenChange(false)
        return
      }
      if (activeTool) onActiveToolChange(null)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [menuOpen, activeTool, onMenuOpenChange, onActiveToolChange])

  const coinStageActive =
    coinActive && (coin.flipping || coin.side != null || coin.blocking)

  const diceStageActive = diceActive && dice.dice.length > 0

  return (
    <>
      <ClassToolboxMenu
        mounted={mounted}
        open={menuOpen}
        onClose={() => onMenuOpenChange(false)}
        onSelectTool={(id) => {
          onMenuOpenChange(false)
          onActiveToolChange(id)
        }}
      />

      <ClassToolboxStage
        mounted={mounted}
        active={coinStageActive}
        blocking={coin.blocking}
      >
        <ClassToolboxCoinStage
          side={coin.side}
          pendingSide={coin.pendingSide}
          flipping={coin.flipping}
        />
      </ClassToolboxStage>

      <ClassToolboxStage
        mounted={mounted}
        active={diceStageActive}
        blocking={dice.blocking}
      >
        <ClassToolboxDiceStage
          dice={dice.dice}
          pendingValues={dice.pendingValues}
          motions={dice.motions}
          rolling={dice.rolling}
          parked={dice.parked}
          onToggleLock={dice.toggleLock}
          onRemoveDie={dice.removeDie}
        />
      </ClassToolboxStage>

      <ClassToolboxPanel
        mounted={mounted}
        toolId={activeTool}
        onClose={() => onActiveToolChange(null)}
        coinSide={coin.side}
        coinFlipping={coin.flipping}
        onCoinFlip={coin.flip}
        dice={dice.dice}
        diceRolling={dice.rolling}
        diceParked={dice.parked}
        diceAtMax={dice.atMax}
        onDiceAdd={dice.addDie}
        onDiceRemove={dice.removeDie}
        onDiceRoll={dice.roll}
        onDicePark={dice.park}
        onDiceUnpark={dice.unpark}
        countdownDurationSec={countdown.durationSec}
        countdownRemainingMs={countdown.remainingMs}
        countdownStatus={countdown.status}
        countdownFinishedAlertActive={countdown.finishedAlertActive}
        onCountdownAdjustDigit={countdown.adjustDigit}
        onCountdownStart={countdown.start}
        onCountdownPause={countdown.pause}
        onCountdownReset={countdown.reset}
        stopwatchElapsedMs={stopwatch.elapsedMs}
        stopwatchStatus={stopwatch.status}
        onStopwatchStart={stopwatch.start}
        onStopwatchPause={stopwatch.pause}
        onStopwatchReset={stopwatch.reset}
      />
    </>
  )
}

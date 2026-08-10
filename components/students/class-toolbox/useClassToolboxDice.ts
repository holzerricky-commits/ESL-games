'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CLASS_TOOLBOX_DICE_MAX,
  CLASS_TOOLBOX_DICE_SETTLE_MS,
  createDefaultDiceBag,
  createDiceRollMotions,
  createToolboxDie,
  isDiceSidesReady,
  maxDiceLandMs,
  maxDiceRevealMs,
  randomDieValue,
  type DiceRollMotions,
  type DiceSides,
  type ToolboxDie,
} from '@/lib/class-toolbox/dice-roll'

export type ClassToolboxDiceState = {
  dice: ToolboxDie[]
  pendingValues: Record<string, number> | null
  motions: DiceRollMotions | null
  rolling: boolean
  blocking: boolean
  parked: boolean
  atMax: boolean
  addDie: (sides: DiceSides) => boolean
  removeDie: (id: string) => void
  toggleLock: (id: string) => void
  roll: () => void
  park: () => void
  unpark: () => void
}

/**
 * Multi-die bag for dock + stage. Auto-rolls once when `active` becomes true.
 * Locked dice keep their face; Roll only tosses unlocked ones.
 */
export function useClassToolboxDice(active: boolean): ClassToolboxDiceState {
  const [dice, setDice] = useState<ToolboxDie[]>(() => createDefaultDiceBag())
  const [pendingValues, setPendingValues] = useState<Record<string, number> | null>(null)
  const [motions, setMotions] = useState<DiceRollMotions | null>(null)
  const [rolling, setRolling] = useState(false)
  const [blocking, setBlocking] = useState(false)
  const [parked, setParked] = useState(false)
  const diceRef = useRef(dice)
  const rollingRef = useRef(false)
  const revealTimerRef = useRef<number | null>(null)
  const rollTimerRef = useRef<number | null>(null)
  const settleTimerRef = useRef<number | null>(null)
  const didAutoRollRef = useRef(false)

  diceRef.current = dice

  const clearTimers = useCallback(() => {
    if (revealTimerRef.current != null) {
      window.clearTimeout(revealTimerRef.current)
      revealTimerRef.current = null
    }
    if (rollTimerRef.current != null) {
      window.clearTimeout(rollTimerRef.current)
      rollTimerRef.current = null
    }
    if (settleTimerRef.current != null) {
      window.clearTimeout(settleTimerRef.current)
      settleTimerRef.current = null
    }
  }, [])

  const addDie = useCallback((sides: DiceSides): boolean => {
    if (rollingRef.current) return false
    if (!isDiceSidesReady(sides)) return false
    if (diceRef.current.length >= CLASS_TOOLBOX_DICE_MAX) return false
    setDice((prev) => [...prev, createToolboxDie(sides)])
    return true
  }, [])

  const removeDie = useCallback((id: string) => {
    if (rollingRef.current) return
    setDice((prev) => {
      const next = prev.filter((die) => die.id !== id)
      if (next.length === 0) setParked(false)
      return next
    })
  }, [])

  const toggleLock = useCallback((id: string) => {
    if (rollingRef.current) return
    setDice((prev) =>
      prev.map((die) => {
        if (die.id !== id) return die
        // Only lock dice that already show a number.
        if (die.value == null && !die.locked) return die
        return { ...die, locked: !die.locked }
      }),
    )
  }, [])

  const park = useCallback(() => {
    if (rollingRef.current) return
    if (!diceRef.current.some((die) => die.value != null)) return
    setParked(true)
    setBlocking(false)
  }, [])

  const unpark = useCallback(() => {
    setParked(false)
  }, [])

  const roll = useCallback(() => {
    if (rollingRef.current) return
    const current = diceRef.current
    if (current.length === 0) return

    const rollingDice = current.filter((die) => !die.locked)
    if (rollingDice.length === 0) return

    rollingRef.current = true
    clearTimers()
    setParked(false)

    const nextPending: Record<string, number> = {}
    for (const die of current) {
      if (die.locked) {
        if (die.value != null) nextPending[die.id] = die.value
      } else {
        nextPending[die.id] = randomDieValue(die.sides)
      }
    }
    const nextMotions = createDiceRollMotions(rollingDice)
    const revealMs = maxDiceRevealMs(nextMotions)
    const landMs = maxDiceLandMs(nextMotions)

    setPendingValues(nextPending)
    setMotions(nextMotions)
    setBlocking(true)
    setRolling(true)

    revealTimerRef.current = window.setTimeout(() => {
      setDice((bag) =>
        bag.map((die) => {
          if (die.locked) return die
          return {
            ...die,
            value: nextPending[die.id] ?? die.value,
          }
        }),
      )
      revealTimerRef.current = null
    }, revealMs)

    rollTimerRef.current = window.setTimeout(() => {
      setPendingValues(null)
      setMotions(null)
      setRolling(false)
      rollingRef.current = false
      rollTimerRef.current = null
      settleTimerRef.current = window.setTimeout(() => {
        setBlocking(false)
        settleTimerRef.current = null
      }, CLASS_TOOLBOX_DICE_SETTLE_MS)
    }, landMs)
  }, [clearTimers])

  useEffect(() => {
    if (!active) {
      clearTimers()
      rollingRef.current = false
      didAutoRollRef.current = false
      setDice(createDefaultDiceBag())
      setPendingValues(null)
      setMotions(null)
      setRolling(false)
      setBlocking(false)
      setParked(false)
      return
    }
    if (didAutoRollRef.current) return
    didAutoRollRef.current = true
    roll()
  }, [active, roll, clearTimers])

  useEffect(() => () => clearTimers(), [clearTimers])

  return {
    dice,
    pendingValues,
    motions,
    rolling,
    blocking,
    parked,
    atMax: dice.length >= CLASS_TOOLBOX_DICE_MAX,
    addDie,
    removeDie,
    toggleLock,
    roll,
    park,
    unpark,
  }
}

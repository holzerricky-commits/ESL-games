'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CLASS_TOOLBOX_COIN_FLIP_MS,
  CLASS_TOOLBOX_COIN_SETTLE_MS,
  randomCoinSide,
  type CoinSide,
} from '@/lib/class-toolbox/coin-flip'

export type ClassToolboxCoinState = {
  side: CoinSide | null
  /** Outcome chosen at flip start; drives which face the animation lands on. */
  pendingSide: CoinSide | null
  flipping: boolean
  /** Soft dim + block book taps (flip + settle window). */
  blocking: boolean
  flip: () => void
}

/**
 * Shared coin state for dock + stage. Auto-flips once when `active` becomes true.
 */
export function useClassToolboxCoin(active: boolean): ClassToolboxCoinState {
  const [side, setSide] = useState<CoinSide | null>(null)
  const [pendingSide, setPendingSide] = useState<CoinSide | null>(null)
  const [flipping, setFlipping] = useState(false)
  const [blocking, setBlocking] = useState(false)
  const flippingRef = useRef(false)
  const flipTimerRef = useRef<number | null>(null)
  const settleTimerRef = useRef<number | null>(null)
  const didAutoFlipRef = useRef(false)

  const clearTimers = useCallback(() => {
    if (flipTimerRef.current != null) {
      window.clearTimeout(flipTimerRef.current)
      flipTimerRef.current = null
    }
    if (settleTimerRef.current != null) {
      window.clearTimeout(settleTimerRef.current)
      settleTimerRef.current = null
    }
  }, [])

  const flip = useCallback(() => {
    if (flippingRef.current) return
    flippingRef.current = true
    clearTimers()
    const next = randomCoinSide()
    setPendingSide(next)
    setBlocking(true)
    setFlipping(true)
    flipTimerRef.current = window.setTimeout(() => {
      setSide(next)
      setPendingSide(null)
      setFlipping(false)
      flippingRef.current = false
      flipTimerRef.current = null
      settleTimerRef.current = window.setTimeout(() => {
        setBlocking(false)
        settleTimerRef.current = null
      }, CLASS_TOOLBOX_COIN_SETTLE_MS)
    }, CLASS_TOOLBOX_COIN_FLIP_MS)
  }, [clearTimers])

  useEffect(() => {
    if (!active) {
      clearTimers()
      flippingRef.current = false
      didAutoFlipRef.current = false
      setSide(null)
      setPendingSide(null)
      setFlipping(false)
      setBlocking(false)
      return
    }
    if (didAutoFlipRef.current) return
    didAutoFlipRef.current = true
    flip()
  }, [active, flip, clearTimers])

  useEffect(() => () => clearTimers(), [clearTimers])

  return { side, pendingSide, flipping, blocking, flip }
}

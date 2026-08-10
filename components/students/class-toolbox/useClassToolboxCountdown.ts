'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  playCountdownRing,
  stopCountdownRing,
  warmCountdownAudio,
} from '@/lib/audio/play-countdown-ring'
import {
  DEFAULT_COUNTDOWN_SEC,
  digitsToSec,
  msFromSec,
  secToDigits,
  stepCountdownDigit,
  type CountdownDigitIndex,
  type CountdownStatus,
} from '@/lib/class-toolbox/countdown'

const TICK_MS = 100

export type ClassToolboxCountdownState = {
  durationSec: number
  remainingMs: number
  status: CountdownStatus
  finishedAlertActive: boolean
  adjustDigit: (index: CountdownDigitIndex, delta: 1 | -1) => void
  start: () => void
  pause: () => void
  reset: () => void
}

/**
 * In-dock activity countdown with custom MM:SS. Resets when the tool closes.
 */
export function useClassToolboxCountdown(active: boolean): ClassToolboxCountdownState {
  const [durationSec, setDurationSec] = useState(DEFAULT_COUNTDOWN_SEC)
  const [remainingMs, setRemainingMs] = useState(() => msFromSec(DEFAULT_COUNTDOWN_SEC))
  const [status, setStatus] = useState<CountdownStatus>('idle')
  const [finishedAlertActive, setFinishedAlertActive] = useState(false)
  const endAtRef = useRef<number | null>(null)
  const tickRef = useRef<number | null>(null)

  const clearTick = useCallback(() => {
    if (tickRef.current != null) {
      window.clearInterval(tickRef.current)
      tickRef.current = null
    }
  }, [])

  const syncRemainingFromEnd = useCallback(() => {
    const endAt = endAtRef.current
    if (endAt == null) return
    const left = Math.max(0, endAt - Date.now())
    setRemainingMs(left)
    if (left <= 0) {
      endAtRef.current = null
      clearTick()
      setStatus('finished')
    }
  }, [clearTick])

  const adjustDigit = useCallback(
    (index: CountdownDigitIndex, delta: 1 | -1) => {
      if (status === 'running') return

      if (status === 'paused') {
        const baseSec = Math.ceil(remainingMs / 1000)
        const nextDigits = stepCountdownDigit(secToDigits(baseSec), index, delta)
        const nextSec = digitsToSec(nextDigits)
        setRemainingMs(msFromSec(nextSec))
        return
      }

      // idle or finished — edit saved duration
      const nextDigits = stepCountdownDigit(secToDigits(durationSec), index, delta)
      const nextSec = digitsToSec(nextDigits)
      setDurationSec(nextSec)
      setRemainingMs(msFromSec(nextSec))
      if (status === 'finished') {
        stopCountdownRing()
        setFinishedAlertActive(false)
        setStatus('idle')
      }
    },
    [status, durationSec, remainingMs],
  )

  const start = useCallback(() => {
    if (status === 'running') return
    const ms = status === 'paused' ? remainingMs : msFromSec(durationSec)
    if (ms <= 0) return
    stopCountdownRing()
    setFinishedAlertActive(false)
    warmCountdownAudio()
    endAtRef.current = Date.now() + ms
    setRemainingMs(ms)
    setStatus('running')
  }, [status, durationSec, remainingMs])

  const pause = useCallback(() => {
    if (status !== 'running') return
    const endAt = endAtRef.current
    if (endAt != null) {
      setRemainingMs(Math.max(0, endAt - Date.now()))
    }
    endAtRef.current = null
    clearTick()
    setStatus('paused')
  }, [status, clearTick])

  const reset = useCallback(() => {
    clearTick()
    endAtRef.current = null
    stopCountdownRing()
    setFinishedAlertActive(false)
    setRemainingMs(msFromSec(durationSec))
    setStatus('idle')
  }, [durationSec, clearTick])

  useEffect(() => {
    if (status !== 'running') return
    syncRemainingFromEnd()
    tickRef.current = window.setInterval(syncRemainingFromEnd, TICK_MS)
    return clearTick
  }, [status, syncRemainingFromEnd, clearTick])

  useEffect(() => {
    if (status !== 'finished') return
    setFinishedAlertActive(true)
    playCountdownRing(() => setFinishedAlertActive(false))
  }, [status])

  useEffect(() => {
    if (!active) {
      clearTick()
      endAtRef.current = null
      stopCountdownRing()
      setFinishedAlertActive(false)
      setDurationSec(DEFAULT_COUNTDOWN_SEC)
      setRemainingMs(msFromSec(DEFAULT_COUNTDOWN_SEC))
      setStatus('idle')
    }
  }, [active, clearTick])

  useEffect(() => () => {
    clearTick()
    stopCountdownRing()
  }, [clearTick])

  return {
    durationSec,
    remainingMs,
    status,
    finishedAlertActive,
    adjustDigit,
    start,
    pause,
    reset,
  }
}

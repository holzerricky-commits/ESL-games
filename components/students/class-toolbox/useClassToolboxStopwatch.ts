'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  MAX_STOPWATCH_SEC,
  type StopwatchStatus,
} from '@/lib/class-toolbox/stopwatch'

const TICK_MS = 100
const MAX_MS = MAX_STOPWATCH_SEC * 1000

export type ClassToolboxStopwatchState = {
  elapsedMs: number
  status: StopwatchStatus
  start: () => void
  pause: () => void
  reset: () => void
}

/**
 * In-dock activity stopwatch. Counts up from zero. Resets when the tool closes.
 */
export function useClassToolboxStopwatch(active: boolean): ClassToolboxStopwatchState {
  const [elapsedMs, setElapsedMs] = useState(0)
  const [status, setStatus] = useState<StopwatchStatus>('idle')
  const startedAtRef = useRef<number | null>(null)
  const baseElapsedRef = useRef(0)
  const tickRef = useRef<number | null>(null)

  const clearTick = useCallback(() => {
    if (tickRef.current != null) {
      window.clearInterval(tickRef.current)
      tickRef.current = null
    }
  }, [])

  const syncElapsed = useCallback(() => {
    const startedAt = startedAtRef.current
    if (startedAt == null) return
    const next = Math.min(MAX_MS, baseElapsedRef.current + (Date.now() - startedAt))
    setElapsedMs(next)
    if (next >= MAX_MS) {
      startedAtRef.current = null
      baseElapsedRef.current = MAX_MS
      clearTick()
      setStatus('paused')
    }
  }, [clearTick])

  const start = useCallback(() => {
    if (status === 'running') return
    if (elapsedMs >= MAX_MS) return
    baseElapsedRef.current = elapsedMs
    startedAtRef.current = Date.now()
    setStatus('running')
  }, [status, elapsedMs])

  const pause = useCallback(() => {
    if (status !== 'running') return
    const startedAt = startedAtRef.current
    if (startedAt != null) {
      const next = Math.min(MAX_MS, baseElapsedRef.current + (Date.now() - startedAt))
      baseElapsedRef.current = next
      setElapsedMs(next)
    }
    startedAtRef.current = null
    clearTick()
    setStatus('paused')
  }, [status, clearTick])

  const reset = useCallback(() => {
    clearTick()
    startedAtRef.current = null
    baseElapsedRef.current = 0
    setElapsedMs(0)
    setStatus('idle')
  }, [clearTick])

  useEffect(() => {
    if (status !== 'running') return
    syncElapsed()
    tickRef.current = window.setInterval(syncElapsed, TICK_MS)
    return clearTick
  }, [status, syncElapsed, clearTick])

  useEffect(() => {
    if (!active) {
      clearTick()
      startedAtRef.current = null
      baseElapsedRef.current = 0
      setElapsedMs(0)
      setStatus('idle')
    }
  }, [active, clearTick])

  useEffect(() => () => clearTick(), [clearTick])

  return {
    elapsedMs,
    status,
    start,
    pause,
    reset,
  }
}

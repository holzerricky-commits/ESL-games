'use client'

import { useCallback, useEffect, useState } from 'react'

export const TOP_OPTIONS_BAR_IDLE_MS = 3000
export const TOP_OPTIONS_BAR_PIN_STORAGE_KEY = 'esl-top-options-bar-pinned'

function readPinnedFromStorage(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(TOP_OPTIONS_BAR_PIN_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writePinnedToStorage(pinned: boolean) {
  try {
    window.localStorage.setItem(TOP_OPTIONS_BAR_PIN_STORAGE_KEY, pinned ? '1' : '0')
  } catch {
    /* ignore quota / private mode */
  }
}

export function useTopOptionsBarChrome(enabled: boolean) {
  const [pinned, setPinnedState] = useState(false)
  const [pinnedHydrated, setPinnedHydrated] = useState(false)
  const [edgeHover, setEdgeHover] = useState(false)
  const [barHover, setBarHover] = useState(false)
  const [interacting, setInteracting] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [activityEpoch, setActivityEpoch] = useState(0)
  const [hiddenByIdle, setHiddenByIdle] = useState(false)

  useEffect(() => {
    setPinnedState(readPinnedFromStorage())
    setPinnedHydrated(true)
  }, [])

  const bumpActivity = useCallback(() => {
    setActivityEpoch((n) => n + 1)
  }, [])

  const setPinned = useCallback((next: boolean) => {
    setPinnedState(next)
    writePinnedToStorage(next)
    if (next) {
      setHiddenByIdle(false)
    } else {
      bumpActivity()
    }
  }, [bumpActivity])

  const togglePinned = useCallback(() => {
    setPinned(!pinned)
  }, [pinned, setPinned])

  useEffect(() => {
    if (!enabled) {
      setHiddenByIdle(false)
      return
    }
    if (pinned) {
      setHiddenByIdle(false)
      return
    }
    setHiddenByIdle(false)
    const id = window.setTimeout(() => setHiddenByIdle(true), TOP_OPTIONS_BAR_IDLE_MS)
    return () => window.clearTimeout(id)
  }, [enabled, pinned, activityEpoch])

  useEffect(() => {
    if (!interacting) return
    const end = () => setInteracting(false)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    return () => {
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
  }, [interacting])

  const revealed =
    enabled &&
    pinnedHydrated &&
    (pinned || edgeHover || barHover || interacting || paletteOpen || !hiddenByIdle)

  return {
    pinned,
    pinnedHydrated,
    revealed,
    edgeHover,
    setEdgeHover,
    barHover,
    setBarHover,
    interacting,
    setInteracting,
    bumpActivity,
    togglePinned,
    paletteOpen,
    setPaletteOpen,
  }
}

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export const ANNOTATION_RAIL_IDLE_MS = 3000
export const ANNOTATION_RAIL_SLIDE_MS = 350
export const ANNOTATION_RAIL_PIN_STORAGE_KEY = 'esl-annotation-rail-pinned'

export function useAnnotationRailHoverChrome({
  enabled,
  setVisible,
  pinned,
  setPinned,
  pinHydrated,
  keyboardDismissAt = 0,
  keyboardOpenAt = 0,
  externalHoldOpen = false,
}: {
  enabled: boolean
  setVisible: (visible: boolean) => void
  pinned: boolean
  setPinned: (pinned: boolean) => void
  pinHydrated: boolean
  /** Increment when `` ` `` or similar forces the rail closed. */
  keyboardDismissAt?: number
  /** Increment when `` ` `` opens the rail without hover. */
  keyboardOpenAt?: number
  /** Keep the rail open while a properties palette is open. */
  externalHoldOpen?: boolean
}) {
  const [edgeHover, setEdgeHover] = useState(false)
  const [clusterHover, setClusterHover] = useState(false)
  const [interacting, setInteracting] = useState(false)
  const [activityEpoch, setActivityEpoch] = useState(0)
  /** True = collapsed after idle; starts hidden until hover, pin, or keyboard open. */
  const [hiddenByIdle, setHiddenByIdle] = useState(true)
  const hoverLockRef = useRef(false)
  const deferredEdgeLeaveRef = useRef(false)
  const hadActivityRef = useRef(false)

  const bumpActivity = useCallback(() => {
    hadActivityRef.current = true
    setActivityEpoch((n) => n + 1)
  }, [])

  const openRail = useCallback(() => {
    setHiddenByIdle(false)
    bumpActivity()
  }, [bumpActivity])

  const togglePinned = useCallback(() => {
    if (pinned) {
      setPinned(false)
      setHiddenByIdle(true)
      setEdgeHover(false)
      setClusterHover(false)
      return
    }
    setPinned(true)
    setHiddenByIdle(false)
    bumpActivity()
  }, [bumpActivity, pinned, setPinned])

  useEffect(() => {
    if (!enabled || !pinHydrated) return
    if (pinned) {
      setHiddenByIdle(false)
    }
  }, [enabled, pinHydrated, pinned])

  useEffect(() => {
    if (!enabled || keyboardDismissAt === 0) return
    setHiddenByIdle(true)
    setEdgeHover(false)
    setClusterHover(false)
  }, [enabled, keyboardDismissAt])

  useEffect(() => {
    if (!enabled || keyboardOpenAt === 0) return
    openRail()
  }, [enabled, keyboardOpenAt, openRail])

  useEffect(() => {
    if (!enabled) {
      setHiddenByIdle(true)
      hadActivityRef.current = false
      return
    }
    if (pinned) return
    if (!hadActivityRef.current) return

    const id = window.setTimeout(() => {
      setHiddenByIdle(true)
      // Stale edge hover (e.g. leave swallowed during slide) must not keep the rail open.
      setEdgeHover(false)
      deferredEdgeLeaveRef.current = false
    }, ANNOTATION_RAIL_IDLE_MS)
    return () => window.clearTimeout(id)
  }, [enabled, pinned, activityEpoch])

  const revealed =
    enabled &&
    pinHydrated &&
    (pinned || edgeHover || clusterHover || interacting || externalHoldOpen || !hiddenByIdle)

  useEffect(() => {
    if (!enabled || !pinHydrated) return
    setVisible(revealed)
  }, [enabled, pinHydrated, revealed, setVisible])

  const onEdgePointerEnter = useCallback(() => {
    deferredEdgeLeaveRef.current = false
    hoverLockRef.current = true
    setEdgeHover(true)
    openRail()
    window.setTimeout(() => {
      hoverLockRef.current = false
      if (deferredEdgeLeaveRef.current) {
        deferredEdgeLeaveRef.current = false
        setEdgeHover(false)
        bumpActivity()
      }
    }, ANNOTATION_RAIL_SLIDE_MS + 50)
  }, [bumpActivity, openRail])

  const onEdgePointerLeave = useCallback(() => {
    if (hoverLockRef.current) {
      deferredEdgeLeaveRef.current = true
      return
    }
    setEdgeHover(false)
    bumpActivity()
  }, [bumpActivity])

  const onClusterPointerEnter = useCallback(() => {
    setClusterHover(true)
    openRail()
  }, [openRail])

  const onClusterPointerLeave = useCallback(() => {
    setClusterHover(false)
    bumpActivity()
  }, [bumpActivity])

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

  const onClusterPointerDown = useCallback(() => {
    setInteracting(true)
    bumpActivity()
  }, [bumpActivity])

  return {
    pinned,
    revealed,
    revealRail: openRail,
    togglePinned,
    bumpActivity,
    onEdgePointerEnter,
    onEdgePointerLeave,
    onClusterPointerEnter,
    onClusterPointerLeave,
    onClusterPointerDown,
  }
}

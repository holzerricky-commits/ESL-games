'use client'

import { useEffect, useRef, useState } from 'react'
import { spreadCrossfadeEnabled } from '@/lib/books/feature-flags'
import { resolveSpreadAnchorPages } from '@/lib/books/reader-spread-navigation'
import {
  SPREAD_CROSSFADE_CLEANUP_MS,
  SPREAD_CROSSFADE_MS,
  SPREAD_CROSSFADE_RAPID_MS,
} from '@/lib/books/spread-crossfade-config'

export type OutgoingSpreadSnapshot = {
  left: number
  right: number | null
}

interface UseSpreadCrossfadeArgs {
  anchorPage: number
  visiblePages: number[]
  enabled?: boolean
}

/**
 * Phase 4 — brief crossfade when the anchor page changes (prefetched target spread).
 * Skipped when `prefers-reduced-motion: reduce` or when turns arrive faster than SPREAD_CROSSFADE_RAPID_MS.
 */
export function useSpreadCrossfade({
  anchorPage,
  visiblePages,
  enabled = spreadCrossfadeEnabled,
}: UseSpreadCrossfadeArgs) {
  const prevAnchorRef = useRef(anchorPage)
  const lastTurnAtRef = useRef(0)
  const [outgoing, setOutgoing] = useState<OutgoingSpreadSnapshot | null>(null)
  const [incomingVisible, setIncomingVisible] = useState(true)

  const isAnimating = outgoing != null
  const incomingOpacity = isAnimating ? (incomingVisible ? 1 : 0) : 1
  const outgoingOpacity = isAnimating ? (incomingVisible ? 0 : 1) : 0

  useEffect(() => {
    if (!enabled) {
      prevAnchorRef.current = anchorPage
      return
    }

    const prevAnchor = prevAnchorRef.current
    if (prevAnchor === anchorPage) return

    prevAnchorRef.current = anchorPage

    if (typeof window !== 'undefined') {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (reduced) return
    }

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const rapid = now - lastTurnAtRef.current < SPREAD_CROSSFADE_RAPID_MS
    lastTurnAtRef.current = now

    if (rapid) {
      setOutgoing(null)
      setIncomingVisible(true)
      return
    }

    const snapshot = resolveSpreadAnchorPages(prevAnchor, visiblePages)
    setOutgoing(snapshot)
    setIncomingVisible(false)

    let innerRaf = 0
    const outerRaf = requestAnimationFrame(() => {
      innerRaf = requestAnimationFrame(() => {
        setIncomingVisible(true)
      })
    })

    const timer = window.setTimeout(() => {
      setOutgoing(null)
      setIncomingVisible(true)
    }, SPREAD_CROSSFADE_MS + SPREAD_CROSSFADE_CLEANUP_MS)

    return () => {
      cancelAnimationFrame(outerRaf)
      cancelAnimationFrame(innerRaf)
      clearTimeout(timer)
      setIncomingVisible(true)
      setOutgoing(null)
    }
  }, [anchorPage, visiblePages, enabled])

  return {
    outgoing,
    incomingOpacity,
    outgoingOpacity,
    isAnimating,
    crossfadeMs: SPREAD_CROSSFADE_MS,
  }
}

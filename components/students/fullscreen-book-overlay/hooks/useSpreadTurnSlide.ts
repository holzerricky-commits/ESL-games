'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { SPREAD_TURN_SLIDE_MS } from '@/lib/books/spread-turn-slide-config'
import type { OutgoingSpreadSnapshot } from '@/components/students/fullscreen-book-overlay/hooks/useSpreadCrossfade'

export type SpreadTurnDirection = 1 | -1

export interface SpreadTurnSlidePayload {
  captureUrl: string | null
  direction: SpreadTurnDirection
  outgoing: OutgoingSpreadSnapshot
  /** Monotonic id so each turn retriggers animation even when pages repeat. */
  seq: number
}

interface UseSpreadTurnSlideArgs {
  turnSlide: SpreadTurnSlidePayload | null
  onTurnSlideComplete?: () => void
}

type SlidePhase = 'idle' | 'start' | 'end'

function flushPendingStyles() {
  if (typeof document === 'undefined') return
  void document.documentElement.getBoundingClientRect()
}

/**
 * Phase 4b — directional slide transforms for incoming/outgoing spread layers.
 * Start frame: outgoing centered, incoming off-screen. End frame: incoming centered, outgoing off-screen.
 */
export function useSpreadTurnSlide({ turnSlide, onTurnSlideComplete }: UseSpreadTurnSlideArgs) {
  const [phase, setPhase] = useState<SlidePhase>('idle')
  const onCompleteRef = useRef(onTurnSlideComplete)
  onCompleteRef.current = onTurnSlideComplete

  const slideMs = SPREAD_TURN_SLIDE_MS
  const dir = turnSlide?.direction ?? 1
  const turnSeq = turnSlide?.seq ?? 0

  useLayoutEffect(() => {
    if (!turnSlide) {
      setPhase('idle')
      return
    }
    setPhase('start')
  }, [turnSeq, turnSlide != null])

  useEffect(() => {
    if (!turnSlide) return

    if (typeof window !== 'undefined') {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        onCompleteRef.current?.()
        return
      }
    }

    let innerRaf = 0
    let cancelled = false

    flushPendingStyles()
    const outerRaf = requestAnimationFrame(() => {
      flushPendingStyles()
      innerRaf = requestAnimationFrame(() => {
        if (!cancelled) setPhase('end')
      })
    })

    const timer = window.setTimeout(() => {
      onCompleteRef.current?.()
    }, slideMs + 32)

    return () => {
      cancelled = true
      cancelAnimationFrame(outerRaf)
      cancelAnimationFrame(innerRaf)
      clearTimeout(timer)
    }
  }, [turnSeq, slideMs])

  const isAnimating = turnSlide != null && phase !== 'idle'
  const incomingAtStart = phase === 'start'

  const incomingTranslateX = !turnSlide ? 0 : incomingAtStart ? dir * 100 : 0
  const outgoingTranslateX = !turnSlide ? 0 : phase === 'end' ? -dir * 100 : 0

  const transitionActive = phase === 'end'

  return {
    isAnimating,
    transitionActive,
    slideMs,
    incomingTranslateX,
    outgoingTranslateX,
    useCaptureOutgoing: turnSlide?.captureUrl != null,
    outgoingCaptureUrl: turnSlide?.captureUrl ?? null,
    fallbackOutgoing: turnSlide != null && turnSlide.captureUrl == null,
  }
}

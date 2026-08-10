import type { CSSProperties, TransitionEvent } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'

export type WhiteboardToolbarLaunchApi = {
  playEnter: (openBoard: () => void) => void
  playExit: (closeBoard: () => void) => void
}

const APPEAR_MS = 200
const APPEAR_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

type AppearPhase = 'idle' | 'enter-start' | 'shown' | 'exiting'

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * In-place fade + slight scale for lesson board open/close.
 * No flight from the toolbox — the board appears where it lives on the book.
 */
export function useWhiteboardToolbarLaunch() {
  const panelAnchorRef = useRef<HTMLDivElement | null>(null)
  const [phase, setPhase] = useState<AppearPhase>('idle')
  const pendingExitRef = useRef<(() => void) | null>(null)
  const enterRafRef = useRef<number | null>(null)

  const clearEnterRaf = useCallback(() => {
    if (enterRafRef.current != null) {
      cancelAnimationFrame(enterRafRef.current)
      enterRafRef.current = null
    }
  }, [])

  const playEnter = useCallback(
    (openBoard: () => void) => {
      clearEnterRaf()
      pendingExitRef.current = null

      if (prefersReducedMotion()) {
        setPhase('shown')
        openBoard()
        return
      }

      setPhase('enter-start')
      openBoard()
      enterRafRef.current = requestAnimationFrame(() => {
        enterRafRef.current = requestAnimationFrame(() => {
          enterRafRef.current = null
          setPhase('shown')
        })
      })
    },
    [clearEnterRaf],
  )

  const playExit = useCallback(
    (closeBoard: () => void) => {
      clearEnterRaf()

      if (prefersReducedMotion()) {
        pendingExitRef.current = null
        setPhase('idle')
        closeBoard()
        return
      }

      pendingExitRef.current = closeBoard
      setPhase('exiting')
    },
    [clearEnterRaf],
  )

  const finishExit = useCallback(() => {
    const finish = pendingExitRef.current
    if (!finish) return
    pendingExitRef.current = null
    setPhase('idle')
    finish()
  }, [])

  useEffect(() => {
    if (phase !== 'exiting') return
    const id = window.setTimeout(finishExit, APPEAR_MS + 50)
    return () => window.clearTimeout(id)
  }, [finishExit, phase])

  const onPanelTransitionEnd = useCallback(
    (event: TransitionEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget) return
      if (event.propertyName !== 'opacity' && event.propertyName !== 'transform') return
      if (phase !== 'exiting') return
      finishExit()
    },
    [finishExit, phase],
  )

  const isAnimatingIn = phase === 'enter-start'
  const isAnimatingOut = phase === 'exiting'
  const isHiddenVisual = phase === 'enter-start' || phase === 'exiting'

  const panelAppearStyle: CSSProperties | undefined =
    phase === 'idle'
      ? undefined
      : {
          opacity: isHiddenVisual ? 0 : 1,
          transform: isHiddenVisual ? 'scale(0.96)' : 'scale(1)',
          transformOrigin: 'center center',
          transition:
            phase === 'enter-start'
              ? 'none'
              : `opacity ${APPEAR_MS}ms ${APPEAR_EASE}, transform ${APPEAR_MS}ms ${APPEAR_EASE}`,
          willChange: isAnimatingIn || isAnimatingOut ? 'opacity, transform' : undefined,
        }

  return {
    panelAnchorRef,
    panelAppearStyle,
    panelAppearBlocking: isHiddenVisual,
    playEnter,
    playExit,
    onPanelTransitionEnd,
  }
}

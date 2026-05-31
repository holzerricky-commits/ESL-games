import { useCallback, useEffect, useRef, useState } from 'react'
import type { WhiteboardSlotSide } from './useWhiteboardPlacement'
import { oppositeWhiteboardSlotSide } from './useWhiteboardPlacement'

const SNAP_THRESHOLD_PX = 40
const SLOT_TRANSITION_MS = 320

export type WhiteboardSlotMotionApi = {
  moveTo: (side: WhiteboardSlotSide) => void
}

interface UseWhiteboardSlotMotionArgs {
  slotSide: WhiteboardSlotSide
  commitSlotSide: (side: WhiteboardSlotSide) => void
  slotTravelPx: number
  enabled: boolean
  registerMotionApi?: (api: WhiteboardSlotMotionApi | null) => void
}

function snapTravelTarget(targetSide: WhiteboardSlotSide, travelPx: number): number {
  return targetSide === 'right' ? travelPx : -travelPx
}

export function useWhiteboardSlotMotion({
  slotSide,
  commitSlotSide,
  slotTravelPx,
  enabled,
  registerMotionApi,
}: UseWhiteboardSlotMotionArgs) {
  const dragStartXRef = useRef<number | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const animatingRef = useRef(false)
  const [translatePx, setTranslatePx] = useState(0)
  const [transitionOn, setTransitionOn] = useState(false)

  const runTransitionTo = useCallback(
    (targetPx: number, onComplete?: () => void) => {
      const el = panelRef.current
      if (!el || !enabled) {
        setTranslatePx(targetPx)
        onComplete?.()
        return
      }

      animatingRef.current = true
      setTransitionOn(true)
      setTranslatePx(targetPx)

      const finish = () => {
        el.removeEventListener('transitionend', onTransitionEnd)
        clearTimeout(fallbackId)
        setTransitionOn(false)
        animatingRef.current = false
        onComplete?.()
      }

      const onTransitionEnd = (e: TransitionEvent) => {
        if (e.target !== el || e.propertyName !== 'transform') return
        finish()
      }

      const fallbackId = window.setTimeout(finish, SLOT_TRANSITION_MS + 40)
      el.addEventListener('transitionend', onTransitionEnd)
    },
    [enabled],
  )

  const moveTo = useCallback(
    (targetSide: WhiteboardSlotSide) => {
      if (!enabled || targetSide === slotSide || animatingRef.current) {
        if (targetSide !== slotSide) commitSlotSide(targetSide)
        return
      }

      const outbound = snapTravelTarget(targetSide, slotTravelPx)
      runTransitionTo(outbound, () => {
        commitSlotSide(targetSide)
        requestAnimationFrame(() => setTranslatePx(0))
      })
    },
    [commitSlotSide, enabled, runTransitionTo, slotSide, slotTravelPx],
  )

  useEffect(() => {
    registerMotionApi?.({ moveTo })
    return () => registerMotionApi?.(null)
  }, [moveTo, registerMotionApi])

  const onSlotDragPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || animatingRef.current) return
      e.preventDefault()
      e.stopPropagation()
      dragStartXRef.current = e.clientX
      setTransitionOn(false)
      setTranslatePx(0)
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [enabled],
  )

  const onSlotDragPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || dragStartXRef.current == null || animatingRef.current) return
      setTranslatePx(e.clientX - dragStartXRef.current)
    },
    [enabled],
  )

  const onSlotDragPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || dragStartXRef.current == null) return
      const delta = e.clientX - dragStartXRef.current
      dragStartXRef.current = null
      try {
        ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      } catch {
        /* already released */
      }

      const towardOtherPage =
        slotSide === 'left' ? delta > SNAP_THRESHOLD_PX : delta < -SNAP_THRESHOLD_PX

      if (towardOtherPage) {
        const targetPx = snapTravelTarget(oppositeWhiteboardSlotSide(slotSide), slotTravelPx)
        runTransitionTo(targetPx, () => {
          const nextSide = oppositeWhiteboardSlotSide(slotSide)
          commitSlotSide(nextSide)
          requestAnimationFrame(() => setTranslatePx(0))
        })
      } else {
        runTransitionTo(0)
      }
    },
    [commitSlotSide, enabled, runTransitionTo, slotSide, slotTravelPx],
  )

  const onSlotDragPointerCancel = useCallback(() => {
    dragStartXRef.current = null
    if (!animatingRef.current) runTransitionTo(0)
  }, [runTransitionTo])

  const panelMotionStyle = {
    transform: `translateX(${translatePx}px)`,
    transition:
      transitionOn && enabled
        ? `transform ${SLOT_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
        : 'none',
  } as const

  return {
    panelRef,
    panelMotionStyle,
    onSlotDragPointerDown,
    onSlotDragPointerMove,
    onSlotDragPointerUp,
    onSlotDragPointerCancel,
    moveTo,
  }
}

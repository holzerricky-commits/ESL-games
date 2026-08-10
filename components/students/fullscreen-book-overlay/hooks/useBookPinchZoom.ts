'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { shouldBlockBrowserPinchWheelEvent } from '@/lib/books/block-browser-pinch-zoom'
import {
  bookBlockBrowserPinchZoomEnabled,
  bookPinchZoomEnabled,
} from '@/lib/books/feature-flags'
import {
  applyPinchZoomPanWheel,
  applyPinchZoomSpreadElementStyle,
  applyPinchZoomWheelAtClient,
  BOOK_PINCH_ZOOM_STEP_WHEEL_DELTA,
  defaultPinchZoomState,
  isPinchZoomActive,
  reclampPinchZoomState,
  type PinchZoomState,
} from '@/lib/books/pinch-zoom-transform'
import type { BookFocusZoomPhase } from '@/lib/books/focus-zoom-types'

function isWheelTargetInPageArea(
  pageArea: HTMLElement | null,
  target: EventTarget | null,
): boolean {
  if (!pageArea || !(target instanceof Node)) return false
  return pageArea.contains(target)
}

/** Board lives in pageArea but has its own size — do not drive book pinch from board wheels. */
function isWheelTargetOnLessonBoard(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return target.closest('[data-lesson-board-chrome]') != null
}

export function useBookPinchZoom(args: {
  containerRef: RefObject<HTMLElement | null>
  pageAreaRef: RefObject<HTMLElement | null>
  pinchSpreadRef: RefObject<HTMLElement | null>
  enabled: boolean
  focusPhase: BookFocusZoomPhase
  pageAreaW: number
  pageAreaH: number
  spreadOuterW: number
  spreadOuterH: number
  /** Used to re-apply the live transform after a page turn (zoom is kept). */
  pageNumber: number
}): {
  pinchZoomState: PinchZoomState
  pinchZoomActive: boolean
  clearPinchZoom: () => void
  stepPinchZoom: (direction: 1 | -1) => void
} {
  const {
    containerRef,
    pageAreaRef,
    pinchSpreadRef,
    enabled,
    focusPhase,
    pageAreaW,
    pageAreaH,
    spreadOuterW,
    spreadOuterH,
    pageNumber,
  } = args

  const layoutKey = `${pageAreaW}|${pageAreaH}|${spreadOuterW}|${spreadOuterH}`
  const layoutKeyRef = useRef(layoutKey)

  const makeDefaultState = useCallback((): PinchZoomState => {
    return defaultPinchZoomState()
  }, [])

  const [pinchZoomState, setPinchZoomState] = useState<PinchZoomState>(makeDefaultState)

  const pinchZoomStateRef = useRef(pinchZoomState)
  const pendingStateRef = useRef<PinchZoomState | null>(null)
  const rafIdRef = useRef<number | null>(null)

  const applyPinchDom = useCallback(
    (state: PinchZoomState) => {
      applyPinchZoomSpreadElementStyle(pinchSpreadRef.current, state)
    },
    [pinchSpreadRef],
  )

  const commitPinchState = useCallback(
    (next: PinchZoomState) => {
      pinchZoomStateRef.current = next
      applyPinchDom(next)
      pendingStateRef.current = next
      if (rafIdRef.current !== null) return
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null
        const pending = pendingStateRef.current
        if (pending) {
          setPinchZoomState(pending)
        }
      })
    },
    [applyPinchDom],
  )

  const clearPinchZoom = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
    pendingStateRef.current = null
    const next = makeDefaultState()
    pinchZoomStateRef.current = next
    applyPinchDom(next)
    setPinchZoomState(next)
  }, [applyPinchDom, makeDefaultState])

  const stepPinchZoom = useCallback(
    (direction: 1 | -1) => {
      if (!bookPinchZoomEnabled || focusPhase !== 'off') return
      if (!(pageAreaW > 0) || !(pageAreaH > 0) || !(spreadOuterW > 0) || !(spreadOuterH > 0)) return
      const next = applyPinchZoomWheelAtClient({
        state: pinchZoomStateRef.current,
        anchorX: pageAreaW / 2,
        anchorY: pageAreaH / 2,
        deltaY: direction < 0 ? BOOK_PINCH_ZOOM_STEP_WHEEL_DELTA : -BOOK_PINCH_ZOOM_STEP_WHEEL_DELTA,
        spreadOuterW,
        spreadOuterH,
        pageAreaW,
        pageAreaH,
        clampWheelDelta: false,
      })
      commitPinchState(next)
    },
    [commitPinchState, focusPhase, pageAreaH, pageAreaW, spreadOuterH, spreadOuterW],
  )

  /** Keep zoom across page turns — React style updates can wipe the imperative transform. */
  useLayoutEffect(() => {
    applyPinchDom(pinchZoomStateRef.current)
  }, [pageNumber, applyPinchDom])

  useEffect(() => {
    if (focusPhase !== 'off') {
      clearPinchZoom()
    }
  }, [focusPhase, clearPinchZoom])

  useEffect(() => {
    if (layoutKeyRef.current === layoutKey) return
    layoutKeyRef.current = layoutKey
    if (!(pageAreaW > 0) || !(pageAreaH > 0) || !(spreadOuterW > 0) || !(spreadOuterH > 0)) {
      return
    }
    const next = reclampPinchZoomState({
      state: pinchZoomStateRef.current,
      spreadOuterW,
      spreadOuterH,
      pageAreaW,
      pageAreaH,
    })
    commitPinchState(next)
  }, [layoutKey, pageAreaW, pageAreaH, spreadOuterW, spreadOuterH, commitPinchState])

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
      }
    }
  }, [])

  const pinchZoomActive = isPinchZoomActive(pinchZoomState)
  pinchZoomStateRef.current = pinchZoomState

  useEffect(() => {
    const blockBrowserPinch = bookBlockBrowserPinchZoomEnabled || bookPinchZoomEnabled
    const livePinch = bookPinchZoomEnabled
    if (!blockBrowserPinch || !enabled) return

    const container = containerRef.current
    if (!container) return

    function onWheel(e: WheelEvent) {
      if (!shouldBlockBrowserPinchWheelEvent(e)) {
        if (!livePinch || focusPhase !== 'off') return
        if (!isWheelTargetInPageArea(pageAreaRef.current, e.target)) return
        if (isWheelTargetOnLessonBoard(e.target)) return
        const prev = pinchZoomStateRef.current
        if (!isPinchZoomActive(prev)) return
        if (!(pageAreaW > 0) || !(pageAreaH > 0) || !(spreadOuterW > 0) || !(spreadOuterH > 0)) {
          return
        }
        const next = applyPinchZoomPanWheel({
          state: prev,
          deltaX: e.deltaX,
          deltaY: e.deltaY,
          spreadOuterW,
          spreadOuterH,
          pageAreaW,
          pageAreaH,
        })
        if (!next) return
        e.preventDefault()
        commitPinchState(next)
        return
      }

      e.preventDefault()
      if (!livePinch || focusPhase !== 'off') return
      if (!isWheelTargetInPageArea(pageAreaRef.current, e.target)) return
      if (isWheelTargetOnLessonBoard(e.target)) return
      if (!(pageAreaW > 0) || !(pageAreaH > 0) || !(spreadOuterW > 0) || !(spreadOuterH > 0)) return

      const pageArea = pageAreaRef.current
      if (!pageArea) return
      const pageAreaRect = pageArea.getBoundingClientRect()
      const anchorX = e.clientX - pageAreaRect.left
      const anchorY = e.clientY - pageAreaRect.top

      const next = applyPinchZoomWheelAtClient({
        state: pinchZoomStateRef.current,
        anchorX,
        anchorY,
        deltaY: e.deltaY,
        spreadOuterW,
        spreadOuterH,
        pageAreaW,
        pageAreaH,
      })
      commitPinchState(next)
    }

    container.addEventListener('wheel', onWheel, { capture: true, passive: false })
    return () => {
      container.removeEventListener('wheel', onWheel, { capture: true })
    }
  }, [
    containerRef,
    pageAreaRef,
    commitPinchState,
    enabled,
    focusPhase,
    pageAreaW,
    pageAreaH,
    spreadOuterW,
    spreadOuterH,
  ])

  return {
    pinchZoomState,
    pinchZoomActive,
    clearPinchZoom,
    stepPinchZoom,
  }
}

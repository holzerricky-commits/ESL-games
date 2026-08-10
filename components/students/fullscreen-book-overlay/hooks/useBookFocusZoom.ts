'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { bookFocusZoomEnabled } from '@/lib/books/feature-flags'
import {
  computeFocusSpreadLayout,
  focusSpreadLayoutWithPan,
} from '@/lib/books/focus-zoom-transform'
import type {
  BookFocusZoomPhase,
  FocusSpreadLayout,
  SpreadNormRect,
} from '@/lib/books/focus-zoom-types'

interface UseBookFocusZoomArgs {
  enabled?: boolean
  pageAreaW: number
  pageAreaH: number
  spreadW: number
  spreadH: number
  baseScale: number
  spreadGridRef: MutableRefObject<HTMLElement | null>
  pageNumber: number
  overlayOpen: boolean
}

export function useBookFocusZoom({
  enabled = bookFocusZoomEnabled,
  pageAreaW,
  pageAreaH,
  spreadW,
  spreadH,
  baseScale,
  spreadGridRef,
  pageNumber,
  overlayOpen,
}: UseBookFocusZoomArgs) {
  const [phase, setPhase] = useState<BookFocusZoomPhase>('off')
  const [normRect, setNormRect] = useState<SpreadNormRect | null>(null)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })

  const resetPan = useCallback(() => setPanOffset({ x: 0, y: 0 }), [])

  const clearFocus = useCallback(() => {
    setPhase('off')
    setNormRect(null)
    resetPan()
  }, [resetPan])

  const startDraw = useCallback(() => {
    if (!enabled) return
    setPhase('draw')
    setNormRect(null)
    resetPan()
  }, [enabled, resetPan])

  const commitNormRect = useCallback(
    (rect: SpreadNormRect) => {
      if (!enabled) return
      setNormRect(rect)
      setPhase('active')
      resetPan()
    },
    [enabled, resetPan],
  )

  /** Toolbar / “New area” — pick a fresh box (cancel if already drawing). */
  const requestFocusDraw = useCallback(() => {
    if (!enabled) return
    if (phase === 'draw') {
      clearFocus()
      return
    }
    startDraw()
  }, [clearFocus, enabled, phase, startDraw])

  /** **Z** — exit when zoomed/drawing; otherwise start a new focus box. */
  const toggleFocusViaKeyboard = useCallback(() => {
    if (!enabled) return
    if (phase === 'active' || phase === 'draw') {
      clearFocus()
      return
    }
    startDraw()
  }, [clearFocus, enabled, phase, startDraw])

  const baseLayout = useMemo((): FocusSpreadLayout | null => {
    if (phase !== 'active' || !normRect) return null
    return computeFocusSpreadLayout({
      pageAreaW,
      pageAreaH,
      spreadW,
      spreadH,
      baseScale,
      normRect,
    })
  }, [baseScale, normRect, pageAreaH, pageAreaW, phase, spreadH, spreadW])

  const layout = useMemo((): FocusSpreadLayout | null => {
    if (!baseLayout) return null
    return focusSpreadLayoutWithPan(baseLayout, spreadW, spreadH, panOffset.x, panOffset.y)
  }, [baseLayout, panOffset.x, panOffset.y, spreadH, spreadW])

  const applyFocusPanDelta = useCallback(
    (dx: number, dy: number) => {
      if (phase !== 'active' || !baseLayout) return
      setPanOffset((prev) => {
        const next = focusSpreadLayoutWithPan(baseLayout, spreadW, spreadH, prev.x + dx, prev.y + dy)
        return { x: next.panX, y: next.panY }
      })
    },
    [baseLayout, phase, spreadH, spreadW],
  )

  const effectiveSpreadScreenScale = layout?.scale ?? baseScale

  useEffect(() => {
    if (!overlayOpen) clearFocus()
  }, [clearFocus, overlayOpen])

  useEffect(() => {
    clearFocus()
  }, [clearFocus, pageNumber])

  return {
    focusZoomEnabled: enabled,
    focusPhase: phase,
    focusNormRect: normRect,
    focusLayout: layout,
    focusDrawActive: phase === 'draw',
    focusActive: phase === 'active',
    effectiveSpreadScreenScale,
    startFocusDraw: requestFocusDraw,
    toggleFocusTool: toggleFocusViaKeyboard,
    commitFocusNormRect: commitNormRect,
    applyFocusPanDelta,
    clearFocusZoom: clearFocus,
    spreadGridRef,
  }
}

export type BookFocusZoomController = ReturnType<typeof useBookFocusZoom>

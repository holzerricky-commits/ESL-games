'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type ClassToolboxPanelPosition = {
  left: number
  top: number
}

/** Remember last dock spot for this browser session (across open/close / tool switch). */
let sessionPanelPosition: ClassToolboxPanelPosition | null = null

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function isInteractiveDragTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(
    target.closest('button, a, input, textarea, select, [role="button"], [data-toolbox-no-drag]'),
  )
}

function clampToViewport(
  left: number,
  top: number,
  width: number,
  height: number,
): ClassToolboxPanelPosition {
  const margin = 8
  return {
    left: clamp(left, margin, Math.max(margin, window.innerWidth - width - margin)),
    top: clamp(top, margin, Math.max(margin, window.innerHeight - height - margin)),
  }
}

/**
 * Drag the toolbox dock by its title bar. Keeps the last spot for the session.
 */
export function useClassToolboxPanelDrag(enabled: boolean, toolId: string | null) {
  const panelRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originLeft: number
    originTop: number
  } | null>(null)
  const [position, setPosition] = useState<ClassToolboxPanelPosition | null>(
    () => sessionPanelPosition,
  )
  const [dragging, setDragging] = useState(false)

  const onHandlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 || isInteractiveDragTarget(e.target)) return
    const el = panelRef.current
    if (!el) return

    e.preventDefault()
    e.stopPropagation()

    const rect = el.getBoundingClientRect()
    const originLeft = position?.left ?? rect.left
    const originTop = position?.top ?? rect.top

    if (!position) {
      const next = { left: originLeft, top: originTop }
      sessionPanelPosition = next
      setPosition(next)
    }

    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originLeft,
      originTop,
    }
    setDragging(true)
    el.setPointerCapture(e.pointerId)
  }, [position])

  const onPanelPointerMove = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current
    const el = panelRef.current
    if (!drag || !el || e.pointerId !== drag.pointerId) return

    const next = clampToViewport(
      drag.originLeft + e.clientX - drag.startX,
      drag.originTop + e.clientY - drag.startY,
      el.offsetWidth,
      el.offsetHeight,
    )
    sessionPanelPosition = next
    setPosition(next)
  }, [])

  const endDrag = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag || e.pointerId !== drag.pointerId) return
    dragRef.current = null
    setDragging(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    const reclamp = () => {
      const el = panelRef.current
      if (!el || !sessionPanelPosition) return
      const next = clampToViewport(
        sessionPanelPosition.left,
        sessionPanelPosition.top,
        el.offsetWidth,
        el.offsetHeight,
      )
      sessionPanelPosition = next
      setPosition(next)
    }
    window.addEventListener('resize', reclamp)
    // After paint so width for the new tool is known
    const id = window.requestAnimationFrame(reclamp)
    return () => {
      window.removeEventListener('resize', reclamp)
      window.cancelAnimationFrame(id)
    }
  }, [enabled, toolId])

  return {
    panelRef,
    position,
    dragging,
    onHandlePointerDown,
    onPanelPointerMove,
    endDrag,
  }
}

'use client'

import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { NormRect } from '@/lib/books/annotation-select'
import {
  clampSelectionBarCenterX,
  SELECTION_CONTEXT_BAR_GAP_NORM,
  type SelectionBarPlacement,
} from '@/lib/books/selection-context-anchor'
import { cn } from '@/lib/utils'
import {
  SELECTION_CONTEXT_BAR_LAYOUT,
  SELECTION_CONTEXT_BAR_SURFACE,
} from '@/components/students/selection-context-bar/selection-context-bar-styles'

const EDGE_PAD_PX = 8

type BarAnchor = {
  anchorRect: NormRect
  placement: SelectionBarPlacement
}

function cloneRect(rect: NormRect): NormRect {
  return { x: rect.x, y: rect.y, w: rect.w, h: rect.h }
}

function buildBarStyle(
  anchorRect: NormRect,
  placement: SelectionBarPlacement,
  shellH: number,
  scale: number,
  barHalfWidthNorm: number,
): CSSProperties {
  const gapPx = SELECTION_CONTEXT_BAR_GAP_NORM * shellH + 8
  const centerNorm = clampSelectionBarCenterX(anchorRect.x + anchorRect.w / 2, {
    barHalfWidthNorm: barHalfWidthNorm / scale,
  })
  const translateY =
    placement === 'above' ? `calc(-100% - ${gapPx}px)` : `${gapPx}px`
  const scalePart = scale < 1 ? ` scale(${scale})` : ''
  return {
    left: `${centerNorm * 100}%`,
    top:
      placement === 'above'
        ? `${anchorRect.y * 100}%`
        : `${(anchorRect.y + anchorRect.h) * 100}%`,
    transform: `translate(-50%, ${translateY})${scalePart}`,
    transformOrigin: 'top center',
  }
}

export function SelectionContextBar({
  anchorRect,
  placement,
  positionKey,
  className,
  children,
  visible = true,
  'aria-label': ariaLabel = 'Selection options',
}: {
  anchorRect: NormRect
  placement: SelectionBarPlacement
  /**
   * Identity of the current selection. The bar only repositions when this changes,
   * or when it becomes visible again after being hidden (e.g. after a drag).
   * Property edits that resize the selection (font size, etc.) must not move the bar.
   */
  positionKey: string
  className?: string
  children: ReactNode
  /** Opacity fade only — bar stays mounted so drag hide/show does not replay enter motion. */
  visible?: boolean
  'aria-label'?: string
}) {
  const shellRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [shellH, setShellH] = useState(0)
  const [barHalfWidthNorm, setBarHalfWidthNorm] = useState(0)
  const [locked, setLocked] = useState<BarAnchor>(() => ({
    anchorRect: cloneRect(anchorRect),
    placement,
  }))
  const prevKeyRef = useRef(positionKey)
  const wasVisibleRef = useRef(visible)

  useLayoutEffect(() => {
    const keyChanged = prevKeyRef.current !== positionKey
    const becameVisible = visible && !wasVisibleRef.current
    prevKeyRef.current = positionKey
    wasVisibleRef.current = visible

    if (visible && (keyChanged || becameVisible)) {
      setLocked({
        anchorRect: cloneRect(anchorRect),
        placement,
      })
    }
  }, [positionKey, visible, anchorRect, placement])

  useLayoutEffect(() => {
    const shell = shellRef.current
    const bar = barRef.current
    if (!shell || !bar) return

    const update = () => {
      const shellW = shell.clientWidth
      const shellHeight = shell.clientHeight
      if (shellHeight > 0) setShellH(shellHeight)
      const barW = bar.offsetWidth
      if (shellW > 0 && barW > 0) {
        setBarHalfWidthNorm(barW / shellW / 2)
      }
      const availableW = shellW - EDGE_PAD_PX * 2
      if (barW > availableW && barW > 0) {
        setScale(Math.max(0.82, availableW / barW))
      } else {
        setScale(1)
      }
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(bar)
    observer.observe(shell)
    return () => observer.disconnect()
  }, [children, locked])

  const barStyle = useMemo(
    () =>
      buildBarStyle(
        locked.anchorRect,
        locked.placement,
        shellH > 0 ? shellH : 600,
        scale,
        barHalfWidthNorm,
      ),
    [locked, shellH, scale, barHalfWidthNorm],
  )

  return (
    <div
      ref={shellRef}
      className="pointer-events-none absolute inset-0 z-[45] overflow-visible"
      data-selection-context-bar
    >
      <div
        ref={barRef}
        role="toolbar"
        aria-label={ariaLabel}
        aria-hidden={!visible}
        className={cn(
          'absolute',
          SELECTION_CONTEXT_BAR_SURFACE,
          SELECTION_CONTEXT_BAR_LAYOUT,
          'transition-opacity duration-150 ease-out motion-reduce:transition-none',
          visible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
          'before:pointer-events-none before:absolute before:left-1/2 before:z-10 before:h-2.5 before:w-2.5 before:-translate-x-1/2 before:rotate-45 before:border before:border-[#3f3f46] before:bg-[#2a2a2e] before:shadow-[0_1px_2px_rgba(0,0,0,0.2)]',
          locked.placement === 'above'
            ? 'before:-bottom-[5px] before:border-t-0 before:border-l-0'
            : 'before:-top-[5px] before:border-b-0 before:border-r-0',
          className,
        )}
        style={barStyle}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

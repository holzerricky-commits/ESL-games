'use client'

import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface SpreadCanvasWrapperProps {
  spreadOverlayWidthPx: number
  pageCanvasHeightPx: number
  className?: string
  style?: CSSProperties
  children: ReactNode
}

/**
 * Rigid flex row for open-spread page slots — left and right pages sit flush side-by-side
 * (width = 2× spreadPageWidth when overlap is disabled).
 */
export function SpreadCanvasWrapper({
  spreadOverlayWidthPx,
  pageCanvasHeightPx,
  className,
  style,
  children,
}: SpreadCanvasWrapperProps) {
  return (
    <div
      className={cn(
        'relative flex shrink-0 grow-0 items-start justify-start overflow-visible leading-none',
        className,
      )}
      style={{
        boxSizing: 'border-box',
        position: 'relative',
        display: 'flex',
        width: spreadOverlayWidthPx,
        minWidth: spreadOverlayWidthPx,
        maxWidth: spreadOverlayWidthPx,
        height: pageCanvasHeightPx,
        minHeight: pageCanvasHeightPx,
        flexShrink: 0,
        flexGrow: 0,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

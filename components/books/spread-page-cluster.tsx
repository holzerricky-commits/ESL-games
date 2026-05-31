'use client'

import type { ReactNode, RefObject } from 'react'
import { cn } from '@/lib/utils'

export interface SpreadPageClusterProps {
  spreadOverlayWidthPx: number
  pageCanvasHeightPx: number
  gutterPullPx: number
  leftPage: ReactNode
  rightPage?: ReactNode | null
  /** Raise one spread slot above the overlapping page at the gutter (lesson board slot). */
  elevatedSlot?: 'left' | 'right' | null
  gridRef?: RefObject<HTMLDivElement | null>
  className?: string
  /** Absolutely positioned overlay (e.g. spread stroke capture) inside the cluster. */
  children?: ReactNode
}

/**
 * Two-page spread: full-width pages, right page pulled left at the seam only.
 * Cluster width = 2×pageWidth − gutterPullPx (outer edges of both pages stay visible).
 */
export function SpreadPageCluster({
  spreadOverlayWidthPx,
  pageCanvasHeightPx,
  gutterPullPx,
  leftPage,
  rightPage,
  elevatedSlot = null,
  gridRef,
  className,
  children,
}: SpreadPageClusterProps) {
  if (rightPage == null) {
    return <div className={cn('relative inline-block', className)}>{leftPage}</div>
  }

  return (
    <div
      ref={gridRef}
      className={cn('relative inline-flex w-max max-w-full items-start leading-none', className)}
      style={{
        minHeight: pageCanvasHeightPx,
        height: pageCanvasHeightPx,
        width: spreadOverlayWidthPx,
      }}
    >
      <div className={cn('shrink-0', elevatedSlot === 'left' && 'relative z-10')}>{leftPage}</div>
      <div
        className={cn('shrink-0', elevatedSlot === 'right' && 'relative z-10')}
        style={{ marginLeft: -gutterPullPx }}
      >
        {rightPage}
      </div>
      {children}
    </div>
  )
}

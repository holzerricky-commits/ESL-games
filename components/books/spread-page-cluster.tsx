'use client'

import type { ReactNode, RefObject } from 'react'
import { BookSpreadFrame } from '@/components/books/book-spread-frame'
import {
  SpreadCanvasWrapper,
} from '@/components/books/spread-canvas-wrapper'
import { cn } from '@/lib/utils'

export interface SpreadPageClusterProps {
  spreadOverlayWidthPx: number
  pageCanvasHeightPx: number
  spreadPageWidthPx: number
  gutterPullPx: number
  leftPage: ReactNode
  rightPage?: ReactNode | null
  /** Raise one spread slot above the overlapping page at the gutter (lesson board slot). */
  elevatedSlot?: 'left' | 'right' | null
  gridRef?: RefObject<HTMLDivElement | null>
  className?: string
  /** Thin open-book cover rim + gutter shadow around the spread. */
  showBookFrame?: boolean
  /** Dim cover + stacks + pages (Full board). Desk stays bright. */
  dimBook?: boolean
  /** Absolutely positioned overlay (e.g. spread stroke capture) inside the cluster. */
  children?: ReactNode
}

/**
 * Two-page spread: pages flush side-by-side (cluster width = 2× page width when overlap is off).
 */
export function SpreadPageCluster({
  spreadOverlayWidthPx,
  pageCanvasHeightPx,
  spreadPageWidthPx,
  gutterPullPx: _gutterPullPx,
  leftPage,
  rightPage,
  elevatedSlot = null,
  gridRef,
  className,
  showBookFrame = true,
  dimBook = false,
  children,
}: SpreadPageClusterProps) {
  if (rightPage == null) {
    const single = <div className={cn('relative inline-block', className)}>{leftPage}</div>
    if (!showBookFrame) {
      if (!children) return single
      return (
        <div className="relative inline-block">
          {single}
          {children}
        </div>
      )
    }
    return (
      <BookSpreadFrame
        contentWidthPx={spreadOverlayWidthPx}
        contentHeightPx={pageCanvasHeightPx}
        spreadPageWidthPx={spreadPageWidthPx}
        twoPage={false}
        dimBook={dimBook}
        overlayChildren={children}
      >
        {single}
      </BookSpreadFrame>
    )
  }

  const cluster = (
    <div
      ref={gridRef}
      className={cn('relative shrink-0 grow-0 leading-none', className)}
      style={{
        boxSizing: 'border-box',
        position: 'relative',
        width: spreadOverlayWidthPx,
        minWidth: spreadOverlayWidthPx,
        maxWidth: spreadOverlayWidthPx,
        minHeight: pageCanvasHeightPx,
        height: pageCanvasHeightPx,
        flexShrink: 0,
        flexGrow: 0,
      }}
    >
      <SpreadCanvasWrapper
        spreadOverlayWidthPx={spreadOverlayWidthPx}
        pageCanvasHeightPx={pageCanvasHeightPx}
      >
        <div className={cn('shrink-0 grow-0', elevatedSlot === 'left' && 'relative z-10')}>
          {leftPage}
        </div>
        <div className={cn('shrink-0 grow-0', elevatedSlot === 'right' && 'relative z-10')}>
          {rightPage}
        </div>
      </SpreadCanvasWrapper>
      {!showBookFrame && children ? children : null}
    </div>
  )

  if (!showBookFrame) return cluster

  return (
    <BookSpreadFrame
      contentWidthPx={spreadOverlayWidthPx}
      contentHeightPx={pageCanvasHeightPx}
      spreadPageWidthPx={spreadPageWidthPx}
      twoPage
      dimBook={dimBook}
      overlayChildren={children}
    >
      {cluster}
    </BookSpreadFrame>
  )
}

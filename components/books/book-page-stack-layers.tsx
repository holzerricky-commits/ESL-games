'use client'

import type { CSSProperties } from 'react'
import {
  bookForeEdgeStackSideBleedPx,
  bookForeEdgeStackStripColors,
  bookForeEdgeStackStripShadow,
  bookForeEdgeStackVerticalStripStyle,
  FORE_EDGE_STACK_SHEET_COUNT,
  FORE_EDGE_STRIP_WIDTH_PX,
  readerPageBulgeClipPathWithForeEdgeBleed,
  type BookPageBulgeSide,
} from '@/lib/books/book-page-stack-layer'

export type BookPageStackLayersProps = {
  side: BookPageBulgeSide
  widthPx: number
  heightPx: number
}

/**
 * Fore-edge page fan — vertical strips on the outer edge,
 * clipped to the page arch with bleed for the outward fan zone.
 */
export function BookPageStackLayers({ side, widthPx, heightPx }: BookPageStackLayersProps) {
  const stripColors = bookForeEdgeStackStripColors()
  const bleedPx = bookForeEdgeStackSideBleedPx()
  const wrapperWidthPx = widthPx + bleedPx

  const wrapperStyle: CSSProperties =
    side === 'left'
      ? {
          position: 'absolute',
          left: -bleedPx,
          top: 0,
          width: wrapperWidthPx,
          height: heightPx,
          clipPath: readerPageBulgeClipPathWithForeEdgeBleed(side, widthPx, heightPx, bleedPx),
        }
      : {
          position: 'absolute',
          left: 0,
          top: 0,
          width: wrapperWidthPx,
          height: heightPx,
          clipPath: readerPageBulgeClipPathWithForeEdgeBleed(side, widthPx, heightPx, bleedPx),
        }

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[1] overflow-visible"
      style={{ width: widthPx, height: heightPx }}
    >
      <div aria-hidden className="pointer-events-none overflow-visible" style={wrapperStyle}>
        {Array.from({ length: FORE_EDGE_STACK_SHEET_COUNT }, (_, sheetIndex) => {
          const verticalAnchor = bookForeEdgeStackVerticalStripStyle(
            side,
            sheetIndex,
            bleedPx,
            heightPx,
          )
          const verticalStyle: CSSProperties = {
            position: 'absolute',
            width: FORE_EDGE_STRIP_WIDTH_PX,
            backgroundColor: stripColors[sheetIndex],
            boxShadow: bookForeEdgeStackStripShadow(side, sheetIndex),
            ...verticalAnchor,
          }

          return <div key={`fore-edge-v-${sheetIndex}`} aria-hidden style={verticalStyle} />
        })}
      </div>
    </div>
  )
}

'use client'

import type { CSSProperties } from 'react'
import {
  spreadTurnFoldLightingEndBackground,
  spreadTurnFoldLightingOverlayOpacity,
  spreadTurnFoldLightingTransition,
} from '@/lib/books/spread-turn-fold'
import { SPREAD_TURN_SLIDE_MS, type SpreadTurnDirection } from '@/lib/books/spread-turn-slide-config'

export interface SpreadTurnFoldLightingOverlayProps {
  foldDirection: SpreadTurnDirection
  foldTransitionActive: boolean
}

/**
 * Phase 3/bugfix — multiply shadow on opaque paper (never fades the page itself).
 */
export function SpreadTurnFoldLightingOverlay({
  foldDirection,
  foldTransitionActive,
}: SpreadTurnFoldLightingOverlayProps) {
  const style: CSSProperties = {
    background: spreadTurnFoldLightingEndBackground(foldDirection),
    opacity: spreadTurnFoldLightingOverlayOpacity(foldTransitionActive),
    mixBlendMode: 'multiply',
    willChange: 'opacity',
    transition: spreadTurnFoldLightingTransition(SPREAD_TURN_SLIDE_MS),
  }

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[2] motion-reduce:transition-none"
      style={style}
    />
  )
}

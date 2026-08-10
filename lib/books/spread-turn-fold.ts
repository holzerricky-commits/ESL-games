import type { SpreadTurnDirection } from '@/lib/books/spread-turn-slide-config'
import { SPREAD_TURN_SLIDE_MS } from '@/lib/books/spread-turn-slide-config'

/** Compressed width at the spine during the 2.5D fold (scaleX). */
export const SPREAD_TURN_FOLD_SCALE_X = 0.15

/** Skew magnitude (degrees) for the page curl illusion. */
export const SPREAD_TURN_FOLD_SKEW_DEG = 6

/** Solid paper fill — matches reader page slots (`#FDFCFB`). */
export const SPREAD_TURN_PAGE_PAPER_COLOR = '#FDFCFB'

/** Under-shadow overlay peak opacity (paper stays opaque; shadow darkens on top). */
export const SPREAD_TURN_FOLD_LIGHTING_END_OPACITY = 0.6

export const SPREAD_TURN_FOLD_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'

export type SpreadTurnFoldPageSide = 'left' | 'right'

/** Which page hinges away from the spine on this turn direction. */
export function spreadTurnFoldingPageSide(direction: SpreadTurnDirection): SpreadTurnFoldPageSide {
  return direction === 1 ? 'right' : 'left'
}

/** Hinge at the binding seam — left edge for right page, right edge for left page. */
export function spreadTurnFoldTransformOrigin(side: SpreadTurnFoldPageSide): string {
  return side === 'right' ? 'left center' : 'right center'
}

/** Spine X for a full-spread capture overlay (px from left). */
export function spreadTurnFoldSpineOriginX(spreadPageWidthPx: number, hasRightPage: boolean): string {
  if (!hasRightPage) {
    return spreadTurnFoldTransformOrigin('left')
  }
  return `${spreadPageWidthPx}px center`
}

export function spreadTurnFoldStartTransform(): string {
  return 'none'
}

/** End-of-turn curl: compress toward spine + directional skew. */
export function spreadTurnFoldEndTransform(direction: SpreadTurnDirection): string {
  const skewDeg = direction === 1 ? -SPREAD_TURN_FOLD_SKEW_DEG : SPREAD_TURN_FOLD_SKEW_DEG
  return `scaleX(${SPREAD_TURN_FOLD_SCALE_X}) skewY(${skewDeg}deg)`
}

export function spreadTurnFoldTransitionActive(ms: number = SPREAD_TURN_SLIDE_MS): string {
  return `transform ${ms}ms ${SPREAD_TURN_FOLD_EASING}`
}

export function spreadTurnFoldTransitionNone(): string {
  return 'none'
}

/** Opaque page shell — never fade the paper during a fold. */
export function spreadTurnFoldPageSurfaceStyle(): {
  backgroundColor: string
  opacity: number
} {
  return {
    backgroundColor: SPREAD_TURN_PAGE_PAPER_COLOR,
    opacity: 1,
  }
}

/** Inner shadow sweep — transparent at spine, darkest at lifting outer edge. */
export const SPREAD_TURN_FOLD_LIGHTING_GRADIENT_FORWARD =
  'linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.5) 100%)'

export const SPREAD_TURN_FOLD_LIGHTING_GRADIENT_BACKWARD =
  'linear-gradient(270deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.5) 100%)'

export function spreadTurnFoldLightingGradient(direction: SpreadTurnDirection): string {
  return direction === 1
    ? SPREAD_TURN_FOLD_LIGHTING_GRADIENT_FORWARD
    : SPREAD_TURN_FOLD_LIGHTING_GRADIENT_BACKWARD
}

export function spreadTurnFoldLightingEndBackground(direction: SpreadTurnDirection): string {
  return spreadTurnFoldLightingGradient(direction)
}

export function spreadTurnFoldLightingOverlayOpacity(active: boolean): number {
  return active ? SPREAD_TURN_FOLD_LIGHTING_END_OPACITY : 0
}

/** Shadow sweep on the paper surface (260ms fold timeline). */
export function spreadTurnFoldLightingTransition(ms: number = SPREAD_TURN_SLIDE_MS): string {
  return `opacity ${ms}ms ${SPREAD_TURN_FOLD_EASING}`
}

/** Spread-normalized rectangle (0…1 across full two-page spread width). */
export type SpreadNormRect = {
  x: number
  y: number
  w: number
  h: number
}

export type BookFocusZoomPhase = 'off' | 'draw' | 'active'

export type FocusHoleRect = {
  x: number
  y: number
  w: number
  h: number
}

/** Session-only focus box remembered per spread page number (Phase 4). */
export type FocusZoomPageZone = {
  pageNumber: number
  normRect: SpreadNormRect
}

/** Layout for CSS transform + dim overlay hole (pageArea coordinates). */
export type FocusSpreadLayout = {
  translateX: number
  translateY: number
  /** Combined spreadDisplayScale × focus multiplier. */
  scale: number
  holeRect: FocusHoleRect
  /** Extra pan on top of base translate (Phase 4). */
  panX: number
  panY: number
}

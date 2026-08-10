/** Soft concave valley — wide blends, no harsh vertical bands. */
export const BOOK_SPINE_GUTTER_CONCAVE_GRADIENT = `linear-gradient(
  90deg,
  rgba(0, 0, 0, 0.3) 0%,
  rgba(0, 0, 0, 0.05) 15%,
  transparent 40%,
  rgba(0, 0, 0, 0.5) 50%,
  transparent 60%,
  rgba(0, 0, 0, 0.05) 85%,
  rgba(0, 0, 0, 0.3) 100%
)`

/** Head/tail recess — spine cloth dips behind flat board plane at top and bottom center only. */
export const BOOK_SPINE_GUTTER_HEAD_TAIL_DIP_PX = 6

/** Height of the bottom contact band used for desk shadows along the concave edge. */
export const BOOK_SPINE_GUTTER_BOTTOM_CONTACT_BAND_PX = 12

/**
 * Normalized spine silhouette for SVG `clipPathUnits="objectBoundingBox"`.
 * Vertical sides stay at x=0 and x=1; only top/bottom bow inward at center.
 */
export const BOOK_SPINE_GUTTER_SILHOUETTE_PATH_OBJECT_BOX =
  'M 0,0 Q 0.5,0.015 1,0 L 1,1 Q 0.5,0.985 0,1 Z'

/** SVG path `d` in spine-strip local px — straight vertical joints, curved head/tail only. */
export function bookSpineGutterSilhouettePathData(
  widthPx: number,
  heightPx: number,
  dipPx: number = BOOK_SPINE_GUTTER_HEAD_TAIL_DIP_PX,
): string {
  const w = Math.max(0, widthPx)
  const h = Math.max(0, heightPx)
  const dip = Math.min(Math.max(0, dipPx), h / 2, w / 2)
  const midX = w / 2
  const bottomDipY = h - dip

  return `M 0 0 Q ${midX} ${dip} ${w} 0 L ${w} ${h} Q ${midX} ${bottomDipY} 0 ${h} Z`
}

/** CSS `clip-path: path(...)` for the spine gutter strip element. */
export function bookSpineGutterSilhouetteClipPath(
  widthPx: number,
  heightPx: number,
  dipPx: number = BOOK_SPINE_GUTTER_HEAD_TAIL_DIP_PX,
): string {
  if (widthPx <= 0 || heightPx <= 0) return 'none'

  const d = bookSpineGutterSilhouettePathData(widthPx, heightPx, dipPx)
  return `path('${d}')`
}

/**
 * Bottom contact band — straight top at `h - band`, concave bottom edge matching the spine dip.
 * Casts desk contact from the gutter foot only (not the full strip body).
 */
export function bookSpineGutterBottomContactPathData(
  widthPx: number,
  heightPx: number,
  bandPx: number = BOOK_SPINE_GUTTER_BOTTOM_CONTACT_BAND_PX,
  dipPx: number = BOOK_SPINE_GUTTER_HEAD_TAIL_DIP_PX,
): string {
  const w = Math.max(0, widthPx)
  const h = Math.max(0, heightPx)
  const band = Math.min(Math.max(4, bandPx), h)
  const dip = Math.min(Math.max(0, dipPx), h / 2, w / 2)
  const midX = w / 2
  const bottomDipY = h - dip
  const bandTop = h - band

  return `M 0 ${bandTop} L 0 ${h} Q ${midX} ${bottomDipY} ${w} ${h} L ${w} ${bandTop} Z`
}

/** Bottom concave edge only — casts a bent desk shadow along the spine dip. */
export function bookSpineGutterBottomConcaveEdgePathData(
  widthPx: number,
  heightPx: number,
  dipPx: number = BOOK_SPINE_GUTTER_HEAD_TAIL_DIP_PX,
): string {
  const w = Math.max(0, widthPx)
  const h = Math.max(0, heightPx)
  const dip = Math.min(Math.max(0, dipPx), h / 2, w / 2)
  const midX = w / 2
  const bottomDipY = h - dip

  return `M 0 ${h} Q ${midX} ${bottomDipY} ${w} ${h}`
}

/** CSS `clip-path` for spine gutter bottom contact shadow band. */
export function bookSpineGutterBottomContactClipPath(
  widthPx: number,
  heightPx: number,
  bandPx: number = BOOK_SPINE_GUTTER_BOTTOM_CONTACT_BAND_PX,
  dipPx: number = BOOK_SPINE_GUTTER_HEAD_TAIL_DIP_PX,
): string {
  if (widthPx <= 0 || heightPx <= 0) return 'none'

  const d = bookSpineGutterBottomContactPathData(widthPx, heightPx, bandPx, dipPx)
  return `path('${d}')`
}

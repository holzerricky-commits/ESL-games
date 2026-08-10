import { bulgeHorizontalEdgePoints } from '@/lib/books/reader-page-bulge-clip'

export type HardcoverShellClipOptions = {
  widthPx: number
  heightPx: number
  spineCenterPx: number
  bottomCornerRadiusPx: number
  twoPage: boolean
}

function roundedRectPath(w: number, h: number, br: number): string {
  const r = Math.max(0, br)
  if (r <= 0) return `M 0 0 H ${w} V ${h} H 0 Z`
  return `M 0 0 H ${w} V ${h - r} Q ${w} ${h} ${w - r} ${h} H ${r} Q 0 ${h} 0 ${h - r} Z`
}

/**
 * Hardcover outer silhouette — curved head/tail caps at the spine on two-page spreads,
 * rounded fore-edge bottom corners, shared with page bulge geometry.
 */
export function hardcoverShellClipPath({
  widthPx: w,
  heightPx: h,
  spineCenterPx,
  bottomCornerRadiusPx: br,
  twoPage,
}: HardcoverShellClipOptions): string {
  const radius = Math.max(0, br)

  if (!twoPage) {
    return `path('${roundedRectPath(w, h, radius)}')`
  }

  const top = bulgeHorizontalEdgePoints({
    widthPx: w,
    spineCenterPx,
    edge: 'top',
    heightPx: h,
  })
  const bottom = bulgeHorizontalEdgePoints({
    widthPx: w,
    spineCenterPx,
    edge: 'bottom',
    heightPx: h,
  })

  let d = `M ${top[0]!.x} ${top[0]!.y}`
  for (let i = 1; i < top.length; i++) {
    d += ` L ${top[i]!.x} ${top[i]!.y}`
  }

  if (radius > 0) {
    d += ` L ${w} ${h - radius} Q ${w} ${h} ${w - radius} ${h}`
  } else {
    d += ` L ${w} ${h}`
  }

  for (let i = bottom.length - 2; i >= 1; i--) {
    d += ` L ${bottom[i]!.x} ${bottom[i]!.y}`
  }

  if (radius > 0) {
    d += ` L ${radius} ${h} Q 0 ${h} 0 ${h - radius}`
  } else {
    d += ` L 0 ${h}`
  }

  d += ` L ${top[0]!.x} ${top[0]!.y} Z`

  return `path('${d}')`
}

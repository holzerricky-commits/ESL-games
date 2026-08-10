import type {
  FocusHoleRect,
  FocusSpreadLayout,
  SpreadNormRect,
} from '@/lib/books/focus-zoom-types'

export const BOOK_FOCUS_ZOOM_FILL = 0.92
/** Minimum spread-normalized width/height for a focus box. */
export const BOOK_FOCUS_ZOOM_MIN_NORM_SIZE = 0.02

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

export function normalizeSpreadNormRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  minSize = BOOK_FOCUS_ZOOM_MIN_NORM_SIZE,
): SpreadNormRect | null {
  const x = clamp01(Math.min(x1, x2))
  const y = clamp01(Math.min(y1, y2))
  const xMax = clamp01(Math.max(x1, x2))
  const yMax = clamp01(Math.max(y1, y2))
  const w = xMax - x
  const h = yMax - y
  if (w < minSize || h < minSize) return null
  return { x, y, w, h }
}

/** Map pointer position to spread-normalized coords using the spread element's screen rect. */
export function clientToSpreadNormFromRect(
  spreadRect: Pick<DOMRectReadOnly, 'left' | 'top' | 'width' | 'height'>,
  clientX: number,
  clientY: number,
): [number, number] {
  const w = spreadRect.width
  const h = spreadRect.height
  if (!(w > 0) || !(h > 0)) return [0, 0]
  return [
    clamp01((clientX - spreadRect.left) / w),
    clamp01((clientY - spreadRect.top) / h),
  ]
}

export function spreadNormRectFromClientDrag(
  spreadRect: Pick<DOMRectReadOnly, 'left' | 'top' | 'width' | 'height'>,
  clientX1: number,
  clientY1: number,
  clientX2: number,
  clientY2: number,
): SpreadNormRect | null {
  const [nx1, ny1] = clientToSpreadNormFromRect(spreadRect, clientX1, clientY1)
  const [nx2, ny2] = clientToSpreadNormFromRect(spreadRect, clientX2, clientY2)
  return normalizeSpreadNormRect(nx1, ny1, nx2, ny2)
}

/**
 * Ideal WYSIWYG hole: matches the selected region's screen aspect ratio, scaled to fit in pageArea × fill.
 */
export function focusZoomHoleForRegion(params: {
  pageAreaW: number
  pageAreaH: number
  spreadW: number
  spreadH: number
  baseScale: number
  normRect: SpreadNormRect
  fill?: number
}): FocusHoleRect | null {
  const { pageAreaW, pageAreaH, spreadW, spreadH, baseScale, normRect, fill = BOOK_FOCUS_ZOOM_FILL } =
    params
  if (!(pageAreaW > 0) || !(pageAreaH > 0) || !(spreadW > 0) || !(spreadH > 0)) return null
  if (!(baseScale > 0) || !(normRect.w > 0) || !(normRect.h > 0)) return null

  const regionScreenW = normRect.w * spreadW * baseScale
  const regionScreenH = normRect.h * spreadH * baseScale
  if (!(regionScreenW > 0) || !(regionScreenH > 0)) return null

  const maxW = pageAreaW * fill
  const maxH = pageAreaH * fill
  const aspect = regionScreenW / regionScreenH

  let holeW: number
  let holeH: number
  if (maxW / maxH >= aspect) {
    holeH = maxH
    holeW = maxH * aspect
  } else {
    holeW = maxW
    holeH = maxW / aspect
  }

  return {
    x: (pageAreaW - holeW) / 2,
    y: (pageAreaH - holeH) / 2,
    w: holeW,
    h: holeH,
  }
}

/**
 * Compute translate + scale so `normRect` exactly fills the WYSIWYG hole (same aspect as the selection).
 * No max-extra ceiling — scale is whatever is needed to fill pageArea × fill.
 * Assumes the transformed element is the page cluster (content-sized), origin 0,0 = spread top-left.
 */
export function computeFocusSpreadLayout(params: {
  pageAreaW: number
  pageAreaH: number
  spreadW: number
  spreadH: number
  baseScale: number
  normRect: SpreadNormRect
  fill?: number
}): FocusSpreadLayout | null {
  const {
    pageAreaW,
    pageAreaH,
    spreadW,
    spreadH,
    baseScale,
    normRect,
    fill = BOOK_FOCUS_ZOOM_FILL,
  } = params

  if (!(pageAreaW > 0) || !(pageAreaH > 0) || !(spreadW > 0) || !(spreadH > 0)) return null
  if (!(baseScale > 0) || !(normRect.w > 0) || !(normRect.h > 0)) return null

  const holeRect = focusZoomHoleForRegion({
    pageAreaW,
    pageAreaH,
    spreadW,
    spreadH,
    baseScale,
    normRect,
    fill,
  })
  if (!holeRect) return null

  const regionScreenW = normRect.w * spreadW * baseScale
  const regionScreenH = normRect.h * spreadH * baseScale
  if (!(regionScreenW > 0) || !(regionScreenH > 0)) return null

  const focusMultiplier = Math.min(holeRect.w / regionScreenW, holeRect.h / regionScreenH)
  const scale = baseScale * focusMultiplier

  const regionOriginSpreadX = normRect.x * spreadW
  const regionOriginSpreadY = normRect.y * spreadH

  return {
    translateX: holeRect.x - regionOriginSpreadX * scale,
    translateY: holeRect.y - regionOriginSpreadY * scale,
    scale,
    holeRect,
    panX: 0,
    panY: 0,
  }
}

/**
 * Clamp pan so the focus hole always shows spread content (Phase 4).
 * When the scaled spread is smaller than the hole, pan locks to centered axes.
 */
export function clampFocusPanOffset(params: {
  baseLayout: Pick<FocusSpreadLayout, 'translateX' | 'translateY' | 'scale' | 'holeRect'>
  spreadW: number
  spreadH: number
  panX: number
  panY: number
}): { panX: number; panY: number } {
  const { baseLayout, spreadW, spreadH } = params
  const { translateX, translateY, scale, holeRect } = baseLayout
  if (!(scale > 0) || !(spreadW > 0) || !(spreadH > 0)) {
    return { panX: 0, panY: 0 }
  }

  const spreadScreenW = spreadW * scale
  const spreadScreenH = spreadH * scale

  const clampAxis = (
    base: number,
    pan: number,
    holeStart: number,
    holeSize: number,
    spreadScreenSize: number,
  ): { value: number; pan: number } => {
    let tx = base + pan
    if (spreadScreenSize <= holeSize) {
      tx = holeStart + (holeSize - spreadScreenSize) / 2
    } else {
      const minTx = holeStart + holeSize - spreadScreenSize
      const maxTx = holeStart
      tx = Math.max(minTx, Math.min(maxTx, tx))
    }
    return { value: tx, pan: tx - base }
  }

  const x = clampAxis(translateX, params.panX, holeRect.x, holeRect.w, spreadScreenW)
  const y = clampAxis(translateY, params.panY, holeRect.y, holeRect.h, spreadScreenH)
  return { panX: x.pan, panY: y.pan }
}

/** Merge base layout with clamped pan for CSS transform. */
export function focusSpreadLayoutWithPan(
  baseLayout: FocusSpreadLayout,
  spreadW: number,
  spreadH: number,
  panX: number,
  panY: number,
): FocusSpreadLayout {
  const clamped = clampFocusPanOffset({
    baseLayout,
    spreadW,
    spreadH,
    panX,
    panY,
  })
  return {
    ...baseLayout,
    panX: clamped.panX,
    panY: clamped.panY,
    translateX: baseLayout.translateX + clamped.panX,
    translateY: baseLayout.translateY + clamped.panY,
  }
}

export function focusHoleRectToCaptureRegion(holeRect: FocusHoleRect): {
  x: number
  y: number
  width: number
  height: number
} {
  return { x: holeRect.x, y: holeRect.y, width: holeRect.w, height: holeRect.h }
}

/**
 * Prefer live DOM measurement (includes focus CSS transform) over computed scale.
 * Used for pen pattern origins and seam math while focus zoom is active.
 */
export function measuredSpreadScreenScale(
  spreadRect: Pick<DOMRectReadOnly, 'width'> | null | undefined,
  spreadLogicalWidthPx: number,
  fallbackScale: number,
): number {
  if (spreadRect && spreadLogicalWidthPx > 0 && spreadRect.width > 0) {
    return spreadRect.width / spreadLogicalWidthPx
  }
  if (Number.isFinite(fallbackScale) && fallbackScale > 0) return fallbackScale
  return 1
}

/** Screen-space client point → spread-normalized (post-transform rect). */
export function clientPointToSpreadNorm(
  spreadRect: Pick<DOMRectReadOnly, 'left' | 'top' | 'width' | 'height'>,
  clientX: number,
  clientY: number,
): [number, number] {
  return clientToSpreadNormFromRect(spreadRect, clientX, clientY)
}

/**
 * CSS clip-path for a single spotlight dim layer: full page with a rectangular hole cut out.
 * Uses even-odd fill so clicks inside the hole pass through to the spread below.
 */
export function focusZoomSpotlightClipPath(
  hole: Pick<FocusHoleRect, 'x' | 'y' | 'w' | 'h'> | null,
  pageW: number,
  pageH: number,
): string | undefined {
  if (!(pageW > 0) || !(pageH > 0)) return undefined
  if (!hole || hole.w <= 0 || hole.h <= 0) return undefined

  const { x, y, w, h } = hole
  const px = (n: number) => `${(n / pageW) * 100}%`
  const py = (n: number) => `${(n / pageH) * 100}%`

  return [
    'polygon(evenodd,',
    '0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,',
    `${px(x)} ${py(y)},`,
    `${px(x)} ${py(y + h)},`,
    `${px(x + w)} ${py(y + h)},`,
    `${px(x + w)} ${py(y)},`,
    `${px(x)} ${py(y)})`,
  ].join(' ')
}

/** Map a pageArea-local hole to viewport (client) coordinates. */
export function holeRectToClientRect(
  hole: Pick<FocusHoleRect, 'x' | 'y' | 'w' | 'h'>,
  pageAreaRect: Pick<DOMRectReadOnly, 'left' | 'top'>,
): { left: number; top: number; width: number; height: number } {
  return {
    left: pageAreaRect.left + hole.x,
    top: pageAreaRect.top + hole.y,
    width: hole.w,
    height: hole.h,
  }
}

/**
 * Full-viewport theater scrim clip-path (`absolute inset-0` on the overlay root).
 * `clientHole` is in viewport pixels; `containerRect` is the overlay root's bounding rect.
 */
export function focusZoomTheaterClipPath(
  clientHole: { left: number; top: number; width: number; height: number },
  containerRect: Pick<DOMRectReadOnly, 'left' | 'top' | 'width' | 'height'>,
): string | undefined {
  const { width: cW, height: cH, left: cLeft, top: cTop } = containerRect
  if (!(cW > 0) || !(cH > 0) || clientHole.width <= 0 || clientHole.height <= 0) {
    return undefined
  }
  const hx = clientHole.left - cLeft
  const hy = clientHole.top - cTop
  const hw = clientHole.width
  const hh = clientHole.height
  const px = (n: number) => `${(n / cW) * 100}%`
  const py = (n: number) => `${(n / cH) * 100}%`
  return [
    'polygon(evenodd,',
    '0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,',
    `${px(hx)} ${py(hy)},`,
    `${px(hx)} ${py(hy + hh)},`,
    `${px(hx + hw)} ${py(hy + hh)},`,
    `${px(hx + hw)} ${py(hy)},`,
    `${px(hx)} ${py(hy)})`,
  ].join(' ')
}

/** Spread-normalized point → pageArea/client coords (inverse of clientPointToSpreadNorm). */
export function spreadNormPointToClient(
  spreadRect: Pick<DOMRectReadOnly, 'left' | 'top' | 'width' | 'height'>,
  nx: number,
  ny: number,
): [number, number] {
  return [
    spreadRect.left + clamp01(nx) * spreadRect.width,
    spreadRect.top + clamp01(ny) * spreadRect.height,
  ]
}

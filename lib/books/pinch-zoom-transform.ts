/** App-owned pinch zoom on the book spread (replaces browser visual-viewport pinch). */
/** Resting “fit the reading area” scale — reset / page-turn target. */
export const BOOK_PINCH_ZOOM_FIT_SCALE = 1
/** Mild shrink below fit (desk breathing room). Do not go much lower for screen-share readability. */
export const BOOK_PINCH_ZOOM_MIN_SCALE = 0.75
export const BOOK_PINCH_ZOOM_MAX_SCALE = 3
/** Lower = less sensitive; needs more pinch travel per zoom step. */
export const BOOK_PINCH_ZOOM_WHEEL_EXP_FACTOR = 0.0045
/** Button chrome step ≈ one discrete zoom notch (negative deltaY = zoom in). */
export const BOOK_PINCH_ZOOM_STEP_WHEEL_DELTA = 120
/**
 * Cap |deltaY| from trackpad pinch bursts so one OS event cannot jump scale wildly.
 * Buttons pass `clampWheelDelta: false` and keep full step size.
 */
export const BOOK_PINCH_ZOOM_MAX_WHEEL_DELTA = 48

export type PinchZoomState = {
  scale: number
  /** Pan offset from the resting centered position (pageArea-local). */
  panX: number
  panY: number
}

export function isPinchZoomActive(state: PinchZoomState): boolean {
  if (Math.abs(state.scale - BOOK_PINCH_ZOOM_FIT_SCALE) > 1e-6) return true
  return Math.abs(state.panX) > 0.5 || Math.abs(state.panY) > 0.5
}

export function defaultPinchZoomState(): PinchZoomState {
  return { scale: BOOK_PINCH_ZOOM_FIT_SCALE, panX: 0, panY: 0 }
}

export function pinchZoomFactorFromWheelDelta(deltaY: number): number {
  if (!Number.isFinite(deltaY)) return 1
  return Math.exp(-deltaY * BOOK_PINCH_ZOOM_WHEEL_EXP_FACTOR)
}

/** Soften chunky trackpad pinch pulses before they change scale. */
export function clampPinchZoomWheelDelta(
  deltaY: number,
  maxAbs: number = BOOK_PINCH_ZOOM_MAX_WHEEL_DELTA,
): number {
  if (!Number.isFinite(deltaY)) return 0
  if (!(maxAbs > 0)) return deltaY
  return Math.max(-maxAbs, Math.min(maxAbs, deltaY))
}

export function clampPinchZoomPan(args: {
  panX: number
  panY: number
  scale: number
  spreadOuterW: number
  spreadOuterH: number
  pageAreaW: number
  pageAreaH: number
}): { panX: number; panY: number } {
  const { scale, spreadOuterW, spreadOuterH } = args
  if (!(scale > 0) || !(spreadOuterW > 0) || !(spreadOuterH > 0)) {
    return { panX: args.panX, panY: args.panY }
  }

  /**
   * Fit / shrink stay centered. Free pan is for zoomed-in teaching: slide an edge or
   * corner into the middle of the screen share (empty desk may show beside the page).
   */
  if (scale <= BOOK_PINCH_ZOOM_FIT_SCALE + 1e-6) {
    return { panX: 0, panY: 0 }
  }

  const halfW = (spreadOuterW * scale) / 2
  const halfH = (spreadOuterH * scale) / 2

  /** |pan| ≤ half-size ⇒ any book edge can sit on the screen center; never fully off-screen. */
  return {
    panX: Math.max(-halfW, Math.min(halfW, args.panX)),
    panY: Math.max(-halfH, Math.min(halfH, args.panY)),
  }
}

/** Keep scale across reading-area / spread size changes; only re-clamp pan. */
export function reclampPinchZoomState(args: {
  state: PinchZoomState
  spreadOuterW: number
  spreadOuterH: number
  pageAreaW: number
  pageAreaH: number
}): PinchZoomState {
  const scale = args.state.scale
  if (!(scale > 0)) return defaultPinchZoomState()
  const clamped = clampPinchZoomPan({
    panX: args.state.panX,
    panY: args.state.panY,
    scale,
    spreadOuterW: args.spreadOuterW,
    spreadOuterH: args.spreadOuterH,
    pageAreaW: args.pageAreaW,
    pageAreaH: args.pageAreaH,
  })
  return {
    scale,
    panX: clamped.panX,
    panY: clamped.panY,
  }
}

export function applyPinchZoomWheelAtClient(args: {
  state: PinchZoomState
  anchorX: number
  anchorY: number
  deltaY: number
  spreadOuterW: number
  spreadOuterH: number
  pageAreaW: number
  pageAreaH: number
  minScale?: number
  maxScale?: number
  /** When false, use raw deltaY (chrome +/- buttons). Trackpad pinch keeps the clamp. */
  clampWheelDelta?: boolean
}): PinchZoomState {
  const minScale = args.minScale ?? BOOK_PINCH_ZOOM_MIN_SCALE
  const maxScale = args.maxScale ?? BOOK_PINCH_ZOOM_MAX_SCALE
  const oldScale = args.state.scale
  const deltaY =
    args.clampWheelDelta === false ? args.deltaY : clampPinchZoomWheelDelta(args.deltaY)
  const factor = pinchZoomFactorFromWheelDelta(deltaY)
  const newScale = Math.max(minScale, Math.min(maxScale, oldScale * factor))

  if (newScale <= minScale + 1e-6) {
    return { scale: minScale, panX: 0, panY: 0 }
  }

  /** Snap to exact fit when a step lands very near resting size (keeps % button/chrome clean). */
  if (Math.abs(newScale - BOOK_PINCH_ZOOM_FIT_SCALE) < 0.02) {
    return defaultPinchZoomState()
  }

  const centerX = args.pageAreaW / 2
  const centerY = args.pageAreaH / 2
  const localX = (args.anchorX - centerX - args.state.panX) / oldScale
  const localY = (args.anchorY - centerY - args.state.panY) / oldScale
  const unclampedPanX = args.anchorX - centerX - localX * newScale
  const unclampedPanY = args.anchorY - centerY - localY * newScale
  const clamped = clampPinchZoomPan({
    panX: unclampedPanX,
    panY: unclampedPanY,
    scale: newScale,
    spreadOuterW: args.spreadOuterW,
    spreadOuterH: args.spreadOuterH,
    pageAreaW: args.pageAreaW,
    pageAreaH: args.pageAreaH,
  })

  return {
    scale: newScale,
    panX: clamped.panX,
    panY: clamped.panY,
  }
}

export function applyPinchZoomPanWheel(args: {
  state: PinchZoomState
  deltaX: number
  deltaY: number
  spreadOuterW: number
  spreadOuterH: number
  pageAreaW: number
  pageAreaH: number
}): PinchZoomState | null {
  if (!isPinchZoomActive(args.state)) return null
  const clamped = clampPinchZoomPan({
    panX: args.state.panX - args.deltaX,
    panY: args.state.panY - args.deltaY,
    scale: args.state.scale,
    spreadOuterW: args.spreadOuterW,
    spreadOuterH: args.spreadOuterH,
    pageAreaW: args.pageAreaW,
    pageAreaH: args.pageAreaH,
  })
  return {
    scale: args.state.scale,
    panX: clamped.panX,
    panY: clamped.panY,
  }
}

/** CSS transform for pinch — keep spreadReaderPositionStyle; scale from book center. */
export function pinchZoomSpreadTransform(state: PinchZoomState): string | undefined {
  if (!isPinchZoomActive(state)) return undefined
  return `translate(${state.panX}px, ${state.panY}px) scale(${state.scale})`
}

/** Apply pinch transform directly on the spread wrapper (avoids React re-render per wheel tick). */
export function applyPinchZoomSpreadElementStyle(
  el: HTMLElement | null | undefined,
  state: PinchZoomState,
): void {
  if (!el) return
  const transform = pinchZoomSpreadTransform(state)
  if (!transform) {
    el.style.transform = ''
    el.style.transformOrigin = ''
    el.style.willChange = ''
    return
  }
  el.style.transform = transform
  el.style.transformOrigin = '50% 50%'
  el.style.willChange = 'transform'
}

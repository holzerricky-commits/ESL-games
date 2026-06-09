/** Squared distance (norm coords) before a duplicate sample is skipped. */
export const STROKE_POINT_MIN_DIST_SQ = 1e-8

/**
 * Blend toward each new sample from the previous point (0 = off, 1 = raw).
 * Light smoothing reduces mouse jitter without lagging far behind the stylus.
 */
export const STROKE_FREEHAND_SMOOTH_BLEND = 0.58

/** Pointer samples between frames (pen/tablet); falls back to the event itself. */
export function coalescedPointerEvents(e: PointerEvent): readonly PointerEvent[] {
  const coalesced = e.getCoalescedEvents?.()
  if (coalesced && coalesced.length > 0) return coalesced
  return [e]
}

export function appendNormPointsIfMoved(
  points: [number, number][],
  samples: readonly [number, number][],
  minDistSq = STROKE_POINT_MIN_DIST_SQ,
  smoothBlend = 0,
): void {
  for (const raw of samples) {
    const last = points[points.length - 1]
    if (last) {
      const dx = raw[0] - last[0]
      const dy = raw[1] - last[1]
      if (dx * dx + dy * dy < minDistSq) continue
    }
    let p: [number, number] = raw
    if (last && smoothBlend > 0 && points.length >= 2) {
      p = [
        last[0] + (raw[0] - last[0]) * smoothBlend,
        last[1] + (raw[1] - last[1]) * smoothBlend,
      ]
    }
    points.push(p)
  }
}

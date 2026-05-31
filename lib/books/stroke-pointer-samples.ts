/** Squared distance (norm coords) before a duplicate sample is skipped. */
export const STROKE_POINT_MIN_DIST_SQ = 1e-8

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
): void {
  for (const p of samples) {
    const last = points[points.length - 1]
    if (last) {
      const dx = p[0] - last[0]
      const dy = p[1] - last[1]
      if (dx * dx + dy * dy < minDistSq) continue
    }
    points.push(p)
  }
}

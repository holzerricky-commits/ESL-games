import type { StrokeTool } from '@/lib/books/annotation-command-types'

export type IncrementalStrokeDraftState = {
  tool: 'pen' | 'marker'
  pointsLength: number
}

/** Segment to append (includes overlap for pen quadratic joins). */
export function incrementalStrokeDraftSegmentPoints(
  points: readonly [number, number][],
  previousLength: number,
): [number, number][] {
  const start = Math.max(0, previousLength - 2)
  return points.slice(start) as [number, number][]
}

export function canIncrementallyAppendStrokeDraft(
  prev: IncrementalStrokeDraftState | null,
  draft: { tool: StrokeTool; points: readonly [number, number][] },
): boolean {
  if (!prev) return false
  if (draft.tool !== 'pen' && draft.tool !== 'marker') return false
  if (draft.tool !== prev.tool) return false
  if (draft.points.length <= prev.pointsLength) return false
  return true
}

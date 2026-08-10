import type { StrokeTool } from '@/lib/books/annotation-command-types'
import type { PenInkStyle } from '@/lib/books/pen-ink'
import {
  STROKE_FREEHAND_SMOOTH_BLEND,
  appendNormPointsIfMoved,
} from '@/lib/books/stroke-pointer-samples'
import { STROKE_TAP_MAX_DIST_SQ } from '@/lib/books/stroke-tap-dot'

export type StraightStrokeTool = Extract<StrokeTool, 'pen' | 'marker'>

export type StraightStrokeAxis = 'horizontal' | 'vertical'

/** Squared distance (norm coords) before the stroke axis is chosen from first movement. */
export const STRAIGHT_STROKE_LOCK_MIN_DIST_SQ = 1e-8

/** Whether the current stroke should stay a single straight segment (start → cursor). */
export function shouldUseStraightStrokeLine(args: {
  tool: StraightStrokeTool
  shiftKey: boolean
  straightFromHold?: boolean
  markerStraightStrokeEnabled?: boolean
  penInkStyle?: PenInkStyle
}): boolean {
  const straightInput = args.shiftKey || !!args.straightFromHold
  if (args.tool === 'marker') {
    return straightInput || !!args.markerStraightStrokeEnabled
  }
  if (args.penInkStyle && args.penInkStyle !== 'solid') {
    return false
  }
  return straightInput
}

/** Pick horizontal vs vertical from displacement (nearest axis). */
export function resolveStraightStrokeAxis(dx: number, dy: number): StraightStrokeAxis {
  return Math.abs(dx) >= Math.abs(dy) ? 'horizontal' : 'vertical'
}

/**
 * Lock axis from anchor→current once movement exceeds threshold.
 * Returns the existing axis if already locked.
 */
export function lockStraightStrokeAxis(
  locked: StraightStrokeAxis | null,
  anchor: [number, number],
  current: [number, number],
  minDistSq = STRAIGHT_STROKE_LOCK_MIN_DIST_SQ,
  options?: { forceHorizontal?: boolean },
): StraightStrokeAxis | null {
  if (locked) return locked
  const dx = current[0] - anchor[0]
  const dy = current[1] - anchor[1]
  if (dx * dx + dy * dy < minDistSq) return null
  if (options?.forceHorizontal) return 'horizontal'
  return resolveStraightStrokeAxis(dx, dy)
}

/**
 * Straight segment along a fixed axis (horizontal or vertical only).
 */
export function straightStrokePoints(
  anchor: [number, number],
  current: [number, number],
  axis: StraightStrokeAxis,
): [number, number][] {
  const end: [number, number] =
    axis === 'horizontal' ? [current[0], anchor[1]] : [anchor[0], current[1]]
  return [anchor, end]
}

/** Append coalesced move samples to a freehand draft, or snap a straight pen/marker segment. */
export function extendStrokeDraftFromMove(
  draft: { tool: StrokeTool; points: [number, number][] },
  samples: readonly [number, number][],
  opts: {
    shiftKey: boolean
    straightFromHold?: boolean
    markerStraightStrokeEnabled: boolean
    penInkStyle?: PenInkStyle
    straightStrokeAxis: StraightStrokeAxis | null
  },
): StraightStrokeAxis | null {
  if (samples.length === 0) return opts.straightStrokeAxis
  const anchor = draft.points[0]
  if (!anchor) return opts.straightStrokeAxis

  const useStraight =
    (draft.tool === 'pen' || draft.tool === 'marker') &&
    shouldUseStraightStrokeLine({
      tool: draft.tool,
      shiftKey: opts.shiftKey,
      straightFromHold: opts.straightFromHold,
      markerStraightStrokeEnabled: opts.markerStraightStrokeEnabled,
      penInkStyle: draft.tool === 'pen' ? opts.penInkStyle : undefined,
    })

  if (useStraight) {
    const current = samples[samples.length - 1]!
    const axis = lockStraightStrokeAxis(opts.straightStrokeAxis, anchor, current, undefined, {
      forceHorizontal: draft.tool === 'marker',
    })
    if (!axis) return opts.straightStrokeAxis
    draft.points = straightStrokePoints(anchor, current, axis)
    return axis
  }

  const smoothBlend = draft.tool === 'pen' ? STROKE_FREEHAND_SMOOTH_BLEND : 0
  appendNormPointsIfMoved(draft.points, samples, undefined, smoothBlend)
  return opts.straightStrokeAxis
}

/** Snap the stroke end to the pointer release position (no move-distance threshold). */
export function finalizeStrokeDraftEndPoint(
  draft: { tool: StrokeTool; points: [number, number][] },
  end: [number, number],
  opts: {
    shiftKey: boolean
    straightFromHold?: boolean
    markerStraightStrokeEnabled: boolean
    penInkStyle?: PenInkStyle
    straightStrokeAxis: StraightStrokeAxis | null
  },
): StraightStrokeAxis | null {
  if (draft.points.length === 0) return opts.straightStrokeAxis

  if (draft.tool === 'pen' || draft.tool === 'marker') {
    if (
      shouldUseStraightStrokeLine({
        tool: draft.tool,
        shiftKey: opts.shiftKey,
        straightFromHold: opts.straightFromHold,
        markerStraightStrokeEnabled: opts.markerStraightStrokeEnabled,
        penInkStyle: draft.tool === 'pen' ? opts.penInkStyle : undefined,
      })
    ) {
      const anchor = draft.points[0]!
      const axis =
        opts.straightStrokeAxis ??
        (draft.tool === 'marker'
          ? 'horizontal'
          : resolveStraightStrokeAxis(end[0] - anchor[0], end[1] - anchor[1]))
      draft.points = straightStrokePoints(anchor, end, axis)
      return axis
    }
  }

  if (draft.points.length === 1) {
    draft.points.push(end)
  } else {
    const last = draft.points[draft.points.length - 1]!
    const dx = end[0] - last[0]
    const dy = end[1] - last[1]
    // Ignore finger-lift jitter on release so committed ink matches the last live frame.
    if (dx * dx + dy * dy >= STROKE_TAP_MAX_DIST_SQ) {
      draft.points[draft.points.length - 1] = end
    }
  }
  return opts.straightStrokeAxis
}

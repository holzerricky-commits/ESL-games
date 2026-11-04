import {
  buildBlockLineBands,
  lineRectsForRuns,
  wordRectOnLine,
  type RunLineBand,
} from '@/lib/books/pdf-page-selection-rects'
import { buildTextBlocks } from '@/lib/books/pdf-page-text-blocks'
import {
  clientPointToNorm,
  hitTestNormPoint,
  nearestRunWithin,
  selectRunsBetween,
  type NormRect,
  type PdfPageTextRun,
} from '@/lib/books/pdf-page-text-geometry'
import { pickWordAtPoint } from '@/lib/books/pdf-page-word-pick'
import type { SpreadInkLayout } from '@/lib/books/spread-stroke-split'

export type MarkerTextSnapSide = 'left' | 'right'

/** One page-normalized highlight strip (line-snapped). */
export type MarkerTextSnapStrip = NormRect & {
  side: MarkerTextSnapSide
}

export type MarkerTextSnapSession = {
  side: MarkerTextSnapSide
  runs: readonly PdfPageTextRun[]
  bands: ReadonlyMap<number, RunLineBand>
  /** Unique line bands sorted top→bottom for fast live line lookup. */
  uniqueBands: readonly RunLineBand[]
  anchorRunIndex: number
  focusRunIndex: number
  /** True once the pointer moved enough to treat this as a drag (vs word tap). */
  dragged: boolean
  anchorNx: number
  anchorNy: number
  focusNx: number
  focusNy: number
}

/** Page-norm slack when picking a run under / near the pointer. */
const SNAP_MAX_DX = 0.045
const SNAP_MAX_DY = 0.035
/** Page-norm distance before a press becomes a drag selection. */
const DRAG_THRESHOLD_NORM = 0.012

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

function pageNormPointToSpreadNorm(
  p: readonly [number, number],
  side: MarkerTextSnapSide,
  layout: SpreadInkLayout,
): [number, number] {
  if (!(layout.spreadPageWidthPx > 0) || !(layout.spreadOverlayWidthPx > 0)) {
    return [0, 0]
  }
  const pageOrigin = side === 'left' ? layout.leftPageOriginXPx : layout.rightPageOriginXPx
  const spreadX = pageOrigin + p[0] * layout.spreadPageWidthPx
  return [clamp01(spreadX / layout.spreadOverlayWidthPx), clamp01(p[1])]
}

/** Keep in sync with `MARKER_LINE_WIDTH` in annotation-draw (avoid circular import). */
const MARKER_LINE_WIDTH_PX = 22

/** Stroke thickness so the mark matches the text line band height in CSS px. */
export function markerWidthScaleForBandHeight(
  bandHeightNorm: number,
  pageHeightPx: number,
): number {
  if (!(pageHeightPx > 0) || !(bandHeightNorm > 0)) return 1
  const px = bandHeightNorm * pageHeightPx
  return Math.max(0.35, Math.min(3.5, px / MARKER_LINE_WIDTH_PX))
}

export function buildMarkerTextSnapBands(
  runs: readonly PdfPageTextRun[],
): ReadonlyMap<number, RunLineBand> {
  return buildBlockLineBands(buildTextBlocks(runs).blocks)
}

function uniqueBandsFromMap(bands: ReadonlyMap<number, RunLineBand>): RunLineBand[] {
  const byId = new Map<number, RunLineBand>()
  for (const band of bands.values()) byId.set(band.lineId, band)
  return [...byId.values()].sort((a, b) => a.y - b.y || a.lineId - b.lineId)
}

function resolveRunAtPoint(
  runs: readonly PdfPageTextRun[],
  nx: number,
  ny: number,
): number | null {
  return (
    hitTestNormPoint(runs, nx, ny) ?? nearestRunWithin(runs, nx, ny, SNAP_MAX_DX, SNAP_MAX_DY)
  )
}

function bandContainsY(band: RunLineBand, ny: number, padRatio = 0.35): boolean {
  const pad = band.h * padRatio
  return ny >= band.y - pad && ny <= band.y + band.h + pad
}

function findBandAtY(uniqueBands: readonly RunLineBand[], ny: number): RunLineBand | null {
  let best: RunLineBand | null = null
  let bestDist = Infinity
  for (const band of uniqueBands) {
    const cy = band.y + band.h / 2
    const dist = Math.abs(cy - ny)
    if (dist < bestDist) {
      bestDist = dist
      best = band
    }
  }
  return best
}

function firstRunOnLine(
  runs: readonly PdfPageTextRun[],
  bands: ReadonlyMap<number, RunLineBand>,
  lineId: number,
): number | null {
  for (const run of runs) {
    if (bands.get(run.index)?.lineId === lineId) return run.index
  }
  return null
}

/**
 * Start a text-aware highlighter gesture when the pointer is on/near PDF text.
 * Returns null when there is no usable text under the pointer (caller falls back to freehand).
 */
export function beginMarkerTextSnap(args: {
  side: MarkerTextSnapSide
  runs: readonly PdfPageTextRun[]
  nx: number
  ny: number
}): MarkerTextSnapSession | null {
  if (args.runs.length === 0) return null
  const runIndex = resolveRunAtPoint(args.runs, args.nx, args.ny)
  if (runIndex == null) return null
  const bands = buildMarkerTextSnapBands(args.runs)
  return {
    side: args.side,
    runs: args.runs,
    bands,
    uniqueBands: uniqueBandsFromMap(bands),
    anchorRunIndex: runIndex,
    focusRunIndex: runIndex,
    dragged: false,
    anchorNx: args.nx,
    anchorNy: args.ny,
    focusNx: args.nx,
    focusNy: args.ny,
  }
}

/** Update focus run / drag flag from a page-normalized pointer on the same page. */
export function updateMarkerTextSnap(
  session: MarkerTextSnapSession,
  nx: number,
  ny: number,
): MarkerTextSnapSession {
  const focusBand = session.bands.get(session.focusRunIndex)
  let focus = session.focusRunIndex

  // Same-line fast path: skip full-page nearest-run scan while Y stays on the band.
  if (focusBand && bandContainsY(focusBand, ny)) {
    const hit = hitTestNormPoint(session.runs, nx, ny)
    if (hit != null && session.bands.get(hit)?.lineId === focusBand.lineId) {
      focus = hit
    }
  } else {
    focus =
      resolveRunAtPoint(session.runs, nx, ny) ??
      (() => {
        const band = findBandAtY(session.uniqueBands, ny)
        if (!band) return session.focusRunIndex
        return (
          firstRunOnLine(session.runs, session.bands, band.lineId) ?? session.focusRunIndex
        )
      })()
  }

  const moved =
    session.dragged ||
    Math.hypot(nx - session.anchorNx, ny - session.anchorNy) >= DRAG_THRESHOLD_NORM ||
    focus !== session.anchorRunIndex
  return {
    ...session,
    focusRunIndex: focus,
    focusNx: nx,
    focusNy: ny,
    dragged: moved,
  }
}

/**
 * Cheap live ghost strips for pointermove — expands with the cursor, no word picking.
 * Commit still uses {@link markerTextSnapStrips} for word/line-accurate bars.
 */
export function markerTextSnapLiveGhostStrips(
  session: MarkerTextSnapSession,
): MarkerTextSnapStrip[] {
  const anchorBand = session.bands.get(session.anchorRunIndex)
  if (!anchorBand) return markerTextSnapStrips(session)

  if (!session.dragged) {
    return markerTextSnapStrips(session)
  }

  const focusBand =
    session.bands.get(session.focusRunIndex) ?? findBandAtY(session.uniqueBands, session.focusNy)
  if (!focusBand) {
    const x0 = Math.min(session.anchorNx, session.focusNx)
    const x1 = Math.max(session.anchorNx, session.focusNx)
    return [
      {
        side: session.side,
        x: x0,
        y: anchorBand.y,
        w: Math.max(1e-4, x1 - x0),
        h: anchorBand.h,
      },
    ]
  }

  const lo = Math.min(anchorBand.lineId, focusBand.lineId)
  const hi = Math.max(anchorBand.lineId, focusBand.lineId)
  const x0 = Math.min(session.anchorNx, session.focusNx)
  const x1 = Math.max(session.anchorNx, session.focusNx)
  const w = Math.max(1e-4, x1 - x0)
  const strips: MarkerTextSnapStrip[] = []
  for (const band of session.uniqueBands) {
    if (band.lineId < lo || band.lineId > hi) continue
    if (band.lineId === anchorBand.lineId && band.lineId === focusBand.lineId) {
      strips.push({ side: session.side, x: x0, y: band.y, w, h: band.h })
    } else if (band.lineId === anchorBand.lineId) {
      const fromLeft = focusBand.lineId > anchorBand.lineId
      strips.push(
        fromLeft
          ? {
              side: session.side,
              x: session.anchorNx,
              y: band.y,
              w: Math.max(1e-4, 1 - session.anchorNx),
              h: band.h,
            }
          : {
              side: session.side,
              x: 0,
              y: band.y,
              w: Math.max(1e-4, session.anchorNx),
              h: band.h,
            },
      )
    } else if (band.lineId === focusBand.lineId) {
      const fromLeft = focusBand.lineId > anchorBand.lineId
      strips.push(
        fromLeft
          ? {
              side: session.side,
              x: 0,
              y: band.y,
              w: Math.max(1e-4, session.focusNx),
              h: band.h,
            }
          : {
              side: session.side,
              x: session.focusNx,
              y: band.y,
              w: Math.max(1e-4, 1 - session.focusNx),
              h: band.h,
            },
      )
    } else {
      strips.push({ side: session.side, x: 0, y: band.y, w: 1, h: band.h })
    }
  }
  return strips.length > 0 ? strips : markerTextSnapStrips(session)
}

/**
 * Line-snapped highlight strips for the current session (commit quality).
 * Tap (no drag): the word under the pointer. Drag: selection between anchor and focus runs.
 */
export function markerTextSnapStrips(session: MarkerTextSnapSession): MarkerTextSnapStrip[] {
  if (!session.dragged) {
    const pick = pickWordAtPoint(
      session.runs,
      session.anchorRunIndex,
      session.anchorNx,
      session.focusNx,
    )
    const raw = pick?.rects[0]
    if (raw) {
      const banded = wordRectOnLine(raw, session.anchorRunIndex, session.bands)
      return [{ ...banded, side: session.side }]
    }
  }

  const selected = selectRunsBetween(session.runs, session.anchorRunIndex, session.focusRunIndex)
  if (selected.length === 0) return []
  return lineRectsForRuns(selected, session.bands).map((r) => ({ ...r, side: session.side }))
}

/** Centerline endpoints in spread-normalized space for one strip. */
export function markerStripToSpreadStrokePoints(
  strip: MarkerTextSnapStrip,
  layout: SpreadInkLayout,
): [[number, number], [number, number]] {
  const y = strip.y + strip.h / 2
  const a = pageNormPointToSpreadNorm([strip.x, y], strip.side, layout)
  const b = pageNormPointToSpreadNorm([strip.x + strip.w, y], strip.side, layout)
  return [a, b]
}

/** Pick page side + page-norm point from a client pointer over the spread. */
export function clientPointToMarkerTextSnapPage(args: {
  clientX: number
  clientY: number
  leftPageRect: DOMRectReadOnly | null | undefined
  rightPageRect: DOMRectReadOnly | null | undefined
  leftRuns: readonly PdfPageTextRun[]
  rightRuns: readonly PdfPageTextRun[]
}): { side: MarkerTextSnapSide; nx: number; ny: number; runs: readonly PdfPageTextRun[] } | null {
  const leftNorm =
    args.leftPageRect != null
      ? clientPointToNorm(args.clientX, args.clientY, args.leftPageRect)
      : null
  const rightNorm =
    args.rightPageRect != null
      ? clientPointToNorm(args.clientX, args.clientY, args.rightPageRect)
      : null

  const leftHit =
    leftNorm && args.leftRuns.length > 0
      ? resolveRunAtPoint(args.leftRuns, leftNorm.nx, leftNorm.ny)
      : null
  const rightHit =
    rightNorm && args.rightRuns.length > 0
      ? resolveRunAtPoint(args.rightRuns, rightNorm.nx, rightNorm.ny)
      : null

  if (leftHit != null && leftNorm) {
    return { side: 'left', nx: leftNorm.nx, ny: leftNorm.ny, runs: args.leftRuns }
  }
  if (rightHit != null && rightNorm) {
    return { side: 'right', nx: rightNorm.nx, ny: rightNorm.ny, runs: args.rightRuns }
  }

  if (leftNorm) {
    return { side: 'left', nx: leftNorm.nx, ny: leftNorm.ny, runs: args.leftRuns }
  }
  if (rightNorm) {
    return { side: 'right', nx: rightNorm.nx, ny: rightNorm.ny, runs: args.rightRuns }
  }
  return null
}

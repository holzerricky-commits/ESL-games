import {
  clampSpreadGutterPullRatio,
  DEFAULT_SPREAD_GUTTER_PULL_RATIO,
  MAX_SPREAD_GUTTER_PULL_RATIO,
} from '@/lib/books/spread-gutter'

/** Render width for seam analysis (balance speed vs accuracy). */
export const SPREAD_GUTTER_AUTO_ANALYSIS_WIDTH_PX = 480

/** RGBA page raster (browser `ImageData` or test fixtures). */
export type PageImageRaster = {
  readonly width: number
  readonly height: number
  readonly data: Uint8ClampedArray
}

/** Fraction of page width used as the comparison strip at the inner edge. */
const SEAM_STRIP_WIDTH_FRACTION = 0.14

/** Skip top/bottom of page when scoring (headers, footers, crop noise). */
const VERTICAL_MARGIN_FRACTION = 0.12

/** Search step as fraction of page width (0.5%). */
const PULL_RATIO_SEARCH_STEP = 0.005

/** Slight bias toward smaller overlap when scores are close. */
const PULL_RATIO_PENALTY_WEIGHT = 1.5

/**
 * Mean absolute RGB difference between the inner edge of the left page and the
 * right page after simulating `pullRatio` overlap (right page shifted left).
 */
export function scoreSpreadSeamAlignment(
  left: PageImageRaster,
  right: PageImageRaster,
  pullRatio: number,
): number {
  const w = left.width
  const h = left.height
  if (w < 16 || h < 16 || right.width !== w || right.height !== h) return Number.POSITIVE_INFINITY

  const pullPx = Math.round(w * clampSpreadGutterPullRatio(pullRatio))
  const stripW = Math.max(6, Math.floor(w * SEAM_STRIP_WIDTH_FRACTION))
  const leftStart = w - pullPx - stripW
  const rightStart = pullPx
  if (leftStart < 0 || rightStart + stripW > w) return Number.POSITIVE_INFINITY

  const y0 = Math.floor(h * VERTICAL_MARGIN_FRACTION)
  const y1 = Math.floor(h * (1 - VERTICAL_MARGIN_FRACTION))
  if (y1 <= y0) return Number.POSITIVE_INFINITY

  let sum = 0
  let count = 0
  const leftData = left.data
  const rightData = right.data

  for (let y = y0; y < y1; y++) {
    const row = y * w
    for (let i = 0; i < stripW; i++) {
      const lx = leftStart + i
      const rx = rightStart + i
      const li = (row + lx) << 2
      const ri = (row + rx) << 2
      sum += Math.abs(leftData[li]! - rightData[ri]!)
      sum += Math.abs(leftData[li + 1]! - rightData[ri + 1]!)
      sum += Math.abs(leftData[li + 2]! - rightData[ri + 2]!)
      count += 3
    }
  }

  if (count === 0) return Number.POSITIVE_INFINITY
  const meanDiff = sum / count
  return meanDiff + clampSpreadGutterPullRatio(pullRatio) * PULL_RATIO_PENALTY_WEIGHT
}

/** Pick overlap ratio that minimizes seam error between two same-size page renders. */
export function estimateSpreadGutterPullRatioFromPageImages(
  left: PageImageRaster,
  right: PageImageRaster,
): number {
  if (left.width < 16 || right.width < 16) return DEFAULT_SPREAD_GUTTER_PULL_RATIO

  let bestScore = Number.POSITIVE_INFINITY
  const scored: Array<{ ratio: number; score: number }> = []

  for (
    let ratio = 0;
    ratio <= MAX_SPREAD_GUTTER_PULL_RATIO + PULL_RATIO_SEARCH_STEP / 2;
    ratio += PULL_RATIO_SEARCH_STEP
  ) {
    const clamped = clampSpreadGutterPullRatio(ratio)
    const score = scoreSpreadSeamAlignment(left, right, clamped)
    scored.push({ ratio: clamped, score })
    if (score < bestScore) bestScore = score
  }

  if (!scored.length || !Number.isFinite(bestScore)) return DEFAULT_SPREAD_GUTTER_PULL_RATIO

  /** When several pulls tie, prefer more overlap (flat gutters fool pull=0). */
  const threshold = bestScore * 1.1 + 0.5
  let chosen = DEFAULT_SPREAD_GUTTER_PULL_RATIO
  for (const { ratio, score } of scored) {
    if (score <= threshold && ratio >= chosen) chosen = ratio
  }
  return chosen
}

/** Median of finite ratios; falls back to default when empty. */
export function medianSpreadGutterPullRatio(ratios: number[]): number {
  const finite = ratios.filter((r) => Number.isFinite(r))
  if (!finite.length) return DEFAULT_SPREAD_GUTTER_PULL_RATIO
  finite.sort((a, b) => a - b)
  const mid = Math.floor(finite.length / 2)
  return finite.length % 2 === 1 ? finite[mid]! : (finite[mid - 1]! + finite[mid]!) / 2
}

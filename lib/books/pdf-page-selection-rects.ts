import type { NormRect, PdfPageTextRun } from '@/lib/books/pdf-page-text-geometry'

/** One visual line's highlight band (page-normalized). */
export type RunLineBand = {
  lineId: number
  y: number
  h: number
}

/** A run joins a line when its vertical center is within this × the line's median run height. */
const LINE_CENTER_TOLERANCE_RATIO = 0.5
/** Extra space above and below each band, as a fraction of its height. */
const BAND_PAD_RATIO = 0.06
/** Per-line font-size estimate leans toward words with ascenders, so a line of short words is not undersized. */
const LINE_SIZE_PERCENTILE = 0.75
/** Line sizes within this ratio of their neighbor share one highlight height. */
const FONT_SIZE_CLUSTER_RATIO = 1.2
/** Selected runs on one band farther apart than this × band height get separate bars. */
const BAR_SPLIT_GAP_RATIO = 1.5

function median(values: readonly number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1) + 0.5))]!
}

function centerY(run: PdfPageTextRun): number {
  return run.y + run.h / 2
}

type TextLine = {
  runs: PdfPageTextRun[]
  center: number
  /** Font-size estimate for the line (page-normalized height). */
  size: number
}

/**
 * One height per font size: sort line sizes, start a new cluster where a size jumps
 * by more than {@link FONT_SIZE_CLUSTER_RATIO}, and give every line its cluster's median.
 * Returns heights in the same order as `sizes`.
 */
function clusterLineSizes(sizes: readonly number[]): number[] {
  const order = sizes.map((size, i) => ({ size, i })).sort((a, b) => a.size - b.size)
  const heights = new Array<number>(sizes.length).fill(0)
  let cluster: Array<{ size: number; i: number }> = []
  const flush = () => {
    if (cluster.length === 0) return
    const h = median(cluster.map((c) => c.size))
    for (const c of cluster) heights[c.i] = h
    cluster = []
  }
  for (const item of order) {
    const prev = cluster[cluster.length - 1]
    if (prev && item.size > prev.size * FONT_SIZE_CLUSTER_RATIO) flush()
    cluster.push(item)
  }
  flush()
  return heights
}

/**
 * Group page runs into visual lines and give each line a band centered on it.
 * Band height comes from the line's font-size cluster, so all body lines match.
 */
export function buildRunLineBands(runs: readonly PdfPageTextRun[]): Map<number, RunLineBand> {
  const sorted = [...runs].filter((r) => r.h > 0).sort((a, b) => centerY(a) - centerY(b))
  const lines: TextLine[] = []
  let current: PdfPageTextRun[] = []

  const flush = () => {
    if (current.length === 0) return
    const top = median(current.map((r) => r.y))
    const bottom = median(current.map((r) => r.y + r.h))
    lines.push({
      runs: current,
      center: (top + bottom) / 2,
      size: percentile(
        current.map((r) => r.h),
        LINE_SIZE_PERCENTILE,
      ),
    })
    current = []
  }

  for (const run of sorted) {
    if (current.length > 0) {
      const lineCenter = median(current.map(centerY))
      const lineHeight = median(current.map((r) => r.h))
      if (Math.abs(centerY(run) - lineCenter) > lineHeight * LINE_CENTER_TOLERANCE_RATIO) flush()
    }
    current.push(run)
  }
  flush()

  const sizeHeights = clusterLineSizes(lines.map((line) => line.size))
  const bands = new Map<number, RunLineBand>()
  lines.forEach((line, lineId) => {
    const h = sizeHeights[lineId]! * (1 + 2 * BAND_PAD_RATIO)
    const band: RunLineBand = { lineId, y: Math.max(0, line.center - h / 2), h }
    for (const run of line.runs) bands.set(run.index, band)
  })
  return bands
}

/**
 * Line bands built separately for each text block, so a caption line beside a
 * main-text line gets its own band. Line ids stay unique across blocks.
 */
export function buildBlockLineBands(
  blocks: ReadonlyArray<{ runs: readonly PdfPageTextRun[] }>,
): Map<number, RunLineBand> {
  const merged = new Map<number, RunLineBand>()
  let lineOffset = 0
  for (const block of blocks) {
    const bands = buildRunLineBands(block.runs)
    let maxLineId = -1
    for (const [runIndex, band] of bands) {
      merged.set(runIndex, { ...band, lineId: band.lineId + lineOffset })
      maxLineId = Math.max(maxLineId, band.lineId)
    }
    lineOffset += maxLineId + 1
  }
  return merged
}

/**
 * One bar per line for a selection: from the leftmost to the rightmost selected run,
 * at the line band's top and height. Far-apart runs on one band (side-by-side
 * bubbles) get separate bars.
 */
export function lineRectsForRuns(
  selectedRuns: readonly PdfPageTextRun[],
  bands: ReadonlyMap<number, RunLineBand>,
): NormRect[] {
  const byLine = new Map<number, { band: RunLineBand | null; runs: PdfPageTextRun[]; order: number }>()
  selectedRuns.forEach((run, order) => {
    const band = bands.get(run.index) ?? null
    const key = band ? band.lineId : -1 - run.index
    const entry = byLine.get(key)
    if (entry) entry.runs.push(run)
    else byLine.set(key, { band, runs: [run], order })
  })

  const rects: NormRect[] = []
  const lines = [...byLine.values()].sort((a, b) => a.order - b.order)
  for (const { band, runs } of lines) {
    const ordered = [...runs].sort((a, b) => a.x - b.x)
    const y = band ? band.y : ordered[0]!.y
    const h = band ? band.h : ordered[0]!.h
    let left = ordered[0]!.x
    let right = left + ordered[0]!.w
    for (let i = 1; i < ordered.length; i++) {
      const run = ordered[i]!
      if (run.x - right > h * BAR_SPLIT_GAP_RATIO) {
        rects.push({ x: left, y, w: right - left, h })
        left = run.x
      }
      right = Math.max(right, run.x + run.w)
    }
    rects.push({ x: left, y, w: right - left, h })
  }
  return rects
}

/** Keep a clicked word's horizontal span; take top and height from its line band. */
export function wordRectOnLine(
  rect: NormRect,
  runIndex: number,
  bands: ReadonlyMap<number, RunLineBand>,
): NormRect {
  const band = bands.get(runIndex)
  return band ? { x: rect.x, y: band.y, w: rect.w, h: band.h } : rect
}
